"""Cấu hình tập trung: đọc YAML rồi override bằng biến môi trường."""

import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal, Optional

import yaml
from pydantic import BaseModel, Field, model_validator

BACKEND_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG_PATH = BACKEND_ROOT / "config" / "config.yaml"


class EmbeddingSettings(BaseModel):
    type: Literal["longcolqwen", "colqwen", "colpali", "colidefics"] = "longcolqwen"
    model_name: str = "tsystems/colqwen2.5-3b-multilingual-v1.0"
    device: str = "cuda"
    dim: int = 128
    max_num_visual_tokens: int = 8192
    min_width: Optional[int] = 600
    batching_mode: Literal["normal", "dynamic"] = "dynamic"
    batch_size: int = 1
    max_token: int = 13000
    prefix_num_tokens: int = Field(default=11, alias="PREFIX_NUM_TOKENS")

    model_config = {"populate_by_name": True, "protected_namespaces": ()}

    @property
    def doc_dim(self) -> int:
        """Số vector tối đa mỗi ảnh — dùng khai báo schema Milvus."""
        return self.max_num_visual_tokens + self.prefix_num_tokens

    def manager_kwargs(self) -> dict[str, Any]:
        """Tham số khởi tạo manager, khác nhau giữa longcolqwen và các loại còn lại."""
        kwargs: dict[str, Any] = {"max_num_visual_tokens": self.max_num_visual_tokens}
        if self.type == "longcolqwen":
            kwargs["min_width"] = self.min_width
        return kwargs

    def batching_kwargs(self) -> dict[str, Any]:
        """Tham số batching truyền vào process_images."""
        if self.batching_mode == "dynamic":
            return {"max_token": self.max_token}
        return {"batch_size": self.batch_size}


class DatabaseSettings(BaseModel):
    type: Literal["qdrant-standalone", "milvus-lite", "milvus-standalone"] = "qdrant-standalone"
    uri: str = "http://localhost:6333"
    grpc_port: int = 6334
    token: Optional[str] = None
    database_name: str = "cosmo"
    collection_name: str = "context"
    search_limit: int = 16384


class LLMSettings(BaseModel):
    """Cấu hình chung cho LLM và VLM."""

    type: Literal["openai", "gemini"] = "openai"
    endpoint: str = "https://api.openai.com/v1"
    model_name: str = "gpt-4o"
    api_key: Optional[str] = None
    temperature: float = 0.0
    max_tokens: Optional[int] = None

    model_config = {"protected_namespaces": ()}


class SummaryReporterSettings(BaseModel):
    number_batch_size: int = 16
    title_batch_size: int = 16
    formula_batch_size: int = 16
    lazy_load: bool = False


class SectionMergerSettings(BaseModel):
    cut_padding: int = 60
    remove_page_number: bool = True
    keep_chunk_pages: bool = True


class PdfToImageSettings(BaseModel):
    dpi: int = 300
    thread_count: int = 512
    vertical_split: bool = True
    anchor_size: int = 500990
    min_dpi: int = 45


class PreprocessPdfSettings(BaseModel):
    cut_params: list[int] = Field(default_factory=lambda: [0, 0, 0, 0])
    padding: int = 30
    batch_size: int = 16
    text_model: str = "PP-OCRv5_server_det"
    use_cut_padding: bool = True
    pdf_to_image: PdfToImageSettings = Field(default_factory=PdfToImageSettings)


class ElementDetectorSettings(BaseModel):
    batch_size: int = 32
    model_name: str = "PP-DocLayout_plus-L"

    model_config = {"protected_namespaces": ()}


class DefaultPdfSettings(BaseModel):
    path: str
    name: str
    vertical_split: bool = False
    max_pages: Optional[int] = None


