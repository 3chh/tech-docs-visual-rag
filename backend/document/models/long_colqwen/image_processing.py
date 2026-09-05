from __future__ import annotations

from typing import Optional, Union, Tuple

import numpy as np

from transformers.models.qwen2_vl.image_processing_qwen2_vl import (
    Qwen2VLImageProcessor as BaseQwen2VLImageProcessor,
)
from transformers.models.qwen2_vl.image_processing_qwen2_vl import (
    resize,
    to_channel_dimension_format,
    convert_to_rgb,
    to_numpy_array,
    get_image_size,
    infer_channel_dimension_format,
    is_scaled_image,
    make_list_of_images,
)
from transformers.image_utils import (
    ChannelDimension,
    PILImageResampling,
)
from transformers.utils import logging
import math

logger = logging.get_logger(__name__)

def smart_resize(
    height: int, width: int, factor: int = 28, min_pixels: int = 56 * 56, max_pixels: int = 14 * 14 * 4 * 1280
):
    """Rescales the image so that the following conditions are met:

    1. Both dimensions (height and width) are divisible by 'factor'.

    2. The total number of pixels is within the range ['min_pixels', 'max_pixels'].

    3. The aspect ratio of the image is maintained as closely as possible.

    """
    if max(height, width) / min(height, width) > 200:
        raise ValueError(
            f"absolute aspect ratio must be smaller than 200, got {max(height, width) / min(height, width)}"
        )
    h_bar = round(height / factor) * factor
    w_bar = round(width / factor) * factor
    if h_bar * w_bar > max_pixels:
        beta = math.sqrt((height * width) / max_pixels)
        h_bar = max(factor, math.floor(height / beta / factor) * factor)
        w_bar = max(factor, math.floor(width / beta / factor) * factor)
    elif h_bar * w_bar < min_pixels:
        beta = math.sqrt(min_pixels / (height * width))
        h_bar = math.ceil(height * beta / factor) * factor
        w_bar = math.ceil(width * beta / factor) * factor
    return h_bar, w_bar


def smart_resize_long(
    height: int,
    width: int,
    *,
    factor: int,
    min_pixels: int,
    max_pixels: int,
    min_width: Optional[int] = None,
) -> Tuple[int, int]:
    """Custom smart resize that prioritizes a minimum width and preserves aspect ratio.

    The function will:
    - Round the width up to the nearest multiple of ``factor`` and ensure it is at least ``min_width`` if provided
    - Scale height to preserve aspect ratio, rounded to nearest multiple of ``factor``
    - Validate the resulting total pixels w*h is within [min_pixels, max_pixels]

    Raises ValueError if constraints cannot be satisfied.
    """
    # print(f"min_width: {min_width}, width: {width}, height: {height}, factor: {factor}, min_pixels: {min_pixels}, max_pixels: {max_pixels}")
    # Round width and corresponding height to factor
    w_bar = round(min_width / factor) * factor
    h_bar = round(((w_bar / width) * height) / factor) * factor

    # print(f"w_bar: {w_bar}, h_bar: {h_bar}")

    total_pixels = h_bar * w_bar
    if total_pixels > max_pixels or total_pixels < min_pixels:
        print(f"Image size {w_bar}x{h_bar} has {total_pixels} pixels, which is outside the allowed range"
            f" [{min_pixels}, {max_pixels}]")
        h_bar, w_bar = smart_resize(height, width, factor, min_pixels, max_pixels)

    return h_bar, w_bar


