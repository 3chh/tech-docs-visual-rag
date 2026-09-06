"""Test kết nối vLLM tạo sẵn cho bản deploy đầy đủ.

Điểm chính: bản đầy đủ dùng được ngay sau `make deploy-full`, còn các bản
không có vLLM thì không được tự sinh kết nối trỏ vào hư không.
"""

import pytest
from fastapi.testclient import TestClient


def _fresh_app(tmp_path, monkeypatch, provider: str | None):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("METADATA_DIR", str(tmp_path / "metadata"))
    monkeypatch.setenv("CREDENTIALS_SECRET", "test-secret")
    if provider is None:
        monkeypatch.delenv("DEFAULT_VLM_PROVIDER", raising=False)
    else:
        monkeypatch.setenv("DEFAULT_VLM_PROVIDER", provider)

    from backend.core.config import get_settings
    from backend.core.connections import reset_connection_store
    from backend.core.crypto import reset_crypto

    get_settings.cache_clear()
    reset_connection_store()
    reset_crypto()

    from backend.app.main import app

    return TestClient(app)


@pytest.fixture
def cleanup():
    yield
    from backend.core.config import get_settings
    from backend.core.connections import reset_connection_store
    from backend.core.crypto import reset_crypto

    reset_connection_store()
    reset_crypto()
    get_settings.cache_clear()


def test_ban_day_du_tao_san_ket_noi_vllm(tmp_path, monkeypatch, cleanup):
    with _fresh_app(tmp_path, monkeypatch, "builtin") as client:
        connections = client.get("/connections").json()["connections"]

    assert len(connections) == 1
    builtin = connections[0]
    assert builtin["id"] == "builtin-vllm"
    assert builtin["provider"] == "vllm"
    assert builtin["endpoint"] == "http://vllm:8000/v1"
    # vLLM tự host không bật xác thực nên không có key.
    assert builtin["has_key"] is False


def test_ban_day_du_tao_duoc_bo_ngay(tmp_path, monkeypatch, cleanup):
    """Không phải cấu hình gì thêm: đó là điểm của DEFAULT_VLM_PROVIDER."""
    with _fresh_app(tmp_path, monkeypatch, "builtin") as client:
        body = client.get("/collections").json()

        assert body["can_create"] is True
        assert body["missing_capabilities"] == []

        response = client.post(
            "/collections",
            json={
                "name": "bo-mac-dinh",
                "vlm_connection_id": "builtin-vllm",
                "llm_connection_id": "builtin-vllm",
            },
        )

    assert response.status_code == 201, response.text
    assert response.json()["is_ready"] is True


def test_khong_bat_thi_khong_tao_ket_noi_nao(tmp_path, monkeypatch, cleanup):
    """Bản hybrid và demo không có vLLM: kết nối trỏ vào đó sẽ luôn timeout."""
    with _fresh_app(tmp_path, monkeypatch, None) as client:
        body = client.get("/collections").json()

        assert client.get("/connections").json()["connections"] == []
        assert body["can_create"] is False
        assert body["missing_capabilities"] == ["vlm", "llm"]


def test_seed_khong_nhan_ban_khi_khoi_dong_lai(tmp_path, monkeypatch, cleanup):
    for _ in range(3):
        with _fresh_app(tmp_path, monkeypatch, "builtin") as client:
            connections = client.get("/connections").json()["connections"]

    assert len(connections) == 1


def test_seed_khong_ghi_de_sua_doi_cua_nguoi_dung(tmp_path, monkeypatch, cleanup):
    """Người dùng đổi model đang serve thì khởi động lại không được ghi đè."""
    with _fresh_app(tmp_path, monkeypatch, "builtin") as client:
        client.put("/connections/builtin-vllm", json={"model_name": "Qwen2.5-VL-7B"})

    with _fresh_app(tmp_path, monkeypatch, "builtin") as client:
        connections = client.get("/connections").json()["connections"]

    assert connections[0]["model_name"] == "Qwen2.5-VL-7B"


def test_endpoint_va_model_doi_duoc_qua_env(tmp_path, monkeypatch, cleanup):
    monkeypatch.setenv("BUILTIN_VLM_ENDPOINT", "http://gpu-node:8000/v1")
    monkeypatch.setenv("VLM_MODEL_NAME", "OpenGVLab/InternVL3-14B")

    with _fresh_app(tmp_path, monkeypatch, "builtin") as client:
        builtin = client.get("/connections").json()["connections"][0]

    assert builtin["endpoint"] == "http://gpu-node:8000/v1"
    assert builtin["model_name"] == "OpenGVLab/InternVL3-14B"
