"""Cấu hình đã lưu của bộ phải được ÁP khi index, không chỉ nằm đó.

Trước đây `CollectionConfig.processing` được lưu và trả lại qua API, nhưng
`upload_files` dựng `ProcessingOverrides` hoàn toàn từ metadata client gửi
kèm từng file, nên cấu hình của bộ là dữ liệu chết. Đây là test cho hợp đồng
"cấu hình bộ làm nền, override từng file đè lên".
"""

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

SECRET_KEY = "sk-proj-rat-bi-mat-1234567890"


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("METADATA_DIR", str(tmp_path / "metadata"))
    monkeypatch.setenv("CREDENTIALS_SECRET", "test-secret")
    monkeypatch.delenv("DEFAULT_VLM_PROVIDER", raising=False)

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


def _setup_collection(client, name: str, processing: dict) -> None:
    """Tạo kết nối đa năng rồi tạo bộ với `processing` cho trước."""
    response = client.post(
        "/connections",
        json={
            "name": f"model-{name}",
            "provider": "openai",
            "model_name": "gpt-4o",
            "capabilities": ["vlm", "llm"],
            "api_key": SECRET_KEY,
        },
    )
    assert response.status_code == 201, response.text
    connection_id = response.json()["connections"][0]["id"]

    response = client.post(
        "/collections",
        json={
            "name": name,
            "vlm_connection_id": connection_id,
            "llm_connection_id": connection_id,
            "processing": processing,
        },
    )
    assert response.status_code == 201, response.text


@pytest.fixture
def captured_worker_config(monkeypatch):
    """Bắt custom_config mà IndexingService gửi cho worker."""
    captured: dict = {}

    from backend.app.services import indexing as indexing_module

    def fake_call_worker(self, media_dir, pdf_path, custom_config):
        captured.clear()
        captured.update(custom_config or {})
        return []

    monkeypatch.setattr(
        indexing_module.IndexingService, "_call_worker", fake_call_worker
    )
    monkeypatch.setattr(
        indexing_module, "get_vector_manager", lambda *a, **k: MagicMock()
    )

    emb = MagicMock()
    emb.process_images.return_value = ([], [], [])
    monkeypatch.setattr(indexing_module, "get_embedding_manager", lambda: emb)

    return captured


# --- deep_merge -------------------------------------------------------------


def test_merge_tron_dict_long_nhau():
    from backend.core.merge import deep_merge

    base = {"preprocess": {"padding": 10, "pdf_to_image": {"dpi": 300}}}
    override = {"preprocess": {"pdf_to_image": {"dpi": 400}}}

    assert deep_merge(base, override) == {
        "preprocess": {"padding": 10, "pdf_to_image": {"dpi": 400}}
    }


def test_merge_none_khong_xoa_gia_tri_da_luu():
    """None nghĩa là "không nói gì", không phải "đặt về rỗng".

    Client gửi thiếu trường thì phải giữ cấu hình của bộ, nếu không mỗi lần
    upload là mất cấu hình.
    """
    from backend.core.merge import deep_merge

    base = {"chunking": {"min_section_height_px": 50}}

    assert deep_merge(base, {"chunking": {"min_section_height_px": None}}) == base
    assert deep_merge(base, {"chunking": None}) == base


def test_merge_khong_sua_dict_goc():
    from backend.core.merge import deep_merge

    base = {"layout": {"batch_size": 8}}
    deep_merge(base, {"layout": {"batch_size": 16}})

    assert base == {"layout": {"batch_size": 8}}, "deep_merge đã sửa base"


# --- áp cấu hình bộ lúc index ----------------------------------------------


def test_cau_hinh_bo_duoc_gui_cho_worker(client, captured_worker_config):
    _setup_collection(
        client,
        "bo-scan",
        {
            "preprocess": {"pdf_to_image": {"dpi": 400}},
            "chunking": {"min_section_height_px": 80},
        },
    )

    response = client.post(
        "/upload_files",
        files={"files": ("a.pdf", b"%PDF-1.4 fake", "application/pdf")},
        data={"user_id": "bo-scan", "db_name": "bo-scan", "metadata": "[{}]"},
    )

    assert response.status_code == 200, response.text
    assert captured_worker_config["preprocess"]["pdf_to_image"]["dpi"] == 400
    assert captured_worker_config["chunking"]["min_section_height_px"] == 80


def test_override_tung_file_de_len_cau_hinh_bo(client, captured_worker_config):
    _setup_collection(client, "bo-tron", {"preprocess": {"pdf_to_image": {"dpi": 400}}})

    response = client.post(
        "/upload_files",
        files={"files": ("a.pdf", b"%PDF-1.4 fake", "application/pdf")},
        data={
            "user_id": "bo-tron",
            "db_name": "bo-tron",
            "metadata": '[{"preprocess": {"pdf_to_image": {"dpi": 600}}}]',
        },
    )

    assert response.status_code == 200, response.text
    assert captured_worker_config["preprocess"]["pdf_to_image"]["dpi"] == 600


def test_vertical_split_cua_bo_khong_bi_mac_dinh_ghi_de(client, captured_worker_config):
    """Route từng đặt vertical_split=False mặc định, ghi đè cấu hình bộ."""
    _setup_collection(client, "bo-doc", {"vertical_split": True})

    response = client.post(
        "/upload_files",
        files={"files": ("a.pdf", b"%PDF-1.4 fake", "application/pdf")},
        data={"user_id": "bo-doc", "db_name": "bo-doc", "metadata": "[{}]"},
    )

    assert response.status_code == 200, response.text
    assert captured_worker_config["vertical_split"] is True


def test_toc_validator_van_lay_endpoint_tu_ket_noi(client, captured_worker_config):
    """Trộn cấu hình bộ không được làm mất endpoint/key giải từ kết nối."""
    _setup_collection(client, "bo-toc", {"toc_validator": {"temperature": 0.9}})

    client.post(
        "/upload_files",
        files={"files": ("a.pdf", b"%PDF-1.4 fake", "application/pdf")},
        data={"user_id": "bo-toc", "db_name": "bo-toc", "metadata": "[{}]"},
    )

    toc = captured_worker_config["toc_validator"]
    assert toc["temperature"] == 0.9
    assert toc["api_key"] == SECRET_KEY
    assert "api.openai.com" in toc["endpoint"]


def test_bo_doi_duoc_model_sua_muc_luc_nhung_khong_doi_duoc_key(
    client, captured_worker_config
):
    """Dùng model rẻ hơn cho việc sửa mục lục là hợp lý và cho phép.

    Nhưng endpoint và key là thông tin xác thực từ kho kết nối, cấu hình bộ
    không được ghi đè — nếu không thì người tạo bộ trỏ được key sang server lạ.
    """
    _setup_collection(
        client,
        "bo-model-re",
        {
            "toc_validator": {
                "model_name": "gpt-4o-mini",
                "endpoint": "http://server-la/v1",
                "api_key": "key-gia",
            }
        },
    )

    client.post(
        "/upload_files",
        files={"files": ("a.pdf", b"%PDF-1.4 fake", "application/pdf")},
        data={"user_id": "bo-model-re", "db_name": "bo-model-re", "metadata": "[{}]"},
    )

    toc = captured_worker_config["toc_validator"]
    assert toc["model_name"] == "gpt-4o-mini", "bộ phải đổi được model"
    assert "server-la" not in toc["endpoint"], "bộ KHÔNG được đổi endpoint"
    assert toc["api_key"] == SECRET_KEY, "bộ KHÔNG được đổi key"
