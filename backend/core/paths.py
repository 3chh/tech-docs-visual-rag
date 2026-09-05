"""Quy ước đường dẫn lưu trữ dùng chung giữa API service và worker.

Layout trên volume:
    <metadata_dir>/<collection>/<book_index>/
        summary_report.json
        full_metadata.json
        section_images/section_NN_<title>.png
        sections/section_NN_<title>/chunk_page_N.png
        ocr_data/{titles,page_numbers,formulas}_data.json
    <metadata_dir>/<collection>/tableofcontent_<collection>.json
"""

from pathlib import Path

from .config import get_settings


def data_dir() -> Path:
    return get_settings().paths.data_dir


def metadata_dir() -> Path:
    return get_settings().paths.metadata_dir


def collection_dir(collection: str) -> Path:
    return metadata_dir() / collection


def book_dir(collection: str, book_index: int | str) -> Path:
    return collection_dir(collection) / str(book_index)


def toc_path(collection: str) -> Path:
    return collection_dir(collection) / f"tableofcontent_{collection}.json"


def summary_report_path(collection: str, book_index: int | str) -> Path:
    return book_dir(collection, book_index) / "summary_report.json"


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path
