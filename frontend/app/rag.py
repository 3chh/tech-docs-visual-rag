"""Gọi VLM đọc ảnh-mục và sinh câu trả lời."""

import base64
import logging
import os
from pathlib import Path

from openai import OpenAI

from .config import get_config

logger = logging.getLogger(__name__)


def encode_image(image_path: str) -> str:
    return base64.b64encode(Path(image_path).read_bytes()).decode("utf-8")


class RagClient:
    """VLM nhìn thẳng vào ảnh tài liệu, không qua OCR."""

    def __init__(self, endpoint: str | None = None, model_name: str | None = None):
        config = get_config()
        self.model_name = model_name or config.vlm_model_name
        self.client = OpenAI(
            base_url=endpoint or config.vlm_endpoint,
            api_key=config.vlm_api_key,
        )
        logger.info("RAG client | model=%s endpoint=%s", self.model_name, endpoint or config.vlm_endpoint)

    def get_answer(
        self,
        query: str,
        image_paths: list[str],
        system_prompt: str = "",
    ) -> str:
        message_content: list[dict] = [{"type": "text", "text": query}]

        for image_path in image_paths:
            if not image_path:
                continue
            abs_path = os.path.abspath(image_path)
            if not os.path.exists(abs_path):
                logger.warning("Bỏ qua ảnh không tồn tại: %s", abs_path)
                continue
            message_content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{encode_image(abs_path)}"},
                }
            )

        if len(message_content) == 1:
            return "Không tìm thấy tài liệu nào phù hợp với câu hỏi của bạn."

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": message_content})

        response = self.client.chat.completions.create(model=self.model_name, messages=messages)
        return response.choices[0].message.content or ""
