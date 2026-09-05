"""Test client HTTP — dùng mock, không cần backend chạy thật."""

from unittest.mock import MagicMock, patch

import pytest

from frontend.app.api_client import BackendClient, BackendError


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("BACKEND_URL", "http://test-backend:8000")
    import frontend.app.config as config_module

    config_module._config = None
    return BackendClient()


def _ok_response(payload):
    response = MagicMock()
    response.ok = True
    response.json.return_value = payload
    return response


def test_base_url_bo_dau_gach_cuoi(monkeypatch):
    monkeypatch.setenv("BACKEND_URL", "http://x:8000/")
    import frontend.app.config as config_module

    config_module._config = None

    assert BackendClient().base_url == "http://x:8000"


def test_search_co_anh_goi_dung_endpoint(client):
    with patch("frontend.app.api_client.requests.post") as post:
        post.return_value = _ok_response({"results": []})

        client.search_documents("câu hỏi", "demo", top_k=3, include_images=True)

        url = post.call_args[0][0]
        payload = post.call_args[1]["json"]
        assert url.endswith("/search_with_images")
        assert payload == {
            "query": "câu hỏi",
            "user_id": "demo",
            "top_k": 3,
            "include_base64": True,
        }


def test_search_khong_anh_goi_endpoint_nhe(client):
    with patch("frontend.app.api_client.requests.post") as post:
        post.return_value = _ok_response({"results": []})

        client.search_documents("q", "demo", include_images=False)

        assert post.call_args[0][0].endswith("/search")
        assert "include_base64" not in post.call_args[1]["json"]


def test_loi_ket_noi_thanh_BackendError(client):
    import requests

    with patch("frontend.app.api_client.requests.post") as post:
        post.side_effect = requests.exceptions.ConnectionError()

        with pytest.raises(BackendError, match="Không kết nối được"):
            client.search_documents("q", "demo")


def test_timeout_thanh_BackendError(client):
    import requests

    with patch("frontend.app.api_client.requests.post") as post:
        post.side_effect = requests.exceptions.Timeout()

        with pytest.raises(BackendError, match="quá thời gian chờ"):
            client.search_documents("q", "demo")


def test_http_loi_thanh_BackendError(client):
    response = MagicMock()
    response.ok = False
    response.status_code = 500
    response.text = "internal error"

    with patch("frontend.app.api_client.requests.post", return_value=response):
        with pytest.raises(BackendError, match="500"):
            client.search_documents("q", "demo")


def test_health_check_false_khi_khong_ket_noi(client):
    import requests

    with patch("frontend.app.api_client.requests.get") as get:
        get.side_effect = requests.exceptions.ConnectionError()

        assert client.health_check() is False


def test_toc_404_tra_None(client):
    response = MagicMock()
    response.status_code = 404

    with patch("frontend.app.api_client.requests.get", return_value=response):
        assert client.get_table_of_contents("khong-co") is None
