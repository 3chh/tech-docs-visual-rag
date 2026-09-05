"""Qdrant backend với truy xuất 2 tầng cho multi-vector ColPali."""

from time import sleep
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from qdrant_client import QdrantClient
from qdrant_client.http.models import Batch
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    HnswConfigDiff,
    MatchValue,
    MultiVectorComparator,
    MultiVectorConfig,
    OptimizersConfigDiff,
    Prefetch,
    QueryRequest,
    VectorParams,
)

from ..core.logging import get_logger
from .base import BaseVectorManager

logger = get_logger(__name__)

UPSERT_BATCH_SIZE = 65536
MAX_RETRIES = 5


class QdrantManager(BaseVectorManager):
    """Mỗi chunk lưu 3 named vector.

    - `original`: multi-vector đầy đủ (~8k token). HNSW m=0 nên KHÔNG được đánh
      index — chỉ dùng để rerank tập ứng viên nhỏ.
    - `mean_r` / `mean_c`: pooled theo hàng/cột, có index, dùng để prefetch.

    Nhờ vậy MaxSim chỉ chạy trên topk*10 ứng viên thay vì toàn collection.
    """

    def __init__(
        self,
        uri: str,
        grpc_port: int,
        collection_name: str,
        create_collection: bool = True,
        dim: int = 128,
        doc_dim: int = 8219,
        timeout: float = 120.0,
    ):
        self.client = QdrantClient(
            url=uri,
            prefer_grpc=True,
            grpc_port=grpc_port,
            timeout=timeout,
        )
        self.collection_name = collection_name
        self.dim = dim
        self.doc_dim = doc_dim

        try:
            collections = self.client.get_collections()
            logger.info("Kết nối Qdrant tại %s thành công", uri)
            logger.debug("Collections hiện có: %s", [c.name for c in collections.collections])
        except Exception as e:
            logger.error("Không kết nối được Qdrant tại %s: %s", uri, e)
            raise

        if create_collection:
            self.create_collection()

    def _multivector_params(self, hnsw: HnswConfigDiff) -> VectorParams:
        return VectorParams(
            size=self.dim,
            distance=Distance.COSINE,
            multivector_config=MultiVectorConfig(comparator=MultiVectorComparator.MAX_SIM),
            hnsw_config=hnsw,
        )

    def create_collection(self) -> None:
        try:
            collections = self.client.get_collections()
            if any(c.name == self.collection_name for c in collections.collections):
                logger.info("Collection %s đã tồn tại", self.collection_name)
                return

            pooled_hnsw = HnswConfigDiff(
                m=16,
                full_scan_threshold=10000,
                max_indexing_threads=4,
                ef_construct=100,
            )

            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config={
                    # m=0: tắt index, vector này chỉ dùng rerank nên đánh index là lãng phí.
                    "original": self._multivector_params(HnswConfigDiff(m=0)),
                    "mean_c": self._multivector_params(pooled_hnsw),
                    "mean_r": self._multivector_params(pooled_hnsw),
                },
                optimizers_config=OptimizersConfigDiff(
                    default_segment_number=2,
                    memmap_threshold=20000,
                ),
            )
            logger.info("Đã tạo collection %s", self.collection_name)
        except Exception as e:
            if "already exists" not in str(e):
                raise
            logger.info("Collection %s đã tồn tại", self.collection_name)

    def insert_chunks(self, colbert_vecs, rds, cds, payloads, file_id: str) -> None:
        vecs = [
            {
                "original": (orig.tolist() if hasattr(orig, "tolist") else orig),
                "mean_c": c,
                "mean_r": r,
            }
            for orig, c, r in zip(colbert_vecs, cds, rds)
        ]
        pays = list(payloads)

        for start in range(0, len(vecs), UPSERT_BATCH_SIZE):
            end = min(start + UPSERT_BATCH_SIZE, len(vecs))
            batch_vecs = vecs[start:end]
            batch_payloads = pays[start:end]
            # ID sinh từ (file_id, vị trí) để re-index cùng file ghi đè đúng chỗ cũ.
            batch_ids = [
                str(uuid5(NAMESPACE_URL, f"{file_id}:{start + i}")) for i in range(len(batch_vecs))
            ]

            vectors = {
                "original": [v["original"] for v in batch_vecs],
                "mean_c": [v["mean_c"] for v in batch_vecs],
                "mean_r": [v["mean_r"] for v in batch_vecs],
            }

            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    self.client.upsert(
                        collection_name=self.collection_name,
                        points=Batch(ids=batch_ids, vectors=vectors, payloads=batch_payloads),
                        wait=True,
                    )
                    break
                except Exception as e:
                    if attempt == MAX_RETRIES:
                        logger.error("Upsert thất bại sau %d lần thử: %s", MAX_RETRIES, e)
                        raise
                    logger.warning("Upsert lỗi (lần %d/%d): %s", attempt, MAX_RETRIES, e)
                    sleep(1.5 * attempt)

        logger.info("Đã ghi %d chunk vào %s", len(vecs), self.collection_name)

    def search(self, data, topk: int = 10) -> list[list[dict[str, Any]]]:
        search_queries = [
            QueryRequest(
                query=query,
                prefetch=[
                    Prefetch(query=query, limit=topk * 10, using="mean_c"),
                    Prefetch(query=query, limit=topk * 10, using="mean_r"),
                ],
                limit=topk,
                with_payload=True,
                with_vector=False,
                using="original",
            )
            for query in data
        ]

        try:
            search_results = self.client.query_batch_points(
                collection_name=self.collection_name,
                requests=search_queries,
            )
        except Exception as e:
            logger.error("Lỗi khi search collection %s: %s", self.collection_name, e)
            raise

        results = [[point.payload for point in r.points] for r in search_results]
        logger.info("Tìm được %d nhóm kết quả", len(results))
        logger.debug("Payload trả về: %s", results)
        return results

    def search_by_section_title(
        self,
        section_title: str = "noname",
        limit: int = 1000,
        collection_name: str | None = None,
    ) -> list[dict[str, Any]]:
        target = collection_name or self.collection_name
        logger.info("Scroll collection %s theo section_title=%r", target, section_title)

        try:
            points, _next_offset = self.client.scroll(
                collection_name=target,
                scroll_filter=Filter(
                    must=[FieldCondition(key="section_title", match=MatchValue(value=section_title))]
                ),
                limit=limit,
                with_payload=True,
            )
            logger.info("Tìm được %d điểm với section_title=%r", len(points), section_title)
            return [point.payload for point in points]
        except Exception as e:
            logger.error("Lỗi search_by_section_title: %s", e)
            raise

    def delete_collection(self) -> None:
        self.client.delete_collection(self.collection_name)
        logger.info("Đã xoá collection %s", self.collection_name)

    def get_collection_info(self):
        return self.client.get_collection(self.collection_name)

    def get_list_collection_name(self) -> list[str]:
        try:
            collections = self.client.get_collections()
            names = [c.name for c in collections.collections]
            logger.info("Có %d collection: %s", len(names), names)
            return names
        except Exception as e:
            logger.error("Lỗi lấy danh sách collection: %s", e)
            raise
