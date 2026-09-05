from colpali_engine.models import ColPali, ColPaliProcessor
from .base import BaseEmbeddingManager
import torch

class ColpaliManager(BaseEmbeddingManager):
    model_cls = ColPali
    processor_cls = ColPaliProcessor

    def __init__(self, device="cuda", model_name="vidore/colpali-v0.2", max_num_visual_tokens=None):
        self.device = device
        self.model = self.model_cls.from_pretrained(
            model_name,
            torch_dtype=torch.bfloat16,
            device_map=device,
        ).eval()
        if max_num_visual_tokens is not None:
            self.processor = self.processor_cls.from_pretrained(model_name, max_num_visual_tokens=max_num_visual_tokens)
        else:
            self.processor = self.processor_cls.from_pretrained(model_name)