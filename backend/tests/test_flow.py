"""Test luồng bắt buộc: cấu hình mô hình -> tạo bộ -> mới thêm được tài liệu.

Đây là ràng buộc thiết kế chính: không có key mặc định từ biến môi trường,
nên người dùng phải tự cấu hình trước khi làm được gì.
"""

import pytest
from fastapi.testclient import TestClient

SECRET_KEY = "sk-proj-rat-bi-mat-1234567890"


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("METADATA_DIR", str(tmp_path / "metadata"))
    monkeypatch.setenv("CREDENTIALS_SECRET", "test-secret")
    # Không đặt GEMINI_API_KEY hay OPENAI_API_KEY: đó chính là điểm của flow mới.
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    from backend.core.config import get_settings
    from backend.core.connections import reset_connection_store
    from backend.core.crypto import reset_crypto

    get_settings.cache_clear()
    reset_connection_store()
    reset_crypto()

    from backend.app.main import app

    yield TestClient(app)

    reset_connection_store()
    reset_crypto()
    get_settings.cache_clear()


def _create_connection(client, name: str, capabilities: list[str], provider="openai"):
    response = client.post(
        "/connections",
        json={
            "name": name,
            "provider": provider,
            "model_name": "gpt-4o",
            "capabilities": capabilities,
            "api_key": SECRET_KEY,
        },
    )
    assert response.status_code == 201, response.text
    return next(
        c for c in response.json()["connections"] if c["name"] == name
    )["id"]


# --- Trạng thái ban đầu ----------------------------------------------------


def test_ban_dau_chua_co_ket_noi_nao(client):
    response = client.get("/connections")

    assert response.status_code == 200
    assert response.json()["connections"] == []


def test_ban_dau_chua_tao_duoc_bo(client):
    """UI dùng can_create để dẫn người dùng sang phần Cấu hình."""
    response = client.get("/collections")

    assert response.json()["can_create"] is False
    assert response.json()["missing_capabilities"] == ["vlm", "llm"]
    assert response.json()["collections"] == []


def test_service_van_len_duoc_khi_chua_co_key(client):
    """Nếu service không lên thì không ai vào được giao diện để nhập key."""
    assert client.get("/health").status_code == 200
    assert client.get("/settings").status_code == 200


# --- Bước 1: cấu hình kết nối ---------------------------------------------


def test_tao_ket_noi_chi_tra_ban_che(client):
    response = client.post(
        "/connections",
        json={
            "name": "GPT-4o của team",
            "provider": "openai",
            "model_name": "gpt-4o",
            "capabilities": ["vlm", "llm"],
            "api_key": SECRET_KEY,
        },
    )

    assert response.status_code == 201
    assert SECRET_KEY not in response.text, "Key gốc bị lộ trong response"

    connection = response.json()["connections"][0]
    assert connection["masked_key"] == "sk-proj-••••7890"
    assert connection["has_key"] is True
    assert connection["capabilities"] == ["vlm", "llm"]


def test_endpoint_tu_dien_theo_nha_cung_cap(client):
    _create_connection(client, "Gemini", ["vlm", "llm"], provider="gemini")

    connection = client.get("/connections").json()["connections"][0]

    assert "generativelanguage.googleapis.com" in connection["endpoint"]


def test_vllm_khong_can_key(client):
    response = client.post(
        "/connections",
        json={
            "name": "vLLM nội bộ",
            "provider": "vllm",
            "model_name": "InternVL3-8B",
            "capabilities": ["vlm"],
        },
    )

    assert response.status_code == 201
    assert response.json()["connections"][0]["has_key"] is False


