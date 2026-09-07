"""Tham số người dùng override được cho từng lần xử lý.

Chỉ gồm những gì **đổi nóng được**. Ba lý do một tham số KHÔNG vào đây:

1. Model đã nạp vào VRAM theo tham số đó (tên model layout, OCR, embedding).
2. Vector đã index tính theo tham số đó, đổi thì vector mới không so được
   với vector cũ (`max_num_visual_tokens`, `min_width`, `dim`).
3. Client đã kết nối theo tham số đó (`vectordb.uri`, `grpc_port`).
"""

from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field


class PdfToImageOverrides(BaseModel):
    """Render PDF sang ảnh. Đọc lại mỗi lần xử lý nên đổi được tự do."""

    dpi: Optional[Annotated[int, Field(ge=72, le=1200)]] = None
    min_dpi: Optional[Annotated[int, Field(ge=20, le=600)]] = None
    anchor_size: Optional[Annotated[int, Field(ge=100_000, le=5_000_000)]] = None
    thread_count: Optional[Annotated[int, Field(ge=1, le=1024)]] = None


class PreprocessOverrides(BaseModel):
    """Cắt lề. `text_model` không có ở đây vì model đã nạp sẵn."""

    padding: Optional[Annotated[int, Field(ge=0, le=200)]] = None
    use_cut_padding: Optional[bool] = None
    batch_size: Optional[Annotated[int, Field(ge=1, le=128)]] = None
    cut_params: Optional[list[Annotated[int, Field(ge=0, le=1000)]]] = None
    pdf_to_image: Optional[PdfToImageOverrides] = None


class LayoutOverrides(BaseModel):
    """Chỉ batch size. Đổi `model_name` cần nạp lại model nên không cho."""

    batch_size: Optional[Annotated[int, Field(ge=1, le=256)]] = None


class OcrOverrides(BaseModel):
    title_batch_size: Optional[Annotated[int, Field(ge=1, le=128)]] = None
    number_batch_size: Optional[Annotated[int, Field(ge=1, le=128)]] = None
    formula_batch_size: Optional[Annotated[int, Field(ge=1, le=128)]] = None


class ChunkingOverrides(BaseModel):
    """Cách cắt tài liệu thành mục."""

    cut_padding: Optional[Annotated[int, Field(ge=0, le=300)]] = None
    min_section_height_px: Optional[Annotated[int, Field(ge=0, le=2000)]] = None


class TocValidatorOverrides(BaseModel):
    """LLM sửa cây mục lục. Chỉ là lệnh gọi API nên đổi được cả model."""

    model_name: Optional[str] = None
    temperature: Optional[Annotated[float, Field(ge=0.0, le=2.0)]] = None

    model_config = {"protected_namespaces": ()}


class ProcessingOverrides(BaseModel):
    """Gói override cho một lần xử lý PDF."""

    max_pages: Optional[Annotated[int, Field(ge=1)]] = None
    vertical_split: Optional[bool] = None
    preprocess: Optional[PreprocessOverrides] = None
    layout: Optional[LayoutOverrides] = None
    ocr: Optional[OcrOverrides] = None
    chunking: Optional[ChunkingOverrides] = None
    toc_validator: Optional[TocValidatorOverrides] = None

    def to_worker_config(self) -> dict:
        """Chuyển sang dict phẳng mà worker hiểu, bỏ các khoá None."""
        return self.model_dump(exclude_none=True)


class AskOverrides(BaseModel):
    """Tham số cho một lần tra cứu."""

    top_k: Optional[Annotated[int, Field(ge=1, le=20)]] = None
    use_toc_rewrite: Optional[bool] = None
    toc_preview_limit: Optional[Annotated[int, Field(ge=1, le=100)]] = None
    system_prompt: Optional[str] = None
    vlm_temperature: Optional[Annotated[float, Field(ge=0.0, le=2.0)]] = None


class EmbeddingChoice(BaseModel):
    """Tham số embedding của một bộ tài liệu.

    Khác các lớp Overrides ở trên: đây KHÔNG phải override đổi nóng được. Nó
    được chốt lúc tạo bộ rồi đóng băng, vì vector chỉ so được với vector cùng
    tham số. Trường để None nghĩa là "lấy từ cấu hình server lúc tạo bộ", và
    giá trị đã giải sẽ được lưu lại cụ thể.
    """

    type: Optional[Literal["longcolqwen", "colqwen", "colpali", "colidefics"]] = None
    model_name: Optional[str] = Field(default=None, max_length=200)
    #: Số token thị giác mỗi trang. Cao thì đọc được chữ nhỏ nhưng tốn VRAM.
    max_num_visual_tokens: Optional[Annotated[int, Field(ge=256, le=32768)]] = None
    #: Chỉ có ý nghĩa với longcolqwen: ghim chiều rộng, để chiều cao tự do.
    min_width: Optional[Annotated[int, Field(ge=64, le=4096)]] = None

    model_config = {"protected_namespaces": ()}
