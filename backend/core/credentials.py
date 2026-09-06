"""Lưu API key người dùng nhập trên giao diện.

Ba nguyên tắc:

1. **Không bao giờ trả key gốc ra client.** Đọc lên chỉ được bản che
   (`sk-proj-••••4f2a`). Client không có cách nào lấy lại key đầy đủ.

2. **Mã hoá at-rest.** Key nằm trên đĩa ở dạng đã mã hoá bằng `CREDENTIALS_SECRET`.
   Ai đọc được file cũng không dùng được nếu không có secret đó.

3. **Không dùng hash.** Hash là một chiều, băm xong không lấy lại được key để
   gọi API. Ở đây cần mã hoá đối xứng (giải mã được), khác hẳn với lưu mật khẩu.

Thứ tự ưu tiên khi lấy key: key người dùng nhập trên UI, rồi mới đến biến môi
trường. Nhờ vậy đổi key không cần khởi động lại service.
"""

import base64
import hashlib
import json
import os
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from .logging import get_logger

logger = get_logger(__name__)

CREDENTIALS_FILE = "vlm_credentials.json"
MASK_VISIBLE_CHARS = 4
MASK_DOTS = "••••"


@dataclass(frozen=True)
class StoredCredential:
    """Một bộ thông tin đăng nhập của provider."""

    api_key: str
    model_name: Optional[str] = None
    endpoint: Optional[str] = None


def mask_key(key: str | None) -> str | None:
    """Che key, chỉ để lộ vài ký tự cuối.

    `sk-proj-abc123def456` -> `sk-proj-••••f456`

    Giữ lại tiền tố nhận dạng (`sk-`, `AIza`) để người dùng biết mình dán đúng
    loại key, nhưng không đủ để dùng lại.
    """
    if not key:
        return None

    if len(key) <= MASK_VISIBLE_CHARS + 2:
        return MASK_DOTS

    # Tiền tố nhận dạng của các nhà cung cấp phổ biến.
    prefix = ""
    for known in ("sk-proj-", "sk-ant-", "sk-", "AIza", "gsk_"):
        if key.startswith(known):
            prefix = known
            break

    return f"{prefix}{MASK_DOTS}{key[-MASK_VISIBLE_CHARS:]}"


def _derive_fernet_key(secret: str) -> bytes:
    """Chuyển secret bất kỳ thành khoá Fernet 32 byte."""
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


class CredentialStore:
    """Đọc ghi credential, mã hoá at-rest nếu có CREDENTIALS_SECRET."""

    def __init__(self, path: Path, secret: str | None = None):
        self.path = path
        self._secret = secret
        self._lock = threading.Lock()
        self._fernet = None

        if secret:
            try:
                from cryptography.fernet import Fernet

                self._fernet = Fernet(_derive_fernet_key(secret))
            except ImportError:
                logger.warning(
                    "Thiếu gói cryptography nên credential lưu dạng thô. "
                    "Cài `cryptography` để bật mã hoá at-rest."
                )

    @property
    def is_encrypted(self) -> bool:
        return self._fernet is not None

    def _encrypt(self, value: str) -> str:
        if self._fernet is None:
            return value
        return self._fernet.encrypt(value.encode("utf-8")).decode("ascii")

    def _decrypt(self, value: str) -> str:
        if self._fernet is None:
            return value
        try:
            return self._fernet.decrypt(value.encode("ascii")).decode("utf-8")
        except Exception:
            # Secret đã đổi hoặc file hỏng: coi như chưa có key, không crash.
            logger.error("Không giải mã được credential. CREDENTIALS_SECRET có đổi không?")
            return ""

    def _read_raw(self) -> dict:
        if not self.path.exists():
            return {}
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            logger.error("Không đọc được %s: %s", self.path, e)
            return {}

    def _write_raw(self, data: dict) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        tmp.replace(self.path)

        # Chỉ chủ sở hữu đọc được. Bỏ qua trên Windows vì chmod không có tác dụng.
        try:
            os.chmod(self.path, 0o600)
        except (OSError, NotImplementedError):
            pass

    def get(self, provider_id: str) -> StoredCredential | None:
        """Lấy credential đã giải mã. Chỉ dùng phía server, không trả ra client."""
        with self._lock:
            entry = self._read_raw().get(provider_id)

        if not entry:
            return None

        api_key = self._decrypt(entry.get("api_key", ""))
        if not api_key:
            return None

        return StoredCredential(
            api_key=api_key,
            model_name=entry.get("model_name") or None,
            endpoint=entry.get("endpoint") or None,
        )

    def set(
        self,
        provider_id: str,
        api_key: str,
        model_name: str | None = None,
        endpoint: str | None = None,
    ) -> None:
        with self._lock:
            data = self._read_raw()
            data[provider_id] = {
                "api_key": self._encrypt(api_key),
                "model_name": model_name or "",
                "endpoint": endpoint or "",
                "encrypted": self.is_encrypted,
            }
            self._write_raw(data)

        logger.info(
            "Đã lưu credential cho %s (mã hoá=%s)", provider_id, self.is_encrypted
        )

    def delete(self, provider_id: str) -> bool:
        with self._lock:
            data = self._read_raw()
            existed = data.pop(provider_id, None) is not None
            if existed:
                self._write_raw(data)

        if existed:
            logger.info("Đã xoá credential của %s", provider_id)
        return existed

    def list_configured(self) -> dict[str, str]:
        """Provider nào đã có key, kèm bản che của key đó."""
        with self._lock:
            data = self._read_raw()

        result: dict[str, str] = {}
        for provider_id, entry in data.items():
            key = self._decrypt(entry.get("api_key", ""))
            masked = mask_key(key)
            if masked:
                result[provider_id] = masked
        return result


_store: CredentialStore | None = None
_store_lock = threading.Lock()


def get_credential_store() -> CredentialStore:
    global _store
    if _store is not None:
        return _store

    with _store_lock:
        if _store is None:
            # Đọc DATA_DIR thẳng từ env thay vì qua get_settings(): credential
            # store không cần biết gì về cấu hình model, và không nên fail chỉ
            # vì thiếu API key của LLM.
            data_dir = Path(os.environ.get("DATA_DIR") or "./data").expanduser()

            secret = os.environ.get("CREDENTIALS_SECRET") or None
            if not secret:
                logger.warning(
                    "Chưa đặt CREDENTIALS_SECRET nên API key lưu dạng thô trên đĩa. "
                    "Đặt biến này trong .env để bật mã hoá at-rest."
                )
            _store = CredentialStore(data_dir / CREDENTIALS_FILE, secret)
    return _store


def reset_credential_store() -> None:
    """Chỉ dùng trong test."""
    global _store
    _store = None
