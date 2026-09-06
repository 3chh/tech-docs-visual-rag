"""Tạo sẵn kết nối tới vLLM tự host khi deploy bản đầy đủ.

Bản đầy đủ đã chạy vLLM trong cùng stack, nên bắt người dùng tự nhập lại
endpoint nội bộ (`http://vllm:8000/v1`) là vô nghĩa: họ không có cách nào biết
tên host đó. Đặt `DEFAULT_VLM_PROVIDER=builtin` để tạo sẵn kết nối này.

Các kiểu deploy không có vLLM (hybrid, demo) để trống biến, và người dùng tự
thêm kết nối tới OpenAI hoặc Gemini trên giao diện.
"""

import os

from .connections import ModelConnection, get_connection_store
from .logging import get_logger

logger = get_logger(__name__)

BUILTIN_CONNECTION_ID = "builtin-vllm"

DEFAULT_BUILTIN_ENDPOINT = "http://vllm:8000/v1"
DEFAULT_BUILTIN_MODEL = "OpenGVLab/InternVL3-8B"


def is_builtin_enabled() -> bool:
    return (os.environ.get("DEFAULT_VLM_PROVIDER") or "none").strip().lower() == "builtin"


def seed_builtin_connection() -> ModelConnection | None:
    """Tạo kết nối built-in nếu deploy bản đầy đủ. Idempotent.

    Khai cả "vlm" và "llm": vLLM nói giao thức OpenAI nên cùng một endpoint
    vừa đọc ảnh trả lời, vừa sửa được cây mục lục.

    Người dùng xoá đi thì lần khởi động sau nó quay lại — kết nối này mô tả
    thực tế của bản deploy, không phải lựa chọn của người dùng. Muốn bỏ hẳn
    thì bỏ `DEFAULT_VLM_PROVIDER=builtin`.
    """
    if not is_builtin_enabled():
        return None

    endpoint = (os.environ.get("BUILTIN_VLM_ENDPOINT") or DEFAULT_BUILTIN_ENDPOINT).strip()
    model_name = (os.environ.get("VLM_MODEL_NAME") or DEFAULT_BUILTIN_MODEL).strip()

    connection, created = get_connection_store().ensure(
        connection_id=BUILTIN_CONNECTION_ID,
        name="vLLM tự host (built-in)",
        provider="vllm",
        model_name=model_name,
        capabilities=["vlm", "llm"],
        endpoint=endpoint,
        # vLLM trong stack không bật xác thực nên không có key để lưu.
        api_key=None,
    )

    if created:
        logger.info("Kết nối built-in: %s @ %s", model_name, endpoint)
    return connection
