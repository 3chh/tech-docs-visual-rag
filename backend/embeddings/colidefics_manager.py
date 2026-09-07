from colpali_engine.models import ColIdefics3, ColIdefics3Processor

from .base import BaseEmbeddingManager


class ColIdeficsManager(BaseEmbeddingManager):
    model_cls = ColIdefics3
    processor_cls = ColIdefics3Processor
