"""Test sinh mục lục tổng hợp — không cần GPU hay vector DB."""

import json

import pytest

from backend.app.services import toc
from backend.core.config import get_settings, reload_settings


@pytest.fixture
def metadata_root(tmp_path, monkeypatch):
    """Dựng cây metadata giả cho một collection 2 cuốn."""
    monkeypatch.setenv("METADATA_DIR", str(tmp_path))
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test")
    monkeypatch.setenv("GEMINI_API_KEY", "test")
    reload_settings()

    collection = tmp_path / "demo"
    for book_idx, sections in enumerate(
        [
            [
                {"index": 0, "title": "noname"},
                {"index": 1, "title": "1.1 Phạm vi áp dụng"},
            ],
            [
                {"index": 0, "title": "noname"},
                {"index": 1, "title": "2.1 Yêu cầu chung"},
                {"index": 2, "title": "2.2 Vật liệu"},
            ],
        ]
    ):
        book = collection / str(book_idx)
        book.mkdir(parents=True)
        (book / "summary_report.json").write_text(
            json.dumps(
                {
                    "total_pages": 10 * (book_idx + 1),
                    "total_sections": len(sections),
                    "sections": sections,
                    "page_numbers": {"0": "-1-", "1": "-2-"},
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

    yield tmp_path
    get_settings.cache_clear()


def test_generate_gom_du_cac_cuon(metadata_root):
    result = toc.generate_table_of_content("demo")

    assert result["collection_name"] == "demo"
    assert result["total_books"] == 2
    assert [b["book_index"] for b in result["books"]] == [0, 1]


def test_title_lay_tu_muc_dau_tien_co_nghia(metadata_root):
    result = toc.generate_table_of_content("demo")

    # "noname" bị bỏ qua khi suy tên cuốn
    assert result["books"][0]["title"] == "1.1 Phạm vi áp dụng (10 pages)"
    assert result["books"][1]["title"] == "2.1 Yêu cầu chung (20 pages)"


def test_format_simple_chi_giu_title(metadata_root):
    result = toc.generate_table_of_content("demo", sections_format="simple")

    sections = result["books"][1]["sections"]
    assert len(sections) == 3
    assert all(set(s.keys()) == {"title"} for s in sections)
    assert "page_numbers" not in result["books"][1]


def test_format_full_giu_toan_bo_metadata(metadata_root):
    result = toc.generate_table_of_content("demo", sections_format="full")

    assert "index" in result["books"][0]["sections"][0]
    assert result["books"][0]["page_numbers"] == {"0": "-1-", "1": "-2-"}


def test_collection_khong_ton_tai(metadata_root):
    result = toc.generate_table_of_content("khong-co")

    assert result["total_books"] == 0
    assert result["books"] == []


def test_save_va_load(metadata_root):
    generated = toc.generate_and_save("demo")
    loaded = toc.load_table_of_content("demo")

    assert loaded == generated
    assert (metadata_root / "demo" / "tableofcontent_demo.json").exists()


def test_load_khi_chua_sinh(metadata_root):
    assert toc.load_table_of_content("demo") is None


def test_bo_qua_thu_muc_khong_phai_so(metadata_root):
    (metadata_root / "demo" / "temp_folder").mkdir()

    result = toc.generate_table_of_content("demo")

    assert result["total_books"] == 2


def test_cuon_thieu_summary_van_duoc_liet_ke(metadata_root):
    (metadata_root / "demo" / "2").mkdir()

    result = toc.generate_table_of_content("demo")

    assert result["total_books"] == 3
    assert result["books"][2]["title"] == "Book 2"
    assert result["books"][2]["total_sections"] == 0
