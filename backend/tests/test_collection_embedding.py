"""Cấu hình embedding thuộc về từng bộ tài liệu và ĐÓNG BĂNG sau khi tạo.

Vì sao theo bộ: vector chỉ so được với vector cùng tham số, mà mỗi bộ là một
collection riêng trong Qdrant và không bao giờ so với bộ khác. Nên ràng buộc
"cùng tham số" áp trong phạm vi một bộ, không phải toàn server.

Vì sao đóng băng: đổi `model_name` hay `max_num_visual_tokens` sau khi đã
index làm vector cũ và mới không so được. Trước đây các biến này chỉ nằm ở
`.env`, nên sửa `.env` rồi restart là mọi bộ đã index trả kết quả rác trong
im lặng — không có gì phát hiện ra.
"""

import pytest
from fastapi.testclient import TestClient

SECRET_KEY = "sk-proj-rat-bi-mat-1234567890"


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("METADATA_DIR", str(tmp_path / "metadata"))
    monkeypatch.setenv("CREDENTIALS_SECRET", "test-secret")
    monkeypatch.delenv("DEFAULT_VLM_PROVIDER", raising=False)
    monkeypatch.setenv("EMBEDDING_TYPE", "longcolqwen")
    monkeypatch.setenv("EMBEDDING_MODEL_NAME", "tsystems/colqwen2.5-3b-multilingual-v1.0")
    monkeypatch.setenv("EMBEDDING_MAX_NUM_VISUAL_TOKENS", "8192")
    monkeypatch.setenv("EMBEDDING_MIN_WIDTH", "600")

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


