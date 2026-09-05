"""Vector database: chọn backend theo config, cache client theo collection."""

import hashlib
import threading

from ..core.config import DatabaseSettings, EmbeddingSettings, get_settings
from ..core.logging import get_logger
from .base import BaseVectorManager

logger = get_logger(__name__)

_cache: dict[str, BaseVectorManager] = {}
_lock = threading.Lock()


def _short_hash(value: str) -> str:
    return hashlib.md5(value.encode()).hexdigest()[:8]


def build_vector_manager(
    collection: str,
    create_collection: bool = False,
    db: DatabaseSettings | None = None,
    emb: EmbeddingSettings | None = None,
) -> BaseVectorManager:
    """Tạo manager mới cho một collection.

    `collection` là tên collection logic (thường là db_name của người dùng).
    Milvus dùng thêm hash để đặt tên 2 collection vật lý (vector + metadata).
    """
    settings = get_settings()
    db = db or settings.database
    emb = emb or settings.embedding

    if db.type == "qdrant-standalone":
        from .qdrant_manager import QdrantManager

        return QdrantManager(
            uri=db.uri,
            grpc_port=db.grpc_port,
            collection_name=collection,
            create_collection=create_collection,
            dim=emb.dim,
            doc_dim=emb.doc_dim,
        )

    if db.type in ("milvus-lite", "milvus-standalone"):
        from .milvus_manager import MilvusManager

        hashed = _short_hash(collection)
        if db.type == "milvus-lite":
            uri, token, database_name = f"milvus_{hashed}.db", None, None
        else:
            uri, token, database_name = db.uri, db.token, db.database_name

        return MilvusManager(
            db.type,
            uri,
            token,
            database_name,
            f"_{hashed}_{db.collection_name}_vector",
            f"_{hashed}_{db.collection_name}_metadata",
            create_collection,
            search_limit=db.search_limit,
            doc_dim=emb.doc_dim,
            dim=emb.dim,
        )

    raise ValueError(
        f"Database type '{db.type}' không hợp lệ. "
        "Chọn: qdrant-standalone | milvus-lite | milvus-standalone"
    )


def get_vector_manager(collection: str, create_collection: bool = False) -> BaseVectorManager:
    """Cache client theo collection — bản gốc tạo mới mỗi request, rất tốn."""
    key = f"{collection}:{create_collection}"
    cached = _cache.get(key)
    if cached is not None:
        return cached

    with _lock:
        if key not in _cache:
            logger.info("Khởi tạo vector manager cho collection %r", collection)
            _cache[key] = build_vector_manager(collection, create_collection)
    return _cache[key]


def reset_vector_managers() -> None:
    """Xoá cache — chỉ dùng trong test."""
    _cache.clear()


__all__ = [
    "BaseVectorManager",
    "build_vector_manager",
    "get_vector_manager",
    "reset_vector_managers",
]
