from colpali_engine.models import ColQwen2_5, ColQwen2_5_Processor

from .base import BaseEmbeddingManager


class ColQwenManager(BaseEmbeddingManager):
    model_cls = ColQwen2_5
    processor_cls = ColQwen2_5_Processor