def _connection(client) -> str:
    response = client.post(
        "/connections",
        json={
            "name": "da-nang",
            "provider": "openai",
            "model_name": "gpt-4o",
            "capabilities": ["vlm", "llm"],
            "api_key": SECRET_KEY,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["connections"][0]["id"]


def _create_ok(client, name: str, embedding: dict | None = None):
    connection_id = _connection(client)
    payload = {
        "name": name,
        "vlm_connection_id": connection_id,
        "llm_connection_id": connection_id,
    }
    if embedding is not None:
        payload["embedding"] = embedding

    response = client.post("/collections", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


# --- ghi lại lúc tạo -------------------------------------------------------


def test_bo_moi_ghi_lai_cau_hinh_embedding_dang_chay(client):
    """Không truyền gì thì lấy đúng cấu hình server, và ghi lại CỤ THỂ.

    Khác `processing`/`ask` là lưu thưa: ở đây phải lưu giá trị đầy đủ, vì mục
    đích chính là đóng băng lại "vector của bộ này được tạo bằng gì".
    """
    body = _create_ok(client, "bo-ghi")

    assert body["embedding"] == {
        "type": "longcolqwen",
        "model_name": "tsystems/colqwen2.5-3b-multilingual-v1.0",
        "max_num_visual_tokens": 8192,
        "min_width": 600,
    }


def test_doc_lai_van_con_cau_hinh_embedding(client):
    _create_ok(client, "bo-doc-lai")

    body = client.get("/collections/bo-doc-lai").json()

    assert body["embedding"]["max_num_visual_tokens"] == 8192


def test_bo_chon_duoc_tham_so_khac_server(client):
    """Bộ PDF số hoá sạch không cần 8192 token mỗi trang."""
    body = _create_ok(client, "bo-nhe", {"max_num_visual_tokens": 4096})

    assert body["embedding"]["max_num_visual_tokens"] == 4096
    # Trường không truyền vẫn lấy từ server, không để trống.
    assert body["embedding"]["min_width"] == 600
    assert body["embedding"]["type"] == "longcolqwen"


def test_tham_so_vo_ly_bi_tu_choi_luc_tao(client):
    connection_id = _connection(client)

    response = client.post(
        "/collections",
        json={
            "name": "bo-sai",
            "vlm_connection_id": connection_id,
            "llm_connection_id": connection_id,
            "embedding": {"max_num_visual_tokens": 99_999_999},
        },
    )

    assert response.status_code == 422


def test_loai_embedding_khong_ton_tai_bi_tu_choi(client):
    connection_id = _connection(client)

    response = client.post(
        "/collections",
        json={
            "name": "bo-sai-loai",
            "vlm_connection_id": connection_id,
            "llm_connection_id": connection_id,
            "embedding": {"type": "khong-ton-tai"},
        },
    )

    assert response.status_code == 422


# --- đóng băng sau khi tạo -------------------------------------------------


def test_khong_sua_duoc_cau_hinh_embedding(client):
    """Sửa được thì vector cũ và mới trong cùng bộ không so được với nhau."""
    _create_ok(client, "bo-dong-bang")

    response = client.put(
        "/collections/bo-dong-bang",
        json={"embedding": {"max_num_visual_tokens": 4096}},
    )

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "embedding_immutable"
    assert "index lại" in detail["message"]


def test_sua_tham_so_khac_van_binh_thuong(client):
    """Đóng băng embedding không được làm cứng luôn những thứ khác."""
    _create_ok(client, "bo-sua-khac")

    response = client.put(
        "/collections/bo-sua-khac",
        json={"ask": {"top_k": 12}, "processing": {"chunking": {"cut_padding": 20}}},
    )

    assert response.status_code == 200, response.text
    assert response.json()["ask"]["top_k"] == 12
    assert response.json()["embedding"]["max_num_visual_tokens"] == 8192


def test_gui_lai_dung_cau_hinh_cu_thi_khong_bao_loi(client):
    """UI gửi lại nguyên payload đã đọc về là chuyện thường, đừng bắt lỗi."""
    body = _create_ok(client, "bo-gui-lai")

    response = client.put(
        "/collections/bo-gui-lai", json={"embedding": body["embedding"]}
    )

    assert response.status_code == 200, response.text


# --- phát hiện lệch cấu hình ----------------------------------------------


def test_server_doi_model_thi_bo_cu_bao_lech(client, monkeypatch):
    """Đổi EMBEDDING_MODEL_NAME trong .env rồi restart là lỗi âm thầm.

    Vector của bộ cũ được tạo bằng model khác nên không so được với truy vấn
    embed bằng model mới. Phải chặn và nói rõ, không trả kết quả rác.
    """
    _create_ok(client, "bo-lech")

    from backend.core.config import get_settings

    monkeypatch.setenv("EMBEDDING_MODEL_NAME", "vidore/colqwen2.5-v0.2")
    get_settings.cache_clear()

    body = client.get("/collections/bo-lech").json()

    assert body["is_ready"] is False
    assert "embedding" in (body["blocked_reason"] or "").lower()


def test_khong_lech_thi_bo_van_san_sang(client):
    _create_ok(client, "bo-khop")

    body = client.get("/collections/bo-khop").json()

    assert body["is_ready"] is True, body["blocked_reason"]


# --- chọn model mà server không nạp --------------------------------------


def test_khong_chon_duoc_model_server_khong_nap(client):
    """max_num_visual_tokens/min_width thì tự do, model thì không.

    Hai tham số đầu chỉ chạm processor nên nhiều bộ dùng chung một model.
    Còn `model_name` quyết định weights nào vào VRAM — cho chọn tự do nghĩa là
    một bộ mới nạp thêm ~7.5GB, và bộ đó lệch ngay với server đang chạy.
    """
    connection_id = _connection(client)

    response = client.post(
        "/collections",
        json={
            "name": "bo-model-khac",
            "vlm_connection_id": connection_id,
            "llm_connection_id": connection_id,
            "embedding": {"model_name": "vidore/colqwen2.5-v0.2"},
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "embedding_not_served"


def test_van_chon_duoc_tham_so_resize(client):
    """Hai tham số rẻ thì phải cho chọn, đó là điểm của cả tính năng này."""
    body = _create_ok(client, "bo-resize", {"max_num_visual_tokens": 4096, "min_width": 800})

    assert body["embedding"]["max_num_visual_tokens"] == 4096
    assert body["embedding"]["min_width"] == 800
    assert body["is_ready"] is True, body["blocked_reason"]


def test_index_dung_cau_hinh_embedding_cua_bo(client, monkeypatch):
    """Ghi lại 4096 mà index bằng 8192 thì bản ghi đó là lời nói dối."""
    from unittest.mock import MagicMock

    from backend.app.services import indexing as indexing_module

    seen: dict = {}

    def fake_get_embedding_manager(overrides=None):
        seen["overrides"] = overrides
        emb = MagicMock()
        emb.process_images.return_value = ([], [], [])
        return emb

    monkeypatch.setattr(
        indexing_module, "get_embedding_manager", fake_get_embedding_manager
    )
    monkeypatch.setattr(
        indexing_module, "get_vector_manager", lambda *a, **k: MagicMock()
    )
    monkeypatch.setattr(
        indexing_module.IndexingService,
        "_call_worker",
        lambda self, media_dir, pdf_path, custom_config: [],
    )

    _create_ok(client, "bo-index", {"max_num_visual_tokens": 4096})

    response = client.post(
        "/upload_files",
        files={"files": ("a.pdf", b"%PDF-1.4 fake", "application/pdf")},
        data={"user_id": "bo-index", "db_name": "bo-index", "metadata": "[{}]"},
    )

    assert response.status_code == 200, response.text
    assert seen["overrides"]["max_num_visual_tokens"] == 4096