class LongQwen2VLImageProcessor(BaseQwen2VLImageProcessor):
    """Qwen2-VL ImageProcessor that uses a custom smart resize policy.

    Adds ``min_width`` behavior on top of the base implementation.
    """

    def __init__(
        self,
        *,
        min_width: Optional[int] = 600,
        do_resize: bool = True,
        size: Optional[dict[str, int]] = None,
        resample: PILImageResampling = PILImageResampling.BICUBIC,
        do_rescale: bool = True,
        rescale_factor: Union[int, float] = 1 / 255,
        do_normalize: bool = True,
        image_mean: Optional[Union[float, list[float]]] = None,
        image_std: Optional[Union[float, list[float]]] = None,
        do_convert_rgb: bool = True,
        min_pixels: Optional[int] = None,
        max_pixels: Optional[int] = None,
        patch_size: int = 14,
        temporal_patch_size: int = 2,
        merge_size: int = 2,
        **kwargs,
    ) -> None:
        super().__init__(
            do_resize=do_resize,
            size=size,
            resample=resample,
            do_rescale=do_rescale,
            rescale_factor=rescale_factor,
            do_normalize=do_normalize,
            image_mean=image_mean,
            image_std=image_std,
            do_convert_rgb=do_convert_rgb,
            min_pixels=min_pixels,
            max_pixels=max_pixels,
            patch_size=patch_size,
            temporal_patch_size=temporal_patch_size,
            merge_size=merge_size,
            **kwargs,
        )
        self.min_width = min_width

    @classmethod
    def from_existing(
        cls, existing: BaseQwen2VLImageProcessor, *, min_width: Optional[int] = 600
    ) -> "LongQwen2VLImageProcessor":
        """Build a ``LongQwen2VLImageProcessor`` using the configuration of an existing base processor."""
        return cls(
            min_width=min_width,
            do_resize=existing.do_resize,
            size={**existing.size},
            resample=existing.resample,
            do_rescale=existing.do_rescale,
            rescale_factor=existing.rescale_factor,
            do_normalize=existing.do_normalize,
            image_mean=existing.image_mean,
            image_std=existing.image_std,
            do_convert_rgb=existing.do_convert_rgb,
            min_pixels=existing.min_pixels,
            max_pixels=existing.max_pixels,
            patch_size=existing.patch_size,
            temporal_patch_size=existing.temporal_patch_size,
            merge_size=existing.merge_size,
        )

    def _preprocess(
        self,
        images,
        do_resize: Optional[bool] = None,
        size: Optional[dict[str, int]] = None,
        resample: PILImageResampling = None,
        do_rescale: Optional[bool] = None,
        rescale_factor: Optional[float] = None,
        do_normalize: Optional[bool] = None,
        image_mean: Optional[Union[float, list[float]]] = None,
        image_std: Optional[Union[float, list[float]]] = None,
        patch_size: Optional[int] = None,
        temporal_patch_size: Optional[int] = None,
        merge_size: Optional[int] = None,
        do_convert_rgb: Optional[bool] = None,
        data_format: Optional[ChannelDimension] = ChannelDimension.FIRST,
        input_data_format: Optional[Union[str, ChannelDimension]] = None,
    ):
        # The following mirrors the base implementation with only the call to the resize policy replaced
        images = make_list_of_images(images)

        if do_convert_rgb:
            images = [convert_to_rgb(image) for image in images]

        # All transformations expect numpy arrays.
        images = [to_numpy_array(image) for image in images]

        if do_rescale and is_scaled_image(images[0]):
            logger.warning_once(
                "It looks like you are trying to rescale already rescaled images. If the input"
                " images have pixel values between 0 and 1, set `do_rescale=False` to avoid rescaling them again."
            )
        if input_data_format is None:
            # We assume that all images have the same channel dimension format.
            input_data_format = infer_channel_dimension_format(images[0])

        height, width = get_image_size(images[0], channel_dim=input_data_format)
        resized_height, resized_width = height, width
        processed_images = []
        for image in images:
            if do_resize:
                resized_height, resized_width = smart_resize_long(
                    height,
                    width,
                    factor=patch_size * merge_size,
                    min_pixels=size["shortest_edge"],
                    max_pixels=size["longest_edge"],
                    min_width=self.min_width,
                )
                image = resize(
                    image, size=(resized_height, resized_width), resample=resample, input_data_format=input_data_format
                )

            if do_rescale:
                image = self.rescale(image, scale=rescale_factor, input_data_format=input_data_format)

            if do_normalize:
                image = self.normalize(
                    image=image, mean=image_mean, std=image_std, input_data_format=input_data_format
                )

            image = to_channel_dimension_format(image, data_format, input_channel_dim=input_data_format)
            processed_images.append(image)

        patches = np.array(processed_images)
        if data_format == ChannelDimension.LAST:
            patches = patches.transpose(0, 3, 1, 2)
        if patches.shape[0] % temporal_patch_size != 0:
            repeats = np.repeat(
                patches[-1][np.newaxis], temporal_patch_size - (patches.shape[0] % temporal_patch_size), axis=0
            )
            patches = np.concatenate([patches, repeats], axis=0)
        channel = patches.shape[1]
        grid_t = patches.shape[0] // temporal_patch_size
        grid_h, grid_w = resized_height // patch_size, resized_width // patch_size
        patches = patches.reshape(
            grid_t,
            temporal_patch_size,
            channel,
            grid_h // merge_size,
            merge_size,
            patch_size,
            grid_w // merge_size,
            merge_size,
            patch_size,
        )
        patches = patches.transpose(0, 3, 6, 4, 7, 2, 1, 5, 8)
        flatten_patches = patches.reshape(
            grid_t * grid_h * grid_w, channel * temporal_patch_size * patch_size * patch_size
        )

        return flatten_patches, (grid_t, grid_h, grid_w)

    def get_number_of_image_patches(self, height: int, width: int, images_kwargs=None):
        """
        A utility that returns number of image patches for a given image size.

        Args:
            height (`int`):
                Height of the input image.
            width (`int`):
                Width of the input image.
            images_kwargs (`dict`, *optional*)
                Any kwargs to override defaults of the image processor.
        Returns:
            `int`: Number of image patches per image.
        """

        # print(f"using LongQwen2VLImageProcessor.get_number_of_image_patches")

        min_pixels = images_kwargs.get("min_pixels", None) or self.size["shortest_edge"]
        max_pixels = images_kwargs.get("max_pixels", None) or self.size["longest_edge"]
        patch_size = images_kwargs.get("patch_size", None) or self.patch_size
        merge_size = images_kwargs.get("merge_size", None) or self.merge_size

        factor = patch_size * merge_size
        resized_height, resized_width = smart_resize_long(
            height, width, factor=factor, min_pixels=min_pixels, max_pixels=max_pixels, min_width=self.min_width
        )
        grid_h, grid_w = resized_height // patch_size, resized_width // patch_size
        return grid_h * grid_w