class DocumentSettings(BaseModel):
    """Cấu hình pipeline xử lý PDF (tương ứng khối pdf_manager của bản gốc)."""

    worker_endpoint: str = "http://localhost:8001/upload_pdf/"
    summary_reporter: SummaryReporterSettings = Field(default_factory=SummaryReporterSettings)
    section_merger: SectionMergerSettings = Field(default_factory=SectionMergerSettings)
    preprocess_pdf: PreprocessPdfSettings = Field(default_factory=PreprocessPdfSettings)
    llm_validator: LLMSettings = Field(default_factory=LLMSettings)
    element_detector: ElementDetectorSettings = Field(default_factory=ElementDetectorSettings)
    default_pdfs: list[DefaultPdfSettings] = Field(default_factory=list)


class PathSettings(BaseModel):
    data_dir: Path = Path("./data")
    metadata_dir: Path = Path("./data/metadata")

    @model_validator(mode="after")
    def resolve_paths(self) -> "PathSettings":
        self.data_dir = self.data_dir.expanduser().resolve()
        self.metadata_dir = self.metadata_dir.expanduser().resolve()
        return self


class Settings(BaseModel):
    embedding: EmbeddingSettings = Field(default_factory=EmbeddingSettings)
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    llm: LLMSettings = Field(default_factory=LLMSettings)
    vlm: LLMSettings = Field(default_factory=LLMSettings)
    document: DocumentSettings = Field(default_factory=DocumentSettings)
    paths: PathSettings = Field(default_factory=PathSettings)
    log_level: str = "INFO"

    @model_validator(mode="after")
    def validate_required_secrets(self) -> "Settings":
        """Fail-fast: thiếu secret thì lỗi lúc khởi động, không phải lúc gọi API."""
        missing: list[str] = []
        if self.vlm.type == "openai" and not self.vlm.api_key:
            missing.append("OPENAI_API_KEY (VLM_TYPE=openai)")
        if self.document.llm_validator.type == "gemini" and not self.document.llm_validator.api_key:
            missing.append("GEMINI_API_KEY (TOC_VALIDATOR_TYPE=gemini)")
        if missing:
            raise ValueError(
                "Thiếu biến môi trường bắt buộc: " + ", ".join(missing) +
                ". Xem .env.example."
            )
        return self


def _env(key: str, default: Any = None) -> Any:
    value = os.environ.get(key)
    return default if value is None or value == "" else value


def _env_int(key: str, default: Optional[int]) -> Optional[int]:
    value = os.environ.get(key)
    return default if value is None or value == "" else int(value)


