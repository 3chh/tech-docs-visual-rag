"""Điều phối indexing: gọi worker xử lý PDF, embed ảnh-mục, ghi vào vector DB."""

import hashlib
from typing import Any

import requests

from ...core.config import get_settings
from ...core.logging import get_logger
from ...embeddings import get_embedding_manager
from ...vectordb import get_vector_manager

logger = get_logger(__name__)

WORKER_TIMEOUT = 3600  # xử lý một cuốn vài trăm trang có thể mất rất lâu


class IndexingService:
    """Một instance ứng với một collection trong vector DB."""

    def __init__(self, collection: str, create_collection: bool = True):
        self.settings = get_settings()
        self.collection = collection
        self.db_manager = get_vector_manager(collection, create_collection=create_collection)

    def _call_worker(self, media_dir: str, pdf_path: str, custom_config: dict | None) -> list[dict]:
        """Gọi PDF worker, nhận metadata của từng ảnh-mục."""
        endpoint = self.settings.document.worker_endpoint
        logger.info("Gọi PDF worker %s cho %s", endpoint, pdf_path)

        response = requests.post(
            endpoint,
            json={"id": media_dir, "pdf_path": pdf_path, "custom_config": custom_config},
            timeout=WORKER_TIMEOUT,
        )
        if not response.ok:
            logger.error("PDF worker lỗi %s: %s", response.status_code, response.text[:500])
            raise RuntimeError(
                f"PDF worker trả về {response.status_code}: {response.text[:500]}"
            )

        try:
            data = response.json()
        except ValueError as e:
            logger.error("PDF worker trả về JSON không hợp lệ: %s", response.text[:500])
            raise RuntimeError(f"PDF worker trả về JSON không hợp lệ: {response.text[:500]}") from e

        logger.info("PDF worker: %s", data.get("message"))
        return data.get("metadatas", [])

    @staticmethod
    def _build_payloads(full_metadatas: list[dict], metadata: dict | None) -> list[dict[str, Any]]:
        return [
            {
                "section_title": m.get("section_title", ""),
                "formulas": m.get("formulas", []),
                "section_pages": m.get("section_pages", []),
                "ancestors": m.get("ancestors", []),
                "image_path": m.get("image_path", ""),
                "chunk_images_dir": m.get("chunk_images_dir", ""),
                "metadata": metadata,
            }
            for m in full_metadatas
        ]

    def index(
        self,
        pdf_path: str,
        media_dir: str,
        max_pages: int | None = None,
        custom_config: dict | None = None,
        metadata: dict | None = None,
    ) -> list[str]:
        """Xử lý và index một file PDF. Trả về danh sách đường dẫn ảnh-mục."""
        import torch

        custom_config = dict(custom_config or {})
        if max_pages is not None:
            custom_config.setdefault("max_pages", max_pages)

        full_metadatas = self._call_worker(media_dir, pdf_path, custom_config)
        image_paths = [m["image_path"] for m in full_metadatas]
        logger.info("Worker trả về %d ảnh-mục", len(image_paths))

        torch.cuda.empty_cache()

        # file_id đảm bảo re-index cùng file ghi đè đúng điểm cũ thay vì nhân bản.
        file_id = hashlib.md5(pdf_path.encode()).hexdigest()[:8]
        emb = get_embedding_manager()
        batching = self.settings.embedding.batching_kwargs()
        payloads = self._build_payloads(full_metadatas, metadata)

        if self.settings.database.type == "qdrant-standalone":
            colbert_vecs, rds, cds = emb.process_images(
                image_paths, type=self.settings.database.type, **batching
            )
            self.db_manager.insert_chunks(colbert_vecs, rds, cds, payloads, file_id)
        else:
            colbert_vecs = emb.process_images(
                image_paths, type=self.settings.database.type, **batching
            )
            images_data = [
                {"colbert_vecs": colbert_vecs[i], **payloads[i]} for i in range(len(image_paths))
            ]
            logger.info("Ghi %d bản ghi vào Milvus", len(images_data))
            self.db_manager.insert_chunks(images_data)

        torch.cuda.empty_cache()
        logger.info("Index hoàn tất cho %s", pdf_path)
        return image_paths
