"""Test luồng hỏi–đáp, đặc biệt là bước viết lại câu hỏi theo mục lục."""

from unittest.mock import MagicMock

import pytest

from frontend.app.api_client import BackendError
from frontend.app.services.chat import ChatService


@pytest.fixture
def backend():
    client = MagicMock()
    client.search_by_section_title.return_value = {
        "results": [{"image_path": "/data/toc_0.png"}, {"image_path": "/data/toc_1.png"}]
    }
    client.search_documents.return_value = {
        "results": [{"image_path": "/data/section_01.png"}]
    }
    return client


@pytest.fixture
def rag():
    client = MagicMock()
    client.get_answer.side_effect = [
        "<query>鋼部材の座屈</query>",  # lần 1: viết lại câu hỏi
        "Câu trả lời từ tài liệu.",     # lần 2: trả lời thật
    ]
    return client


def test_giu_ca_cau_goc_khi_viet_lai(backend, rag):
    """Câu viết lại có thể lệch ý, nên nối với câu gốc thay vì thay thế."""
    service = ChatService(backend, rag)

    service.answer("buckling of steel", "demo")

    search_query = backend.search_documents.call_args[1]["query"]
    assert "buckling of steel" in search_query
    assert "鋼部材の座屈" in search_query


def test_bo_qua_viet_lai_khi_tat(backend, rag):
    rag.get_answer.side_effect = ["Trả lời."]
    service = ChatService(backend, rag)

    service.answer("câu hỏi", "demo", use_toc_rewrite=False)

    backend.search_by_section_title.assert_not_called()
    assert backend.search_documents.call_args[1]["query"] == "câu hỏi"


def test_dung_cau_goc_khi_khong_lay_duoc_muc_luc(backend, rag):
    backend.search_by_section_title.side_effect = BackendError("mất kết nối")
    rag.get_answer.side_effect = ["Trả lời."]
    service = ChatService(backend, rag)

    images, answer = service.answer("câu hỏi", "demo")

    assert backend.search_documents.call_args[1]["query"] == "câu hỏi"
    assert answer == "Trả lời."


def test_dung_cau_goc_khi_phan_hoi_thieu_the_query(backend, rag):
    rag.get_answer.side_effect = ["không có thẻ nào ở đây", "Trả lời."]
    service = ChatService(backend, rag)

    service.answer("câu hỏi", "demo")

    assert backend.search_documents.call_args[1]["query"] == "câu hỏi"


def test_khong_tim_thay_thi_khong_goi_VLM(backend, rag):
    backend.search_documents.return_value = {"results": []}
    service = ChatService(backend, rag)

    images, answer = service.answer("câu hỏi", "demo")

    assert images == []
    assert "Không tìm thấy" in answer
    # get_answer chỉ được gọi 1 lần cho bước viết lại, không gọi cho bước trả lời
    assert rag.get_answer.call_count == 1


def test_tra_ve_duong_dan_anh_muc(backend, rag):
    service = ChatService(backend, rag)

    images, answer = service.answer("câu hỏi", "demo")

    assert images == ["/data/section_01.png"]
    assert answer == "Câu trả lời từ tài liệu."


def test_loc_bo_duong_dan_rong(backend, rag):
    backend.search_documents.return_value = {
        "results": [{"image_path": ""}, {"image_path": "/data/ok.png"}]
    }
    service = ChatService(backend, rag)

    images, _ = service.answer("câu hỏi", "demo")

    assert images == ["/data/ok.png"]
