"""Lỗi có mã ổn định để frontend xử lý khác nhau theo từng loại.

Chuỗi tiếng Việt thay đổi được mà không làm hỏng client; mã thì không.
Frontend dựa vào mã để quyết định hiện popup điều hướng hay báo lỗi tại field.
"""

from typing import Any

from fastapi import HTTPException

# Chưa có mô hình nào dùng được -> UI phải đưa người dùng sang phần Cấu hình.
NO_MODELS_CONFIGURED = "no_models_configured"
# Bộ tài liệu chưa chọn mô hình -> UI mở hộp thoại cấu hình cho bộ đó.
COLLECTION_NOT_CONFIGURED = "collection_not_configured"
CONNECTION_INVALID = "connection_invalid"
CONNECTION_NOT_FOUND = "connection_not_found"
COLLECTION_EXISTS = "collection_exists"
COLLECTION_NOT_FOUND = "collection_not_found"
INVALID_NAME = "invalid_name"
DUPLICATE_NAME = "duplicate_name"
MISSING_API_KEY = "missing_api_key"
MISSING_ENDPOINT = "missing_endpoint"
# Cấu hình embedding của bộ đã chốt, đổi là phải index lại.
EMBEDDING_IMMUTABLE = "embedding_immutable"
# Bộ xin model embedding mà server không nạp.
EMBEDDING_NOT_SERVED = "embedding_not_served"


def api_error(status_code: int, code: str, message: str, **extra: Any) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, **extra},
    )
