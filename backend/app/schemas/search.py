"""Schema cho các endpoint tìm kiếm.

Giữ nguyên shape của bản gốc: agent bên ngoài đang là consumer thật, đổi shape
sẽ phá client.
"""

from typing import Any, Optional

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str
    user_id: str = "default"
    top_k: int = Field(default=5, ge=1, le=100)


class SearchImageRequest(SearchRequest):
    include_base64: bool = True


class SearchBySectionTitleRequest(BaseModel):
    section_title: str = "noname"
    user_id: str = "default"
    limit: int = Field(default=10, ge=1, le=1000)
    include_base64: bool = True
    collection_name: Optional[str] = None


class SearchResult(BaseModel):
    section_title: str = ""
    formulas: list[dict[str, Any]] = Field(default_factory=list)
    section_pages: list[str] = Field(default_factory=list)
    ancestors: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    image_path: str = ""
    image_base64: Optional[str] = None
    chunk_images: list[str] = Field(default_factory=list)


class SearchResponse(BaseModel):
    user_id: str
    query: str
    top_k: int
    results: list[SearchResult]
    total_results: int
