"""Cấu hình frontend — chỉ đọc từ biến môi trường."""

import os
from dataclasses import dataclass, field


def _env(key: str, default: str) -> str:
    value = os.environ.get(key)
    return default if value is None or value == "" else value


def _env_int(key: str, default: int) -> int:
    return int(_env(key, str(default)))


@dataclass(frozen=True)
class FrontendConfig:
    backend_url: str = field(default_factory=lambda: _env("BACKEND_URL", "http://localhost:8000"))
    # Một lượt search gồm embed query + MaxSim rerank + VLM đọc ảnh, rất chậm.
    search_timeout: int = field(default_factory=lambda: _env_int("FRONTEND_SEARCH_TIMEOUT", 1000))
    upload_timeout: int = field(default_factory=lambda: _env_int("FRONTEND_UPLOAD_TIMEOUT", 3600))
    default_collection: str = field(default_factory=lambda: _env("DEFAULT_COLLECTION", "default"))

    vlm_endpoint: str = field(default_factory=lambda: _env("VLM_ENDPOINT", "http://localhost:8000/v1"))
    vlm_model_name: str = field(
        default_factory=lambda: _env("VLM_MODEL_NAME", "OpenGVLab/InternVL3-78B-AWQ")
    )
    vlm_api_key: str = field(default_factory=lambda: _env("OPENAI_API_KEY", "EMPTY"))

    server_name: str = field(default_factory=lambda: _env("GRADIO_SERVER_NAME", "0.0.0.0"))
    server_port: int = field(default_factory=lambda: _env_int("FRONTEND_PORT", 7860))
    log_level: str = field(default_factory=lambda: _env("LOG_LEVEL", "INFO"))


_config: FrontendConfig | None = None


def get_config() -> FrontendConfig:
    global _config
    if _config is None:
        _config = FrontendConfig()
    return _config
