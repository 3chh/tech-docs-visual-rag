"""Test tham số override.

Frontend hardcode min/max khớp với schema này. Test khoá lại các khoảng để
khi backend đổi mà frontend chưa đổi thì thấy ngay.
"""

import pytest
from pydantic import ValidationError

from backend.app.schemas.overrides import (
    AskOverrides,
    ChunkingOverrides,
    LayoutOverrides,
    PdfToImageOverrides,
    PreprocessOverrides,
    ProcessingOverrides,
    TocValidatorOverrides,
)


def test_gia_tri_none_bi_bo_khoi_worker_config():
    """Chỉ gửi xuống worker những gì người dùng đổi thật."""
    overrides = ProcessingOverrides(max_pages=100)

    config = overrides.to_worker_config()

    assert config == {"max_pages": 100}
    assert "vertical_split" not in config
    assert "preprocess" not in config


def test_lồng_nhau_giữ_đúng_cấu_trúc():
    overrides = ProcessingOverrides(
        vertical_split=True,
        preprocess=PreprocessOverrides(
            padding=40,
            pdf_to_image=PdfToImageOverrides(dpi=400),
        ),
        chunking=ChunkingOverrides(cut_padding=80),
    )

    config = overrides.to_worker_config()

    assert config["vertical_split"] is True
    assert config["preprocess"]["padding"] == 40
    assert config["preprocess"]["pdf_to_image"]["dpi"] == 400
    assert config["chunking"]["cut_padding"] == 80
    # padding có, nhưng use_cut_padding không đổi nên không gửi
    assert "use_cut_padding" not in config["preprocess"]


@pytest.mark.parametrize(
    ("model", "field", "too_low", "too_high"),
    [
        (PdfToImageOverrides, "dpi", 71, 1201),
        (PdfToImageOverrides, "min_dpi", 19, 601),
        (PdfToImageOverrides, "thread_count", 0, 1025),
        (PreprocessOverrides, "padding", -1, 201),
        (PreprocessOverrides, "batch_size", 0, 129),
        (LayoutOverrides, "batch_size", 0, 257),
        (ChunkingOverrides, "cut_padding", -1, 301),
        (ChunkingOverrides, "min_section_height_px", -1, 2001),
        (TocValidatorOverrides, "temperature", -0.1, 2.1),
        (AskOverrides, "top_k", 0, 21),
        (AskOverrides, "toc_preview_limit", 0, 101),
        (AskOverrides, "vlm_temperature", -0.1, 2.1),
    ],
)
def test_khoang_gia_tri_bi_chan(model, field, too_low, too_high):
    """Khoảng này phải khớp với min/max ở frontend."""
    with pytest.raises(ValidationError):
        model(**{field: too_low})
    with pytest.raises(ValidationError):
        model(**{field: too_high})


def test_khong_cho_doi_ten_model_layout():
    """Model layout đã nạp vào VRAM nên không override được."""
    assert "model_name" not in LayoutOverrides.model_fields


def test_khong_cho_doi_tham_so_embedding():
    """Vector đã index tính theo tham số embedding; đổi thì phải index lại."""
    fields = ProcessingOverrides.model_fields
    for forbidden in ("max_num_visual_tokens", "min_width", "dim", "embedding"):
        assert forbidden not in fields


def test_toc_validator_doi_duoc_ca_model():
    """Đây chỉ là lệnh gọi API, không nạp model cục bộ."""
    overrides = TocValidatorOverrides(model_name="gemini-2.5-flash", temperature=0.2)

    assert overrides.model_name == "gemini-2.5-flash"
    assert overrides.temperature == 0.2


def test_cut_params_chan_gia_tri_am():
    with pytest.raises(ValidationError):
        PreprocessOverrides(cut_params=[0, -5, 0, 0])
