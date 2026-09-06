"""Mã hoá secret trước khi ghi đĩa, và che secret khi hiển thị.

Hai việc khác nhau, hay bị lẫn:

- **Che (mask)**: một chiều, chỉ để hiển thị. `sk-proj-abc...789` thành
  `sk-proj-••••x789`. Không tái tạo lại được.
- **Mã hoá (encrypt)**: hai chiều, giải mã được. Cần thiết vì phải có key gốc
  để gọi API.

Hash không dùng được ở đây: băm xong không lấy lại được key.
"""

import base64
import hashlib
import os
import threading

from .logging import get_logger

logger = get_logger(__name__)

MASK_VISIBLE_CHARS = 4
MASK_DOTS = "••••"

# Tiền tố nhận dạng của các nhà cung cấp phổ biến. Giữ lại để người dùng biết
# mình dán đúng loại key, nhưng không đủ để dùng lại.
KNOWN_PREFIXES = ("sk-proj-", "sk-ant-", "sk-", "AIza", "gsk_", "hf_")

_fernet = None
_fernet_lock = threading.Lock()
_warned = False


def mask_key(key: str | None) -> str | None:
    """Che key, chỉ để lộ vài ký tự cuối."""
    if not key:
        return None

    if len(key) <= MASK_VISIBLE_CHARS + 2:
        return MASK_DOTS

    prefix = next((p for p in KNOWN_PREFIXES if key.startswith(p)), "")
    return f"{prefix}{MASK_DOTS}{key[-MASK_VISIBLE_CHARS:]}"


def _derive_fernet_key(secret: str) -> bytes:
    """Chuyển secret bất kỳ thành khoá Fernet 32 byte."""
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _get_fernet():
    """None nếu chưa đặt CREDENTIALS_SECRET hoặc thiếu gói cryptography."""
    global _fernet, _warned

    if _fernet is not None:
        return _fernet

    with _fernet_lock:
        if _fernet is not None:
            return _fernet

        secret = os.environ.get("CREDENTIALS_SECRET") or None
        if not secret:
            if not _warned:
                logger.warning(
                    "Chưa đặt CREDENTIALS_SECRET nên API key lưu dạng thô trên đĩa. "
                    "Đặt biến này trong .env để bật mã hoá at-rest."
                )
                _warned = True
            return None

        try:
            from cryptography.fernet import Fernet

            _fernet = Fernet(_derive_fernet_key(secret))
        except ImportError:
            if not _warned:
                logger.warning(
                    "Thiếu gói cryptography nên secret lưu dạng thô. "
                    "Cài `cryptography` để bật mã hoá at-rest."
                )
                _warned = True
            return None

    return _fernet


def is_encryption_enabled() -> bool:
    return _get_fernet() is not None


def encrypt_value(value: str) -> str:
    fernet = _get_fernet()
    if fernet is None:
        return value
    return fernet.encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_value(value: str) -> str:
    """Trả chuỗi rỗng nếu không giải mã được, để service không crash."""
    if not value:
        return ""

    fernet = _get_fernet()
    if fernet is None:
        return value

    try:
        return fernet.decrypt(value.encode("ascii")).decode("utf-8")
    except Exception:
        logger.error(
            "Không giải mã được secret. CREDENTIALS_SECRET có bị đổi không? "
            "Nếu có thì phải nhập lại key."
        )
        return ""


def reset_crypto() -> None:
    """Chỉ dùng trong test, sau khi đổi CREDENTIALS_SECRET."""
    global _fernet, _warned
    _fernet = None
    _warned = False
