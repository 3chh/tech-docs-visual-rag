from colpali_engine.models import ColQwen2_5

from ..document.models.long_colqwen.processor import LongColQwen2_5_Processor
from .base import BaseEmbeddingManager


class LongColQwenManager(BaseEmbeddingManager):
    """ColQwen với smart_resize ghim chiều rộng, để chiều cao tự do.

    Nhờ vậy một trang A4 dài không bị nén ngang tới mức mất chữ nhỏ.
    """

    model_cls = ColQwen2_5
    processor_cls = LongColQwen2_5_Processor
    supports_min_width = True
