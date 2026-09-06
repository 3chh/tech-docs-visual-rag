"""Test lưu API key người dùng nhập trên giao diện.

Ba tính chất phải giữ bằng mọi giá:
1. Key gốc không bao giờ ra khỏi server
2. Key trên đĩa được mã hoá khi có CREDENTIALS_SECRET
3. Key từ UI đè lên key từ biến môi trường
"""

import json

import pytest

from backend.core.credentials import (
    CredentialStore,
    mask_key,
    reset_credential_store,
)


@pytest.fixture
def store(tmp_path):
    return CredentialStore(tmp_path / "creds.json", secret="test-secret")


@pytest.fixture
def plain_store(tmp_path):
    """Store không mã hoá, mô phỏng khi chưa đặt CREDENTIALS_SECRET."""
    return CredentialStore(tmp_path / "creds.json", secret=None)


# --- Che key ---------------------------------------------------------------


@pytest.mark.parametrize(
    ("key", "expected"),
    [
        ("sk-proj-abc123def456", "sk-proj-••••f456"),
        ("sk-abcdefghijklmnop", "sk-••••mnop"),
        ("AIzaSyC1234567890xyz", "AIza••••0xyz"),
        ("gsk_abcdefghijklmnop", "gsk_••••mnop"),
        ("khongcotienbto123456", "••••3456"),
    ],
)
def test_che_key_chi_lo_bon_ky_tu_cuoi(key, expected):
    assert mask_key(key) == expected


def test_key_qua_ngan_che_hoan_toan():
    """Key ngắn thì lộ 4 ký tự cuối là lộ gần hết, nên che sạch."""
    assert mask_key("abc123") == "••••"


def test_khong_co_key_thi_tra_none():
    assert mask_key(None) is None
    assert mask_key("") is None


def test_ban_che_khong_dung_lai_duoc():
    """Bản che không được chứa đủ thông tin để tái tạo key."""
    key = "sk-proj-verysecretvalue123456789"
    masked = mask_key(key)

    assert key not in masked
    assert len(masked) < len(key)


# --- Lưu và đọc ------------------------------------------------------------


def test_luu_roi_doc_lai_duoc_key_goc(store):
    """Phía server phải lấy lại được key gốc để gọi API."""
    store.set("openai", api_key="sk-test-123456789")

    credential = store.get("openai")

    assert credential is not None
    assert credential.api_key == "sk-test-123456789"


def test_key_tren_dia_da_ma_hoa(store, tmp_path):
    """Đọc thẳng file không thấy key gốc."""
    store.set("openai", api_key="sk-test-123456789")

    raw = json.loads((tmp_path / "creds.json").read_text(encoding="utf-8"))

    assert "sk-test-123456789" not in json.dumps(raw)
    assert raw["openai"]["encrypted"] is True


def test_khong_co_secret_thi_luu_tho_va_bao_ro(plain_store, tmp_path):
    """Vẫn chạy được nhưng phải nói rõ là chưa mã hoá."""
    plain_store.set("gemini", api_key="AIza-test-123456")

    raw = json.loads((tmp_path / "creds.json").read_text(encoding="utf-8"))

    assert plain_store.is_encrypted is False
    assert raw["gemini"]["encrypted"] is False


def test_doi_secret_thi_khong_giai_ma_duoc_nhung_khong_crash(tmp_path):
    """Mất secret là mất key, nhưng service vẫn phải chạy."""
    CredentialStore(tmp_path / "creds.json", secret="secret-cu").set(
        "openai", api_key="sk-test-123456789"
    )

    other = CredentialStore(tmp_path / "creds.json", secret="secret-moi")

    assert other.get("openai") is None


def test_luu_kem_model_va_endpoint(store):
    store.set(
        "custom",
        api_key="key-123456789",
        model_name="my-vlm",
        endpoint="https://vlm.noi-bo/v1",
    )

    credential = store.get("custom")

    assert credential.model_name == "my-vlm"
    assert credential.endpoint == "https://vlm.noi-bo/v1"


def test_ghi_de_key_cu(store):
    store.set("openai", api_key="sk-cu-123456789")
    store.set("openai", api_key="sk-moi-987654321")

    assert store.get("openai").api_key == "sk-moi-987654321"


def test_xoa_key(store):
    store.set("openai", api_key="sk-test-123456789")

    assert store.delete("openai") is True
    assert store.get("openai") is None
    assert store.delete("openai") is False


def test_liet_ke_chi_tra_ban_che(store):
    store.set("openai", api_key="sk-proj-abc123def456")
    store.set("gemini", api_key="AIzaSyC1234567890xyz")

    configured = store.list_configured()

    assert configured == {
        "openai": "sk-proj-••••f456",
        "gemini": "AIza••••0xyz",
    }


def test_chua_luu_gi_thi_rong(store):
    assert store.list_configured() == {}
    assert store.get("openai") is None


def test_file_hong_khong_lam_crash(tmp_path):
    path = tmp_path / "creds.json"
    path.write_text("{ khong phai json", encoding="utf-8")

    store = CredentialStore(path, secret="s")

    assert store.get("openai") is None
    assert store.list_configured() == {}


# --- Gộp với provider ------------------------------------------------------


def test_key_tu_ui_de_len_key_tu_env(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("CREDENTIALS_SECRET", "test-secret")
    monkeypatch.setenv("GEMINI_API_KEY", "key-tu-env-123456")
    reset_credential_store()

    from backend.core.credentials import get_credential_store
    from backend.core.providers import list_vlm_providers

    before = {p.id: p for p in list_vlm_providers()}["gemini"]
    assert before.key_source == "env"
    assert before.api_key == "key-tu-env-123456"

    get_credential_store().set("gemini", api_key="key-tu-ui-987654")

    after = {p.id: p for p in list_vlm_providers()}["gemini"]
    assert after.key_source == "ui"
    assert after.api_key == "key-tu-ui-987654"
    assert after.masked_key == "••••7654"

    reset_credential_store()


def test_schema_gui_ra_client_khong_co_key_goc():
    """Kiểm tra ở tầng schema, không phải chỉ ở tầng route."""
    from backend.app.api.routes.credentials import CredentialStatus
    from backend.app.schemas.settings import VlmProviderOut

    for model in (CredentialStatus, VlmProviderOut):
        assert "api_key" not in model.model_fields
        assert "masked_key" in model.model_fields
