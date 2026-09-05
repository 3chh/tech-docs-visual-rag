"""Quản lý hàng đợi file chờ index."""

import logging
import os
from dataclasses import dataclass, field
from typing import Literal

from ..api_client import BackendClient, BackendError
from ..ui.agent_panel import conversation_log

logger = logging.getLogger(__name__)

Status = Literal["queued", "completed", "failed"]


@dataclass
class QueuedFile:
    file_path: str
    display_name: str
    original_name: str
    vertical_split: bool = False
    max_pages: int | None = None
    status: Status = "queued"
    pages_indexed: int = 0
    error: str = ""

    def to_metadata(self) -> dict:
        return {
            "display_name": self.display_name,
            "original_name": self.original_name,
            "vertical_split": self.vertical_split,
            "max_pages": self.max_pages,
        }


@dataclass
class FileQueue:
    """Hàng đợi theo từng collection."""

    _queues: dict[str, list[QueuedFile]] = field(default_factory=dict)

    def items(self, collection: str) -> list[QueuedFile]:
        return self._queues.setdefault(collection, [])

    def add(self, collection: str, item: QueuedFile) -> None:
        self.items(collection).append(item)

    def remove(self, collection: str, index: int) -> QueuedFile | None:
        queue = self.items(collection)
        if 0 <= index < len(queue):
            return queue.pop(index)
        return None

    def clear(self, collection: str) -> int:
        queue = self.items(collection)
        count = len(queue)
        queue.clear()
        return count

    def pending(self, collection: str) -> list[QueuedFile]:
        return [f for f in self.items(collection) if f.status == "queued"]


class FileService:
    def __init__(self, client: BackendClient | None = None):
        self.client = client or BackendClient()
        self.queue = FileQueue()

    def add_files(
        self,
        collection: str,
        file_paths: list[str],
        display_name: str = "",
        vertical_split: bool = False,
        max_pages: int | None = None,
    ) -> str:
        if not file_paths:
            return "Chưa chọn file nào."

        added = 0
        for path in file_paths:
            if not path.lower().endswith(".pdf"):
                continue
            base = os.path.basename(path)
            self.queue.add(
                collection,
                QueuedFile(
                    file_path=path,
                    display_name=display_name.strip() or base,
                    original_name=base,
                    vertical_split=vertical_split,
                    max_pages=max_pages,
                ),
            )
            added += 1

        conversation_log.add("Files", "info", f"Thêm {added} file vào hàng đợi")
        return f"Đã thêm {added} file vào hàng đợi." if added else "Không có file PDF hợp lệ."

    def process_all(self, collection: str) -> str:
        pending = self.queue.pending(collection)
        if not pending:
            return "Không có file nào đang chờ xử lý."

        conversation_log.add("Files", "info", f"Bắt đầu index {len(pending)} file")

        handles = []
        try:
            for item in pending:
                handles.append((item.original_name, open(item.file_path, "rb")))

            result = self.client.upload_files(
                files=handles,
                user_id=collection,
                db_name=collection,
                files_metadata=[item.to_metadata() for item in pending],
            )
        except BackendError as e:
            for item in pending:
                item.status = "failed"
                item.error = str(e)
            conversation_log.add("Files", "error", f"Index thất bại: {e}")
            return f"Lỗi: {e}"
        except OSError as e:
            conversation_log.add("Files", "error", f"Không đọc được file: {e}")
            return f"Lỗi đọc file: {e}"
        finally:
            for _, handle in handles:
                handle.close()

        file_pages = result.get("file_pages", {})
        for item in pending:
            pages = file_pages.get(item.display_name)
            if pages:
                item.status = "completed"
                item.pages_indexed = pages
            else:
                item.status = "failed"
                item.error = "Backend không trả về số trang"

        message = (
            f"Đã xử lý {result.get('processed_files', 0)}/{len(pending)} file, "
            f"tổng {result.get('total_pages', 0)} mục."
        )
        errors = result.get("errors", [])
        if errors:
            message += "\n\nLỗi:\n" + "\n".join(f"  - {e}" for e in errors)

        conversation_log.add("Files", "output", message.split("\n")[0])
        return message

    def format_queue(self, collection: str) -> str:
        items = self.queue.items(collection)
        if not items:
            return "_Hàng đợi trống._"

        icons = {"queued": "⏳", "completed": "✅", "failed": "❌"}
        lines = ["| # | Tên | Trạng thái | Tách đôi trang | Số mục |", "|---|---|---|---|---|"]
        for i, item in enumerate(items):
            icon = icons.get(item.status, "•")
            pages = item.pages_indexed or "—"
            lines.append(
                f"| {i} | {item.display_name} | {icon} {item.status} | "
                f"{'có' if item.vertical_split else 'không'} | {pages} |"
            )
        return "\n".join(lines)