def test_nha_cung_cap_ngoai_bat_buoc_co_key(client):
    response = client.post(
        "/connections",
        json={
            "name": "OpenAI thiếu key",
            "provider": "openai",
            "model_name": "gpt-4o",
            "capabilities": ["vlm"],
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "missing_api_key"


def test_custom_bat_buoc_co_endpoint(client):
    response = client.post(
        "/connections",
        json={
            "name": "Custom thiếu endpoint",
            "provider": "custom",
            "model_name": "my-vlm",
            "capabilities": ["vlm"],
            "api_key": SECRET_KEY,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "missing_endpoint"


def test_ten_ket_noi_phai_duy_nhat(client):
    _create_connection(client, "Trùng tên", ["vlm"])

    response = client.post(
        "/connections",
        json={
            "name": "trùng TÊN",
            "provider": "openai",
            "model_name": "gpt-4o",
            "capabilities": ["vlm"],
            "api_key": SECRET_KEY,
        },
    )

    assert response.status_code == 409


def test_cap_nhat_khong_truyen_key_thi_giu_key_cu(client):
    connection_id = _create_connection(client, "Đổi tên thôi", ["vlm"])

    response = client.put(f"/connections/{connection_id}", json={"name": "Tên mới"})

    assert response.status_code == 200
    connection = response.json()["connections"][0]
    assert connection["name"] == "Tên mới"
    assert connection["has_key"] is True


def test_them_nhieu_ket_noi(client):
    """Người dùng thêm nhiều mô hình rồi chọn cho từng bộ."""
    _create_connection(client, "GPT-4o", ["vlm", "llm"])
    _create_connection(client, "Gemini Flash", ["vlm", "llm"], provider="gemini")

    connections = client.get("/connections").json()["connections"]

    assert len(connections) == 2


# --- Bước 2: tạo bộ tài liệu ----------------------------------------------


def test_co_ket_noi_thi_tao_duoc_bo(client):
    _create_connection(client, "Đa năng", ["vlm", "llm"])

    assert client.get("/collections").json()["can_create"] is True


def test_tao_bo_voi_hai_ket_noi(client):
    vlm_id = _create_connection(client, "VLM riêng", ["vlm"])
    llm_id = _create_connection(client, "LLM riêng", ["llm"])

    response = client.post(
        "/collections",
        json={
            "name": "quy-chuan-xay-dung",
            "vlm_connection_id": vlm_id,
            "llm_connection_id": llm_id,
            "description": "QCVN ngành xây dựng",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "quy-chuan-xay-dung"
    assert body["is_ready"] is True


def test_chua_co_mo_hinh_nao_thi_bao_dieu_huong(client):
    """409 + mã riêng để UI mở popup dẫn sang Cấu hình, không báo lỗi tại field."""
    response = client.post(
        "/collections",
        json={
            "name": "bo-som",
            "vlm_connection_id": "bat-ky",
            "llm_connection_id": "bat-ky",
        },
    )

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "no_models_configured"
    assert detail["missing_capabilities"] == ["vlm", "llm"]


def test_thieu_mot_loai_thi_bao_ro_thieu_loai_nao(client):
    """Có LLM nhưng chưa có VLM: vẫn phải sang Cấu hình, và nói rõ thiếu VLM."""
    llm_id = _create_connection(client, "Chỉ LLM", ["llm"])

    response = client.post(
        "/collections",
        json={
            "name": "bo-thieu-vlm",
            "vlm_connection_id": llm_id,
            "llm_connection_id": llm_id,
        },
    )

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "no_models_configured"
    assert detail["missing_capabilities"] == ["vlm"]


def test_du_hai_loai_nhung_chon_sai_thi_bao_tai_field(client):
    """Đủ mô hình rồi thì lỗi chọn sai là lỗi field, không phải lỗi điều hướng."""
    _create_connection(client, "VLM thật", ["vlm"])
    llm_only = _create_connection(client, "Chỉ LLM", ["llm"])

    response = client.post(
        "/collections",
        json={
            "name": "bo-loi",
            "vlm_connection_id": llm_only,
            "llm_connection_id": llm_only,
        },
    )

    assert response.status_code == 400
    detail = response.json()["detail"]
    assert detail["code"] == "connection_invalid"
    assert "vlm" in detail["message"].lower()


def test_ket_noi_khong_ton_tai_thi_tu_choi(client):
    _create_connection(client, "VLM thật", ["vlm"])
    llm_id = _create_connection(client, "LLM", ["llm"])

    response = client.post(
        "/collections",
        json={
            "name": "bo-loi",
            "vlm_connection_id": "khong-ton-tai",
            "llm_connection_id": llm_id,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "connection_invalid"


@pytest.mark.parametrize("name", ["có dấu", "ten/co/slash", "-batdaubangdau", "", "a" * 64])
def test_ten_bo_khong_hop_le(client, name):
    connection_id = _create_connection(client, "Đa năng", ["vlm", "llm"])

    response = client.post(
        "/collections",
        json={
            "name": name,
            "vlm_connection_id": connection_id,
            "llm_connection_id": connection_id,
        },
    )

    assert response.status_code == 422


def test_ten_bo_trung_thi_tu_choi(client):
    connection_id = _create_connection(client, "Đa năng", ["vlm", "llm"])
    payload = {
        "name": "bo-trung",
        "vlm_connection_id": connection_id,
        "llm_connection_id": connection_id,
    }
    client.post("/collections", json=payload)

    assert client.post("/collections", json=payload).status_code == 409


# --- Bước 3: gate index ---------------------------------------------------


def test_chua_cau_hinh_bo_thi_khong_index_duoc(client):
    """Chặn ngay thay vì để người dùng chờ 20 phút rồi mới báo lỗi."""
    response = client.post(
        "/upload_files",
        files={"files": ("test.pdf", b"%PDF-1.4 fake", "application/pdf")},
        data={"user_id": "chua-cau-hinh", "db_name": "chua-cau-hinh", "metadata": "[{}]"},
    )

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "collection_not_configured"
    assert "chưa được cấu hình" in detail["message"]


def test_chua_cau_hinh_bo_thi_khong_hoi_duoc(client):
    response = client.post("/ask", json={"query": "câu hỏi", "user_id": "chua-cau-hinh"})

    assert response.status_code == 400
    assert "chưa được cấu hình" in response.json()["detail"]["message"]


# --- Xoá kết nối đang được dùng -------------------------------------------


def test_xoa_ket_noi_thi_bo_bao_chua_san_sang(client):
    """Không tự dọn hộ: người dùng có thể muốn trỏ sang kết nối khác."""
    connection_id = _create_connection(client, "Sẽ bị xoá", ["vlm", "llm"])
    client.post(
        "/collections",
        json={
            "name": "bo-mo-coi",
            "vlm_connection_id": connection_id,
            "llm_connection_id": connection_id,
        },
    )

    client.delete(f"/connections/{connection_id}")

    collection = client.get("/collections/bo-mo-coi").json()
    assert collection["is_ready"] is False
    assert "không còn tồn tại" in collection["blocked_reason"]


def test_doi_ket_noi_cho_bo(client):
    old_id = _create_connection(client, "Cũ", ["vlm", "llm"])
    new_id = _create_connection(client, "Mới", ["vlm", "llm"])
    client.post(
        "/collections",
        json={
            "name": "bo-doi-model",
            "vlm_connection_id": old_id,
            "llm_connection_id": old_id,
        },
    )

    response = client.put(
        "/collections/bo-doi-model", json={"vlm_connection_id": new_id}
    )

    assert response.status_code == 200
    assert response.json()["vlm_connection_id"] == new_id
    assert response.json()["is_ready"] is True


def test_key_khong_lo_o_bat_ky_endpoint_nao(client):
    connection_id = _create_connection(client, "Kiểm rò rỉ", ["vlm", "llm"])
    client.post(
        "/collections",
        json={
            "name": "bo-kiem",
            "vlm_connection_id": connection_id,
            "llm_connection_id": connection_id,
        },
    )

    for path in ("/connections", "/collections", "/collections/bo-kiem", "/settings"):
        assert SECRET_KEY not in client.get(path).text, f"Key bị lộ ở {path}"


def test_settings_bao_trang_thai_theo_kho_ket_noi(client):
    """Không lấy từ env nữa: bỏ key khỏi .env rồi thì env luôn rỗng."""
    before = client.get("/settings").json()["models"]
    assert before["vlm"]["api_key_configured"] is False
    assert before["llm"]["api_key_configured"] is False

    _create_connection(client, "Đa năng", ["vlm", "llm"])

    after = client.get("/settings").json()["models"]
    assert after["vlm"]["api_key_configured"] is True
    assert after["llm"]["api_key_configured"] is True
