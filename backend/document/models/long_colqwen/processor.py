from typing import Tuple

from colpali_engine.models import ColQwen2_5_Processor

from .image_processing import LongQwen2VLImageProcessor, smart_resize_long

class LongColQwen2_5_Processor(ColQwen2_5_Processor):
    def __init__(self, *args, **kwargs):
        self.min_width = kwargs.get("min_width", 600)
        super().__init__(*args, **kwargs)
        # print(f"Using LongColQwen2_5_Processor with min_width: {self.min_width}")

    @classmethod
    def from_pretrained(cls, *args, **kwargs):
        instance = super().from_pretrained(*args, **kwargs)
        instance.min_width = kwargs.get("min_width", getattr(instance, "min_width", 600))
        # Replace underlying image processor with our custom one while preserving config
        instance.image_processor = LongQwen2VLImageProcessor.from_existing(
            instance.image_processor, min_width=instance.min_width
        )
        print("Using LongColQwen2_5_Processor")
        return instance

    def get_n_patches(self, image_size: Tuple[int, int], spatial_merge_size: int) -> Tuple[int, int]:
        patch_size = self.image_processor.patch_size
        height_new, width_new = smart_resize_long(
            height=image_size[1],
            width=image_size[0],
            factor=patch_size * self.image_processor.merge_size,
            min_pixels=self.image_processor.size["shortest_edge"],
            max_pixels=self.image_processor.size["longest_edge"],
            min_width=self.min_width,
        )

        n_patches_x = width_new // patch_size // spatial_merge_size
        n_patches_y = height_new // patch_size // spatial_merge_size
        return n_patches_x, n_patches_y