def _env_bool(key: str, default: bool) -> bool:
    value = os.environ.get(key)
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _load_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _build_settings(config_path: Path) -> Settings:
    raw = _load_yaml(config_path)

    emb_raw = raw.get("embedding_manager", {})
    db_raw = raw.get("database", {})
    doc_raw = raw.get("pdf_manager", {})
    validator_raw = doc_raw.get("llm_validator", {})

    embedding = EmbeddingSettings(
        type=_env("EMBEDDING_TYPE", emb_raw.get("type", "longcolqwen")),
        model_name=_env("EMBEDDING_MODEL_NAME", emb_raw.get("model_name")),
        device=_env("EMBEDDING_DEVICE", emb_raw.get("device", "cuda")),
        dim=_env_int("EMBEDDING_DIM", emb_raw.get("dim", 128)),
        max_num_visual_tokens=_env_int(
            "EMBEDDING_MAX_NUM_VISUAL_TOKENS", emb_raw.get("max_num_visual_tokens", 8192)
        ),
        min_width=_env_int("EMBEDDING_MIN_WIDTH", emb_raw.get("min_width", 600)),
        batching_mode=_env("EMBEDDING_BATCHING_MODE", emb_raw.get("batching_mode", "dynamic")),
        batch_size=_env_int("EMBEDDING_BATCH_SIZE", emb_raw.get("batch_size", 1)),
        max_token=_env_int("EMBEDDING_MAX_TOKEN", emb_raw.get("max_token", 13000)),
        PREFIX_NUM_TOKENS=_env_int("EMBEDDING_PREFIX_NUM_TOKENS", emb_raw.get("PREFIX_NUM_TOKENS", 11)),
    )

    database = DatabaseSettings(
        type=_env("VECTORDB_TYPE", db_raw.get("type", "qdrant-standalone")),
        uri=_env("VECTORDB_URI", db_raw.get("uri", "http://localhost:6333")),
        grpc_port=_env_int("VECTORDB_GRPC_PORT", db_raw.get("grpc_port", 6334)),
        token=_env("VECTORDB_TOKEN", db_raw.get("token")),
        database_name=_env("VECTORDB_DATABASE_NAME", db_raw.get("database_name", "cosmo")),
        collection_name=_env("VECTORDB_COLLECTION_NAME", db_raw.get("collection_name", "context")),
        search_limit=_env_int("VECTORDB_SEARCH_LIMIT", db_raw.get("search_limit", 16384)),
    )

    vlm_raw = raw.get("vlm", {})
    vlm = LLMSettings(
        type=_env("VLM_TYPE", vlm_raw.get("type", "openai")),
        endpoint=_env("VLM_ENDPOINT", vlm_raw.get("endpoint")),
        model_name=_env("VLM_MODEL_NAME", vlm_raw.get("model_name")),
        # Secret chỉ đến từ env, không bao giờ từ YAML.
        api_key=_env("OPENAI_API_KEY") if _env("VLM_TYPE", vlm_raw.get("type")) == "openai"
        else _env("GEMINI_API_KEY"),
    )

    llm_raw = raw.get("llm", {})
    llm = LLMSettings(
        type=_env("LLM_TYPE", llm_raw.get("type", "openai")),
        endpoint=_env("LLM_ENDPOINT", llm_raw.get("endpoint")),
        model_name=_env("LLM_MODEL_NAME", llm_raw.get("model_name")),
        api_key=_env("OPENAI_API_KEY"),
    )

    validator_type = _env("TOC_VALIDATOR_TYPE", validator_raw.get("type", "gemini"))
    llm_validator = LLMSettings(
        type=validator_type,
        endpoint=_env("TOC_VALIDATOR_ENDPOINT", validator_raw.get("endpoint")),
        model_name=_env("TOC_VALIDATOR_MODEL_NAME", validator_raw.get("model_name")),
        temperature=float(_env("TOC_VALIDATOR_TEMPERATURE", validator_raw.get("temperature", 0.6))),
        api_key=_env("GEMINI_API_KEY") if validator_type == "gemini" else _env("OPENAI_API_KEY"),
        max_tokens=_env_int("TOC_VALIDATOR_MAX_TOKENS", validator_raw.get("max_tokens")),
    )

    preprocess_raw = doc_raw.get("preprocess_pdf", {})
    pdf_to_image_raw = preprocess_raw.get("pdf_to_image", {})

    document = DocumentSettings(
        worker_endpoint=_env(
            "PDF_WORKER_ENDPOINT",
            doc_raw.get("serving", {}).get("endpoint", "http://localhost:8001/upload_pdf/"),
        ),
        summary_reporter=SummaryReporterSettings(**doc_raw.get("summary_reporter", {})),
        section_merger=SectionMergerSettings(**doc_raw.get("section_merger", {})),
        preprocess_pdf=PreprocessPdfSettings(
            **{k: v for k, v in preprocess_raw.items() if k != "pdf_to_image"},
            pdf_to_image=PdfToImageSettings(**pdf_to_image_raw),
        ),
        llm_validator=llm_validator,
        element_detector=ElementDetectorSettings(**doc_raw.get("element_detector", {})),
        default_pdfs=[DefaultPdfSettings(**p) for p in doc_raw.get("default_pdfs", [])],
    )

    paths = PathSettings(
        data_dir=Path(_env("DATA_DIR", "./data")),
        metadata_dir=Path(_env("METADATA_DIR", "./data/metadata")),
    )

    return Settings(
        embedding=embedding,
        database=database,
        llm=llm,
        vlm=vlm,
        document=document,
        paths=paths,
        log_level=_env("LOG_LEVEL", "INFO"),
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    config_path = Path(_env("CONFIG_PATH", str(DEFAULT_CONFIG_PATH)))
    return _build_settings(config_path)


def reload_settings() -> Settings:
    """Xoá cache config — chỉ dùng trong test."""
    get_settings.cache_clear()
    return get_settings()
