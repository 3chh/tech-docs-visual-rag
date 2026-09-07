"""Mỗi bộ tài liệu dùng được processor riêng, nhưng model thì dùng chung.

`max_num_visual_tokens` và `min_width` chỉ chạm processor (quy tắc resize ảnh
phía CPU), không chạm weights. Nên cho mỗi bộ một giá trị khác nhau phải tốn
0 VRAM thêm — nếu nạp model hai lần thì mất hẳn ý nghĩa của việc cho phép
cấu hình theo bộ.

`colpali_engine` bị stub trong conftest nên không dựng được model/processor
thật. Test này thay hai bước đó bằng đối tượng đánh dấu: đối tượng cần kiểm
là logic cache, không phải colpali-engine.
"""

import pytest


class _Model:
    """Đại diện weights. Đếm số lần nạp để phát hiện nạp trùng."""

    loads = 0

    def __init__(self, model_name: str, device: str):
        self.model_name = model_name
        self.device = device
        _Model.loads += 1


class _Processor:
    def __init__(self, model_name: str, max_num_visual_tokens, min_width):
        self.model_name = model_name
        self.max_num_visual_tokens = max_num_visual_tokens
        self.min_width = min_width


@pytest.fixture(autouse=True)
def fake_backend(monkeypatch, tmp_path):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("EMBEDDING_TYPE", "longcolqwen")
    monkeypatch.setenv("EMBEDDING_MODEL_NAME", "tsystems/colqwen2.5-3b-multilingual-v1.0")
    monkeypatch.setenv("EMBEDDING_MAX_NUM_VISUAL_TOKENS", "8192")
    monkeypatch.setenv("EMBEDDING_MIN_WIDTH", "600")
    monkeypatch.setenv("EMBEDDING_DEVICE", "cpu")

    from backend.core.config import get_settings
    from backend.embeddings import _resolve_manager_cls, reset_embedding_manager

    get_settings.cache_clear()
    reset_embedding_manager()

    cls = _resolve_manager_cls("longcolqwen")
    monkeypatch.setattr(
        cls, "load_model", classmethod(lambda c, device, model_name: _Model(model_name, device))
    )
    monkeypatch.setattr(
        cls,
        "build_processor",
        classmethod(
            lambda c, model_name, max_num_visual_tokens=None, min_width=None: _Processor(
                model_name, max_num_visual_tokens, min_width
            )
        ),
    )
    _Model.loads = 0

    yield

    reset_embedding_manager()
    get_settings.cache_clear()


def test_cung_cau_hinh_thi_dung_lai_manager():
    from backend.embeddings import get_embedding_manager

    assert get_embedding_manager() is get_embedding_manager()
    assert _Model.loads == 1


def test_khac_max_num_visual_tokens_thi_khac_processor():
    from backend.embeddings import get_embedding_manager

    a = get_embedding_manager({"max_num_visual_tokens": 8192})
    b = get_embedding_manager({"max_num_visual_tokens": 4096})

    assert a is not b
    assert a.processor is not b.processor
    assert a.processor.max_num_visual_tokens == 8192
    assert b.processor.max_num_visual_tokens == 4096


def test_nhung_van_dung_chung_model():
    """Đây là điểm chính: nạp model hai lần là tốn thêm ~7.5GB VRAM."""
    from backend.embeddings import get_embedding_manager

    a = get_embedding_manager({"max_num_visual_tokens": 8192})
    b = get_embedding_manager({"max_num_visual_tokens": 4096})

    assert a.model is b.model
    assert _Model.loads == 1, "model bị nạp nhiều lần"


def test_khac_min_width_cung_dung_chung_model():
    from backend.embeddings import get_embedding_manager

    a = get_embedding_manager({"min_width": 600})
    b = get_embedding_manager({"min_width": 800})

    assert a is not b
    assert a.model is b.model
    assert _Model.loads == 1


def test_khac_model_name_thi_nap_model_rieng():
    """Model khác nhau thì buộc phải nạp riêng — đó là lý do nó tốn VRAM."""
    from backend.embeddings import get_embedding_manager

    get_embedding_manager({"model_name": "vidore/colqwen2.5-v0.2"})
    get_embedding_manager({"model_name": "tsystems/colqwen2.5-3b-multilingual-v1.0"})

    assert _Model.loads == 2


def test_khong_truyen_gi_thi_lay_cau_hinh_server():
    from backend.embeddings import get_embedding_manager

    default = get_embedding_manager()
    explicit = get_embedding_manager(
        {
            "type": "longcolqwen",
            "model_name": "tsystems/colqwen2.5-3b-multilingual-v1.0",
            "max_num_visual_tokens": 8192,
            "min_width": 600,
        }
    )

    assert default is explicit


def test_truong_None_khong_tao_manager_moi():
    """UI gửi thiếu trường là chuyện thường, không được tách cache vì thế."""
    from backend.embeddings import get_embedding_manager

    a = get_embedding_manager()
    b = get_embedding_manager({"max_num_visual_tokens": None, "min_width": None})

    assert a is b


def test_dict_rong_giong_nhu_khong_truyen():
    from backend.embeddings import get_embedding_manager

    assert get_embedding_manager({}) is get_embedding_manager()
