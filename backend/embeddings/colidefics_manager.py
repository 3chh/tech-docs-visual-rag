from colpali_engine.models import ColIdefics3, ColIdefics3Processor
from transformers.utils.import_utils import is_flash_attn_2_available
from .base import BaseEmbeddingManager
import torch

class ColIdeficsManager(BaseEmbeddingManager):
    model_cls = ColIdefics3
    processor_cls = ColIdefics3Processor

    def __init__(self, device="cuda", model_name="vidore/colSmol-256M", max_num_visual_tokens=None):
        attn_impl = "flash_attention_2" if is_flash_attn_2_available() else None
        print(f"Initializing ColIdefics3Manager with device {device}, model {model_name}, attn_impl={attn_impl}")
        self.device = device
        self.model = self.model_cls.from_pretrained(
            model_name,
            torch_dtype=torch.bfloat16,
            device_map=device,
            attn_implementation=attn_impl,
        ).eval()
        if max_num_visual_tokens is not None:
            self.processor = self.processor_cls.from_pretrained(model_name, max_num_visual_tokens=max_num_visual_tokens)
        else:
            self.processor = self.processor_cls.from_pretrained(model_name)
