"""Schema phơi cấu hình hiện tại ra UI.

Chia theo *ai đổi được và khi nào*, không theo cấu trúc file YAML:

- `runtime`  : UI đổi trực tiếp mỗi lần gọi, không cần khởi động lại
- `document` : cấu hình xử lý PDF, đổi qua biến môi trường
- `indexing` : embedding và vector DB, đổi qua biến môi trường
- `models`   : VLM và LLM, đổi qua biến môi trường

Ba nhóm sau chỉ đọc: đổi chúng cần khởi động lại service vì model đã nạp
vào VRAM theo tham số cũ.
"""

from typing import Optional

from pydantic import BaseModel, Field



class RuntimeSettings(BaseModel):
    """Tham số UI đổi được ngay, gửi kèm mỗi request."""

    top_k_default: int
    top_k_min: int
    top_k_max: int
    use_toc_rewrite_default: bool
    toc_preview_limit: int


class PdfToImageSettings(BaseModel):
    dpi: int
    min_dpi: int
    anchor_size: int
    thread_count: int
    vertical_split: bool


class PreprocessSettings(BaseModel):
    cut_params: list[int]
    padding: int
    batch_size: int
    text_model: str
    use_cut_padding: bool
    pdf_to_image: PdfToImageSettings


class LayoutSettings(BaseModel):
    model_name: str
    batch_size: int

    model_config = {"protected_namespaces": ()}


class OcrSettings(BaseModel):
    number_batch_size: int
    title_batch_size: int
    formula_batch_size: int
    lazy_load: bool


class ChunkingSettings(BaseModel):
    """Cách cắt tài liệu thành các mục."""

    cut_padding: int
    remove_page_number: bool
    keep_chunk_pages: bool
    min_section_height_px: int


class TocValidatorSettings(BaseModel):
    type: str
    model_name: str
    endpoint: str
    temperature: float
    api_key_configured: bool

    model_config = {"protected_namespaces": ()}


class DocumentSettings(BaseModel):
    worker_endpoint: str
    preprocess: PreprocessSettings
    layout: LayoutSettings
    ocr: OcrSettings
    chunking: ChunkingSettings
    toc_validator: TocValidatorSettings


class EmbeddingSettingsOut(BaseModel):
    type: str
    model_name: str
    device: str
    dim: int
    max_num_visual_tokens: int
    min_width: Optional[int]
    batching_mode: str
    batch_size: int
    max_token: int
    prefix_num_tokens: int
    doc_dim: int

    model_config = {"protected_namespaces": ()}


class VectorDbSettings(BaseModel):
    type: str
    uri: str
    grpc_port: int
    database_name: str
    collection_name: str
    search_limit: int
    upsert_batch_size: int


class IndexingSettings(BaseModel):
    embedding: EmbeddingSettingsOut
    vectordb: VectorDbSettings


class ModelEndpoint(BaseModel):
    type: str
    endpoint: str
    model_name: str
    api_key_configured: bool

    model_config = {"protected_namespaces": ()}


class ModelsSettings(BaseModel):
    vlm: ModelEndpoint
    llm: ModelEndpoint


class SettingsResponse(BaseModel):
    runtime: RuntimeSettings
    document: DocumentSettings
    indexing: IndexingSettings
    models: ModelsSettings
    data_dir: str
    metadata_dir: str
    log_level: str
    editable_note: str = Field(
        default=(
            "Nhóm runtime đổi được ngay trên giao diện. Ba nhóm còn lại đọc từ "
            "biến môi trường; đổi chúng cần khởi động lại service vì model đã "
            "nạp vào VRAM theo tham số cũ."
        )
    )
