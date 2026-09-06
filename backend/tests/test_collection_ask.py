"""Mặc định hỏi đáp lưu theo từng bộ tài liệu.

Bộ QCVN scan cần `top_k` và system prompt khác bộ PDF số hoá sạch, nên đây là
cấu hình của bộ chứ không phải hằng số của server.

Điểm khó: `AskRequest` từng đặt `top_k=5`, `use_toc_rewrite=True` làm mặc
định, mà đó là giá trị THẬT nên server không phân biệt được "client không nói
gì" với "client chọn đúng bằng mặc định" — cấu hình bộ không bao giờ có cơ hội
áp. Vì vậy các trường này phải Optional/None.
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


def _setup_collection(client, name: str, ask: dict) -> None:
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
            "ask": ask,
        },
    )
    assert response.status_code == 201, response.text


@pytest.fixture
def captured_ask(monkeypatch):
    """Quan sát tham số ĐÃ giải mặc định, bằng cách chặn các collaborator.

    Không chặn RagService.ask: chính nó chứa logic giải mặc định, chặn nó là
    test rỗng.
    """
    captured: dict = {}

    from backend.app.services import rag as rag_module

    retrieval = MagicMock()
    retrieval.search.return_value = [[{"image_path": "/khong-ton-tai.jpg"}]]
    monkeypatch.setattr(rag_module, "RetrievalService", lambda *a, **k: retrieval)
    captured["retrieval"] = retrieval

    def fake_rewrite(self, query, toc_preview_limit=None):
        captured["rewrite_called"] = True
        captured["toc_preview_limit"] = toc_preview_limit
        return query, None

    monkeypatch.setattr(rag_module.RagService, "rewrite_query", fake_rewrite)

    def fake_ask_vlm(self, prompt, image_paths, system_prompt, temperature=None):
        captured["system_prompt"] = system_prompt
        captured["vlm_temperature"] = temperature
        return "xong"

    monkeypatch.setattr(rag_module.RagService, "_ask_vlm", fake_ask_vlm)

    return captured


def _top_k_used(captured) -> int:
    """top_k mà RagService thực sự truyền cho tầng truy xuất."""
    return captured["retrieval"].search.call_args[0][1]


def _ask(client, collection: str, **body):
    return client.post("/ask", json={"query": "câu hỏi", "user_id": collection, **body})


# --- lưu và đọc lại cấu hình ------------------------------------------------


def test_tao_bo_luu_duoc_mac_dinh_hoi_dap(client):
    _setup_collection(client, "bo-ask", {"top_k": 12, "use_toc_rewrite": False})

    body = client.get("/collections/bo-ask").json()

    assert body["ask"] == {"top_k": 12, "use_toc_rewrite": False}


def test_sua_duoc_mac_dinh_hoi_dap(client):
    _setup_collection(client, "bo-sua", {"top_k": 5})

    response = client.put("/collections/bo-sua", json={"ask": {"top_k": 15}})

    assert response.status_code == 200, response.text
    assert response.json()["ask"] == {"top_k": 15}


# --- áp mặc định lúc /ask ---------------------------------------------------


def test_ask_lay_mac_dinh_cua_bo_khi_client_khong_truyen(client, captured_ask):
    _setup_collection(
        client,
        "bo-mac-dinh",
        {"top_k": 12, "use_toc_rewrite": False, "system_prompt": "Trả lời ngắn."},
    )

    response = _ask(client, "bo-mac-dinh")

    assert response.status_code == 200, response.text
    assert _top_k_used(captured_ask) == 12
    assert "rewrite_called" not in captured_ask, "bộ tắt rewrite mà vẫn gọi"
    assert captured_ask["system_prompt"] == "Trả lời ngắn."


def test_client_truyen_thi_de_len_mac_dinh_cua_bo(client, captured_ask):
    _setup_collection(client, "bo-de", {"top_k": 12})

    response = _ask(client, "bo-de", top_k=3)

    assert response.status_code == 200, response.text
    assert _top_k_used(captured_ask) == 3


def test_top_k_bang_5_van_de_len_duoc_mac_dinh_cua_bo(client, captured_ask):
    """Nếu 5 là mặc định cứng của schema thì không phân biệt được với "không
    truyền", và cấu hình bộ sẽ bị bỏ qua."""
    _setup_collection(client, "bo-nam", {"top_k": 12})

    response = _ask(client, "bo-nam", top_k=5)

    assert response.status_code == 200, response.text
    assert _top_k_used(captured_ask) == 5, "client nói 5 thì phải là 5, không phải 12"


def test_bo_khong_cau_hinh_ask_thi_dung_mac_dinh_server(client, captured_ask):
    _setup_collection(client, "bo-trong", {})

    response = _ask(client, "bo-trong")

    assert response.status_code == 200, response.text
    assert _top_k_used(captured_ask) == 5
    assert captured_ask.get("rewrite_called") is True


def test_gia_tri_ask_vo_ly_bi_tu_choi(client):
    """Validate lúc lưu, không để phát hiện lúc tra cứu."""
    response = client.post(
        "/connections",
        json={
            "name": "m",
            "provider": "openai",
            "model_name": "gpt-4o",
            "capabilities": ["vlm", "llm"],
            "api_key": SECRET_KEY,
        },
    )
    connection_id = response.json()["connections"][0]["id"]

    response = client.post(
        "/collections",
        json={
            "name": "bo-sai",
            "vlm_connection_id": connection_id,
            "llm_connection_id": connection_id,
            "ask": {"top_k": 999},
        },
    )

    assert response.status_code == 422
