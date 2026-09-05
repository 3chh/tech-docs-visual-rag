"""Giao diện chung cho các vector database backend."""

from abc import ABC, abstractmethod
from typing import Any


class BaseVectorManager(ABC):
    """Hợp đồng tối thiểu mà mọi backend phải thoả.

    Lưu ý: `insert_chunks` có chữ ký khác nhau giữa Qdrant và Milvus vì Qdrant
    dùng 3 named vector (original/mean_r/mean_c) còn Milvus chỉ dùng một.
    Tầng service biết mình đang chạy backend nào nên khác biệt này là chấp nhận được.
    """

    @abstractmethod
    def create_collection(self) -> None: ...

    @abstractmethod
    def search(self, data, topk: int = 10) -> list[list[dict[str, Any]]]:
        """Trả về, cho mỗi query, danh sách payload của các chunk khớp nhất."""

    @abstractmethod
    def get_list_collection_name(self) -> list[str]: ...
