"""Mock các dependency nặng để test chạy được không cần GPU."""

import sys
import types
from unittest.mock import MagicMock

import pytest

# Các thư viện chỉ có mặt khi chạy thật (GPU, model weights).
HEAVY_MODULES = [
    "torch",
    "torch.utils",
    "torch.utils.data",
    "paddleocr",
    "pdf2image",
    "fitz",
    "cv2",
    "scipy",
    "scipy.ndimage",
    "colpali_engine",
    "colpali_engine.models",
    "colpali_engine.utils",
    "colpali_engine.utils.torch_utils",
    "transformers",
    "transformers.utils",
    "transformers.utils.import_utils",
    "transformers.models",
    "transformers.models.qwen2_vl",
    "transformers.models.qwen2_vl.image_processing_qwen2_vl",
    "transformers.image_utils",
    "qdrant_client",
    "qdrant_client.models",
    "qdrant_client.http",
    "qdrant_client.http.models",
    "pymilvus",
    "google",
    "google.generativeai",
]


def _install_stubs() -> None:
    for name in HEAVY_MODULES:
        if name in sys.modules:
            continue
        module = types.ModuleType(name)
        module.__getattr__ = lambda attr: MagicMock()  # noqa: ARG005
        module.__path__ = []
        sys.modules[name] = module


_install_stubs()


@pytest.fixture
def api_env(monkeypatch, tmp_path):
    monkeypatch.setenv("OPENAI_API_KEY", "test")
    monkeypatch.setenv("GEMINI_API_KEY", "test")
    monkeypatch.setenv("METADATA_DIR", str(tmp_path))
    monkeypatch.setenv("DATA_DIR", str(tmp_path))

    from backend.core.config import get_settings

    get_settings.cache_clear()
    yield tmp_path
    get_settings.cache_clear()
