"""Sinh và đọc mục lục tổng hợp của một collection.

Gom `summary_report.json` của mọi cuốn trong collection thành một file
`tableofcontent_<collection>.json`. Agent phía ngoài nạp file này vào prompt
để biết knowledge base có gì trước khi quyết định tìm kiếm.
"""

import json
from pathlib import Path
from typing import Any, Literal

from ...core import paths
from ...core.logging import get_logger

logger = get_logger(__name__)

SectionsFormat = Literal["simple", "full"]


def _book_title_from_summary(summary_path: Path) -> str | None:
    """Suy tên cuốn từ tiêu đề mục đầu tiên có nghĩa.

    summary_report.json không có trường title riêng, nên lấy mục đầu tiên khác
    "noname" làm đại diện.
    """
    try:
        with open(summary_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        logger.error("Không đọc được %s: %s", summary_path, e)
        return None

    total_pages = data.get("total_pages", 0)
    for section in data.get("sections", []):
        title = section.get("title", "").strip()
        if title and title.lower() != "noname":
            return f"{title} ({total_pages} pages)"
    return f"Document ({total_pages} pages)"


def _book_indices(collection_path: Path) -> list[int]:
    """Các thư mục con đặt tên bằng số chính là các cuốn sách."""
    if not collection_path.exists():
        logger.warning("Không có collection tại %s", collection_path)
        return []
    return sorted(
        int(p.name) for p in collection_path.iterdir() if p.is_dir() and p.name.isdigit()
    )


def generate_table_of_content(
    collection_name: str,
    sections_format: SectionsFormat = "simple",
) -> dict[str, Any]:
    collection_path = paths.collection_dir(collection_name)

    book_indices = _book_indices(collection_path)
    if not book_indices:
        logger.warning("Collection %r không có cuốn nào", collection_name)
        return {"collection_name": collection_name, "total_books": 0, "books": []}

    logger.info("Collection %r có %d cuốn: %s", collection_name, len(book_indices), book_indices)

    books_data: list[dict[str, Any]] = []
    for book_idx in book_indices:
        summary_path = paths.summary_report_path(collection_name, book_idx)
        book_info: dict[str, Any] = {
            "book_index": book_idx,
            "book_folder": str(book_idx),
            "title": None,
            "total_pages": 0,
            "total_sections": 0,
        }

        if summary_path.exists():
            book_info["title"] = _book_title_from_summary(summary_path)
            try:
                with open(summary_path, "r", encoding="utf-8") as f:
                    summary = json.load(f)
                book_info["total_pages"] = summary.get("total_pages", 0)
                book_info["total_sections"] = summary.get("total_sections", 0)

                sections = summary.get("sections", [])
                if sections_format == "simple":
                    book_info["sections"] = [{"title": s.get("title", "")} for s in sections]
                else:
                    book_info["sections"] = sections
                    book_info["page_numbers"] = summary.get("page_numbers", {})
            except (OSError, json.JSONDecodeError) as e:
                logger.error("Lỗi đọc summary cuốn %d: %s", book_idx, e)
        else:
            logger.warning("Không có summary_report.json cho cuốn %d", book_idx)
            book_info["title"] = f"Book {book_idx}"

        books_data.append(book_info)
        logger.info("  Cuốn %d: %s (%d mục)", book_idx, book_info["title"], book_info["total_sections"])

    return {
        "collection_name": collection_name,
        "total_books": len(books_data),
        "books": books_data,
    }


def save_table_of_content(toc: dict[str, Any], collection_name: str) -> Path:
    output_path = paths.toc_path(collection_name)
    paths.ensure_dir(output_path.parent)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(toc, f, ensure_ascii=False, indent=2)
    logger.info("Đã lưu mục lục tại %s", output_path)
    return output_path


def generate_and_save(
    collection_name: str,
    sections_format: SectionsFormat = "simple",
) -> dict[str, Any]:
    """Gọi sau khi index xong để mục lục phản ánh nội dung mới nhất."""
    toc = generate_table_of_content(collection_name, sections_format)
    save_table_of_content(toc, collection_name)
    return toc


def load_table_of_content(collection_name: str) -> dict[str, Any] | None:
    """Đọc mục lục đã sinh. Trả None nếu chưa có."""
    toc_file = paths.toc_path(collection_name)
    if not toc_file.exists():
        return None
    with open(toc_file, "r", encoding="utf-8") as f:
        return json.load(f)
