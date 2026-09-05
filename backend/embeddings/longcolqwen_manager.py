from colpali_engine.models import ColQwen2_5
from ..document.models.long_colqwen.processor import LongColQwen2_5_Processor
from transformers.utils.import_utils import is_flash_attn_2_available
from .base import BaseEmbeddingManager
import torch

class LongColQwenManager(BaseEmbeddingManager):
    model_cls = ColQwen2_5
    processor_cls = LongColQwen2_5_Processor

    def __init__(self, device="cuda", model_name="vidore/colqwen2.5-v0.2", max_num_visual_tokens=None, min_width=None):
        attn_impl = "flash_attention_2" if is_flash_attn_2_available() else None
        print(f"Initializing LongColQwenManager with device {device}, model {model_name}, attn_impl={attn_impl}")
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

        if min_width is not None:
            self.processor.image_processor.min_width = min_width