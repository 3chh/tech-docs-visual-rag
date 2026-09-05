"""Tiện ích đọc ảnh-mục trả về cho client dưới dạng base64."""

import base64
import os
from pathlib import Path

from ...core.logging import get_logger

logger = get_logger(__name__)


def encode_image_base64(image_path: str | Path) -> str | None:
    """Trả data-URI PNG, hoặc None nếu file không tồn tại/không đọc được."""
    try:
        path = Path(image_path)
        if not path.exists():
            logger.warning("Không tìm thấy ảnh: %s", image_path)
            return None
        encoded = base64.b64encode(path.read_bytes()).decode("utf-8")
        return f"data:image/png;base64,{encoded}"
    except OSError as e:
        logger.error("Lỗi đọc ảnh %s: %s", image_path, e)
        return None


def encode_chunk_images(chunk_images_dir: str | None) -> list[str]:
    """Encode các ảnh trang gốc của một mục, dùng để đối chiếu với ảnh ghép."""
    if not chunk_images_dir or not os.path.isdir(chunk_images_dir):
        return []

    encoded: list[str] = []
    for name in sorted(os.listdir(chunk_images_dir)):
        full = os.path.join(chunk_images_dir, name)
        if os.path.isfile(full):
            image = encode_image_base64(full)
            if image:
                encoded.append(image)
    return encoded
