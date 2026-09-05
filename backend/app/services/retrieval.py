"""Truy xuất ảnh-mục từ vector DB."""

from typing import Any

from ...core.config import get_settings
from ...core.logging import get_logger
from ...embeddings import get_embedding_manager
from ...vectordb import get_vector_manager

logger = get_logger(__name__)


class RetrievalService:
    def __init__(self, collection: str):
        self.settings = get_settings()
        self.collection = collection
        self.db_manager = get_vector_manager(collection, create_collection=False)

    def search(self, queries: list[str], topk: int = 5) -> list[list[dict[str, Any]]]:
        """Semantic search. Trả về, cho mỗi query, danh sách payload khớp nhất."""
        logger.info("Search %d query, topk=%d, collection=%s", len(queries), topk, self.collection)
        query_vec = get_embedding_manager().process_text(queries)
        return self.db_manager.search(query_vec, topk=topk)

    def search_by_section_title(
        self,
        section_title: str = "noname",
        limit: int = 10,
        collection_name: str | None = None,
    ) -> list[dict[str, Any]]:
        """Lọc theo tên mục.

        Dùng chính cho `noname` — mục chứa bìa và mục lục, phía client dùng nó
        làm ngữ cảnh để viết lại câu hỏi.
        """
        logger.info("Tìm theo section_title=%r, limit=%d", section_title, limit)

        if self.settings.database.type != "qdrant-standalone":
            raise NotImplementedError(
                f"search_by_section_title chưa hỗ trợ backend {self.settings.database.type}"
            )

        return self.db_manager.search_by_section_title(section_title, limit, collection_name)

    def list_collections(self) -> list[str]:
        return self.db_manager.get_list_collection_name()
