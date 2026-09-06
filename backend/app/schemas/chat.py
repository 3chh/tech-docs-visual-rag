"""Schema cho endpoint hỏi đáp."""

from typing import Optional

from pydantic import BaseModel, Field

from .search import SearchResult


class AskRequest(BaseModel):
    query: str = Field(min_length=1)
    user_id: str = "default"
    top_k: int = Field(default=5, ge=1, le=20)
    system_prompt: str = ""
    include_base64: bool = True
    use_toc_rewrite: bool = True
    # Số ảnh mục lục cho VLM xem khi chuẩn hoá câu hỏi.
    toc_preview_limit: Optional[int] = Field(default=None, ge=1, le=100)
    vlm_temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    # Ghi đè kết nối mô hình cho riêng lượt này. None thì dùng kết nối mà
    # bộ tài liệu đã chọn.
    connection_id: Optional[str] = None


class AskResponse(BaseModel):
    query: str
    answer: str
    # Câu hỏi sau khi neo vào mục lục; None nếu không viết lại được.
    rewritten_query: Optional[str] = None
    sources: list[SearchResult] = Field(default_factory=list)
    total_sources: int = 0
    # Model nào đã trả lời, để người dùng biết câu trả lời đến từ đâu.
    connection_id: Optional[str] = None
    model_name: Optional[str] = None
