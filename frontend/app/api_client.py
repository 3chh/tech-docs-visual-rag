"""Client HTTP gọi backend. Frontend không nạp model nào."""

import json
import logging
from typing import Any, BinaryIO

import requests

from .config import get_config

logger = logging.getLogger(__name__)


class BackendError(RuntimeError):
    """Backend trả lỗi hoặc không kết nối được."""


class BackendClient:
    def __init__(self, base_url: str | None = None):
        config = get_config()
        self.base_url = (base_url or config.backend_url).rstrip("/")
        self.search_timeout = config.search_timeout
        self.upload_timeout = config.upload_timeout

    def _post(self, path: str, timeout: int, **kwargs) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        try:
            response = requests.post(url, timeout=timeout, **kwargs)
        except requests.exceptions.ConnectionError as e:
            raise BackendError(f"Không kết nối được backend tại {self.base_url}") from e
        except requests.exceptions.Timeout as e:
            raise BackendError(f"Backend quá thời gian chờ ({timeout}s)") from e

        if not response.ok:
            raise BackendError(f"Backend trả về {response.status_code}: {response.text[:300]}")
        return response.json()

    def health_check(self) -> bool:
        try:
            response = requests.get(f"{self.base_url}/health", timeout=5)
            return response.ok
        except requests.RequestException:
            return False

    def search_documents(
        self,
        query: str,
        user_id: str,
        top_k: int = 5,
        include_images: bool = True,
    ) -> dict[str, Any]:
        path = "/search_with_images" if include_images else "/search"
        payload: dict[str, Any] = {"query": query, "user_id": user_id, "top_k": top_k}
        if include_images:
            payload["include_base64"] = True
        return self._post(path, self.search_timeout, json=payload)

    def search_by_section_title(
        self,
        section_title: str,
        user_id: str,
        limit: int = 10,
        include_base64: bool = True,
        collection_name: str | None = None,
    ) -> dict[str, Any]:
        return self._post(
            "/search_by_section_title",
            self.search_timeout,
            json={
                "section_title": section_title,
                "user_id": user_id,
                "limit": limit,
                "include_base64": include_base64,
                "collection_name": collection_name,
            },
        )

    def upload_files(
        self,
        files: list[tuple[str, BinaryIO]],
        user_id: str,
        db_name: str,
        files_metadata: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """files: danh sách (tên file, đối tượng file đã mở ở chế độ nhị phân)."""
        multipart = [("files", (name, handle, "application/pdf")) for name, handle in files]
        return self._post(
            "/upload_files",
            self.upload_timeout,
            files=multipart,
            data={
                "user_id": user_id,
                "db_name": db_name,
                "metadata": json.dumps(files_metadata, ensure_ascii=False),
            },
        )

    def get_table_of_contents(self, collection_name: str) -> dict[str, Any] | None:
        try:
            response = requests.get(
                f"{self.base_url}/table_of_contents",
                params={"collection_name": collection_name},
                timeout=30,
            )
            if response.status_code == 404:
                return None
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.warning("Không lấy được mục lục cho %s: %s", collection_name, e)
            return None

    def list_collections(self, user_id: str) -> list[str]:
        try:
            response = requests.get(f"{self.base_url}/list_collections/{user_id}", timeout=30)
            response.raise_for_status()
            return response.json().get("collections", [])
        except requests.RequestException as e:
            logger.warning("Không lấy được danh sách collection: %s", e)
            return []
