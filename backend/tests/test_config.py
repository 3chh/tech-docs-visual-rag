"""Test config loader: ưu tiên env, fail-fast khi thiếu secret."""

import pytest

from backend.core.config import get_settings, reload_settings


@pytest.fixture(autouse=True)
def base_env(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai")
    monkeypatch.setenv("GEMINI_API_KEY", "test-gemini")
    yield
    # Chỉ xoá cache; không dựng lại settings vì test có thể đã bỏ env bắt buộc.
    get_settings.cache_clear()


def test_doc_dim_bang_visual_tokens_cong_prefix():
    settings = reload_settings()

    assert settings.embedding.doc_dim == (
        settings.embedding.max_num_visual_tokens + settings.embedding.prefix_num_tokens
    )


def test_env_override_yaml(monkeypatch):
    monkeypatch.setenv("EMBEDDING_MAX_NUM_VISUAL_TOKENS", "4096")
    monkeypatch.setenv("VECTORDB_TYPE", "milvus-lite")

    settings = reload_settings()

    assert settings.embedding.max_num_visual_tokens == 4096
    assert settings.database.type == "milvus-lite"


def test_dynamic_batching_tra_ve_max_token(monkeypatch):
    monkeypatch.setenv("EMBEDDING_BATCHING_MODE", "dynamic")
    monkeypatch.setenv("EMBEDDING_MAX_TOKEN", "9000")

    settings = reload_settings()

    assert settings.embedding.batching_kwargs() == {"max_token": 9000}


def test_normal_batching_tra_ve_batch_size(monkeypatch):
    monkeypatch.setenv("EMBEDDING_BATCHING_MODE", "normal")
    monkeypatch.setenv("EMBEDDING_BATCH_SIZE", "4")

    settings = reload_settings()

    assert settings.embedding.batching_kwargs() == {"batch_size": 4}


def test_longcolqwen_co_min_width(monkeypatch):
    monkeypatch.setenv("EMBEDDING_TYPE", "longcolqwen")
    monkeypatch.setenv("EMBEDDING_MIN_WIDTH", "768")

    settings = reload_settings()

    assert settings.embedding.manager_kwargs()["min_width"] == 768


def test_colqwen_khong_co_min_width(monkeypatch):
    monkeypatch.setenv("EMBEDDING_TYPE", "colqwen")

    settings = reload_settings()

    assert "min_width" not in settings.embedding.manager_kwargs()


def test_khong_can_api_key_o_env(monkeypatch):
    """Key nay do nguoi dung nhap tren giao dien va luu trong kho ket noi.

    Service phai len duoc ke ca khi chua co key nao, neu khong thi khong ai
    vao duoc giao dien de nhap key.
    """
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    settings = reload_settings()

    assert settings.embedding.type == "longcolqwen"
    assert settings.database.type == "qdrant-standalone"


def test_secret_khong_lay_tu_yaml():
    """config.yaml không được chứa secret — chỉ env mới cấp được."""
    from pathlib import Path

    import yaml

    from backend.core.config import DEFAULT_CONFIG_PATH

    raw = yaml.safe_load(Path(DEFAULT_CONFIG_PATH).read_text(encoding="utf-8"))
    serialized = yaml.dump(raw)

    assert "api_key" not in serialized
    assert "AIza" not in serialized  # tiền tố key Google
