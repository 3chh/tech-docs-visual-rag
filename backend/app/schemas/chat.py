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


class AskResponse(BaseModel):
    query: str
    answer: str
    # Câu hỏi sau khi neo vào mục lục; None nếu không viết lại được.
    rewritten_query: Optional[str] = None
    sources: list[SearchResult] = Field(default_factory=list)
    total_sources: int = 0
