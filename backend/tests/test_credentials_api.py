"""Test endpoint credential qua HTTP.

Điểm quan trọng nhất: response không được chứa key gốc, ở bất kỳ endpoint nào.
"""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("METADATA_DIR", str(tmp_path))
    monkeypatch.setenv("CREDENTIALS_SECRET", "test-secret")
    monkeypatch.setenv("OPENAI_API_KEY", "EMPTY")
    monkeypatch.setenv("GEMINI_API_KEY", "test")

    from backend.core.config import get_settings
    from backend.core.credentials import reset_credential_store

    get_settings.cache_clear()
    reset_credential_store()

    from backend.app.main import app

    yield TestClient(app)

    reset_credential_store()
    get_settings.cache_clear()


SECRET_KEY = "sk-proj-rat-bi-mat-1234567890"


def test_luu_key_roi_chi_tra_ban_che(client):
    response = client.put("/credentials/openai", json={"api_key": SECRET_KEY})

    assert response.status_code == 200
    body = response.text
    assert SECRET_KEY not in body, "Key gốc bị lộ trong response"

    openai = _find(response.json()["credentials"], "openai")
    assert openai["masked_key"] == "sk-proj-••••7890"
    assert openai["is_configured"] is True
    assert openai["key_source"] == "ui"
    assert openai["can_delete"] is True


def test_doc_lai_van_khong_lo_key(client):
    client.put("/credentials/openai", json={"api_key": SECRET_KEY})

    response = client.get("/credentials")

    assert SECRET_KEY not in response.text


def test_settings_cung_khong_lo_key(client):
    """Kiểm cả endpoint khác, không chỉ /credentials."""
    client.put("/credentials/gemini", json={"api_key": SECRET_KEY})

    response = client.get("/settings")

    assert SECRET_KEY not in response.text


def test_luu_kem_model_va_endpoint(client):
    response = client.put(
        "/credentials/custom",
        json={
            "api_key": SECRET_KEY,
            "model_name": "my-vlm",
            "endpoint": "https://vlm.noi-bo/v1",
        },
    )

    custom = _find(response.json()["credentials"], "custom")
    assert custom["model_name"] == "my-vlm"
    assert custom["endpoint"] == "https://vlm.noi-bo/v1"


def test_custom_thieu_endpoint_thi_tu_choi(client):
    response = client.put("/credentials/custom", json={"api_key": SECRET_KEY})

    assert response.status_code == 400
    assert "endpoint" in response.json()["detail"].lower()


def test_builtin_khong_nhan_key(client):
    """vLLM tự host không cần xác thực."""
    response = client.put("/credentials/builtin", json={"api_key": SECRET_KEY})

    assert response.status_code == 400


def test_provider_la_bao_loi(client):
    response = client.put("/credentials/khong-ton-tai", json={"api_key": SECRET_KEY})

    assert response.status_code == 400


def test_key_qua_ngan_bi_chan(client):
    response = client.put("/credentials/openai", json={"api_key": "ngan"})

    assert response.status_code == 422


def test_xoa_key(client):
    client.put("/credentials/openai", json={"api_key": SECRET_KEY})

    response = client.delete("/credentials/openai")

    assert response.status_code == 200
    openai = _find(response.json()["credentials"], "openai")
    assert openai["masked_key"] is None


def test_xoa_key_chua_co_thi_404(client):
    response = client.delete("/credentials/openai")

    assert response.status_code == 404
    assert ".env" in response.json()["detail"]


def test_bao_trang_thai_ma_hoa(client):
    response = client.get("/credentials")

    assert response.json()["encryption_enabled"] is True


def test_key_tu_env_khong_xoa_duoc_qua_api(client):
    """GEMINI_API_KEY đến từ .env nên can_delete phải là False."""
    gemini = _find(client.get("/credentials").json()["credentials"], "gemini")

    assert gemini["is_configured"] is True
    assert gemini["key_source"] == "env"
    assert gemini["can_delete"] is False


def _find(credentials: list[dict], provider_id: str) -> dict:
    return next(c for c in credentials if c["provider_id"] == provider_id)
