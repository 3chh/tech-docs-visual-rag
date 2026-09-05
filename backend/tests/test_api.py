"""Test hợp đồng API — path và shape response phải giữ nguyên cho client cũ."""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(api_env):
    from backend.app.main import app

    return TestClient(app)


def test_health(client):
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["service"] == "cosmo-chatpdf-backend"


@pytest.mark.parametrize(
    ("path", "method"),
    [
        ("/health", "get"),
        ("/search", "post"),
        ("/search_with_images", "post"),
        ("/search_by_section_title", "post"),
        ("/index", "post"),
        ("/upload_files", "post"),
        ("/list_collections/{user_id}", "get"),
        ("/table_of_contents", "get"),
        # Endpoint tương thích ngược với client cũ
        ("/search_default", "post"),
        ("/search_default_base64", "post"),
        ("/ask", "post"),
    ],
)
def test_endpoint_ton_tai(client, path, method):
    """Mọi endpoint của bản gốc phải còn nguyên."""
    schema = client.app.openapi()

    assert path in schema["paths"], f"Thiếu endpoint {path}"
    assert method in schema["paths"][path], f"{path} thiếu method {method}"


def test_openapi_sinh_duoc(client):
    """Bản gốc dựng SearchResult sai field nên schema không sinh được."""
    schema = client.app.openapi()

    assert schema["info"]["title"] == "Cosmo ChatPDF API"
    assert len(schema["paths"]) >= 9


def test_search_result_giu_dung_field(client):
    """agent bên ngoài đang đọc các field này — đổi tên là phá client."""
    schema = client.app.openapi()
    props = schema["components"]["schemas"]["SearchResult"]["properties"]

    for field in (
        "section_title",
        "formulas",
        "section_pages",
        "ancestors",
        "metadata",
        "image_path",
        "image_base64",
        "chunk_images",
    ):
        assert field in props, f"SearchResult thiếu field {field}"


def test_search_response_giu_dung_field(client):
    schema = client.app.openapi()
    props = schema["components"]["schemas"]["SearchResponse"]["properties"]

    for field in ("user_id", "query", "top_k", "results", "total_results"):
        assert field in props, f"SearchResponse thiếu field {field}"


def test_toc_chua_sinh_tra_404(client):
    response = client.get("/table_of_contents", params={"collection_name": "khong-co"})

    assert response.status_code == 404


def test_toc_doc_duoc_sau_khi_sinh(client, api_env):
    import json

    collection = api_env / "demo"
    book = collection / "0"
    book.mkdir(parents=True)
    (book / "summary_report.json").write_text(
        json.dumps({"total_pages": 5, "total_sections": 1, "sections": [{"title": "1.1 Test"}]}),
        encoding="utf-8",
    )

    generated = client.post("/table_of_contents/regenerate", params={"collection_name": "demo"})
    assert generated.status_code == 200

    response = client.get("/table_of_contents", params={"collection_name": "demo"})
    assert response.status_code == 200
    assert response.json()["total_books"] == 1


def test_query_rong_bi_tu_choi(client):
    """top_k ngoài khoảng cho phép phải bị validate chặn."""
    response = client.post("/search", json={"query": "test", "user_id": "x", "top_k": 0})

    assert response.status_code == 422


def test_ask_endpoint_ton_tai(client):
    """VLM chạy phía backend nên frontend không giữ API key."""
    schema = client.app.openapi()

    assert "/ask" in schema["paths"]
    assert "post" in schema["paths"]["/ask"]


def test_ask_response_co_cau_hoi_da_viet_lai(client):
    schema = client.app.openapi()
    props = schema["components"]["schemas"]["AskResponse"]["properties"]

    for field in ("query", "answer", "rewritten_query", "sources", "total_sources"):
        assert field in props, f"AskResponse thiếu field {field}"


def test_ask_tu_choi_query_rong(client):
    response = client.post("/ask", json={"query": "", "user_id": "x"})

    assert response.status_code == 422
