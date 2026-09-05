"""Schema cho các endpoint index tài liệu."""

from typing import Optional

from pydantic import BaseModel, Field


class IndexRequest(BaseModel):
    pdf_path: str
    user_id: str = "default"
    media_dir: str = "default"
    max_pages: Optional[int] = None
    custom_config: Optional[dict] = None
    metadata: Optional[dict] = None


class IndexResponse(BaseModel):
    pages_indexed: int
    status: str = "completed"


class UploadFilesResponse(BaseModel):
    success: bool
    message: str
    processed_files: int
    total_pages: int
    file_pages: dict[str, int] = Field(default_factory=dict)
    errors: list[str] = Field(default_factory=list)


class CollectionListResponse(BaseModel):
    user_id: str
    collections: list[str]
