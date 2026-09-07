from colpali_engine.models import ColPali, ColPaliProcessor

from .base import BaseEmbeddingManager


class ColpaliManager(BaseEmbeddingManager):
    model_cls = ColPali
    processor_cls = ColPaliProcessor
    # ColPali không nhận attn_implementation.
    accepts_attn_impl = False
