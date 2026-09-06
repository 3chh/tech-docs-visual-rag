"""Sinh câu trả lời: VLM đọc thẳng ảnh-mục.

Chuyển từ frontend về backend để API key VLM không phải đi ra trình duyệt.
"""

import base64
import os
import re
from pathlib import Path

from ...core.config import get_settings
from ...core.logging import get_logger
from ...core.collections import require_config
from ...core.providers import ResolvedModel, resolve_connection
from ...prompts.rag_prompts import (
    build_toc_rewrite_prompt,
    rag_prompt,
    toc_rewrite_system_prompt,
)
from .retrieval import RetrievalService

logger = get_logger(__name__)

QUERY_TAG_RE = re.compile(r"<query>(.*?)</query>", re.DOTALL)
TOC_PREVIEW_LIMIT = 20

# Mặc định của server, dùng khi cả client và cấu hình bộ đều không nói gì.
DEFAULT_TOP_K = 5
DEFAULT_USE_TOC_REWRITE = True


def _first_set(*values):
    """Giá trị đầu tiên không phải None. Dùng cho chuỗi ưu tiên cấu hình."""
    for value in values:
        if value is not None:
            return value
    return None


def _encode_image(image_path: str) -> str | None:
    try:
        path = Path(image_path)
        if not path.exists():
            logger.warning("Không tìm thấy ảnh: %s", image_path)
            return None
        return base64.b64encode(path.read_bytes()).decode("utf-8")
    except OSError as e:
        logger.error("Lỗi đọc ảnh %s: %s", image_path, e)
        return None


class RagService:
    def __init__(self, collection: str, connection_id: str | None = None):
        self.settings = get_settings()
        self.collection = collection
        self.retrieval = RetrievalService(collection)

        self.config = require_config(collection)

        # Mặc định lấy kết nối mà bộ tài liệu này đã chọn lúc tạo. Cho phép
        # ghi đè để thử model khác mà không phải sửa cấu hình bộ.
        if connection_id is None:
            connection_id = self.config.vlm_connection_id

        self.model: ResolvedModel = resolve_connection(connection_id, "vlm")
        self._client = None

    @property
    def client(self):
        # Khởi tạo trễ để service lên được ngay cả khi chưa cấu hình VLM.
        if self._client is None:
            from openai import OpenAI

            self._client = OpenAI(**self.model.as_client_kwargs())
        return self._client

    def _ask_vlm(
        self,
        prompt: str,
        image_paths: list[str],
        system_prompt: str,
        temperature: float | None = None,
    ) -> str:
        content: list[dict] = [{"type": "text", "text": prompt}]

        for image_path in image_paths:
            if not image_path:
                continue
            encoded = _encode_image(os.path.abspath(image_path))
            if encoded:
                content.append(
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{encoded}"},
                    }
                )

        if len(content) == 1:
            return "Không đọc được ảnh của các mục tìm thấy."

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": content})

        kwargs: dict = {}
        if temperature is not None:
            kwargs["temperature"] = temperature

        response = self.client.chat.completions.create(
            model=self.model.model_name,
            messages=messages,
            **kwargs,
        )
        return response.choices[0].message.content or ""

    def rewrite_query(
        self, query: str, preview_limit: int | None = None
    ) -> tuple[str, str | None]:
        """Neo câu hỏi vào mục lục thật của corpus.

        Mục "noname" chứa bìa và mục lục; cho VLM nhìn vào đó rồi viết lại câu
        hỏi bằng đúng thuật ngữ có trong tài liệu.

        Trả (câu tìm kiếm, câu đã viết lại hoặc None nếu không đổi).
        """
        try:
            toc_results = self.retrieval.search_by_section_title(
                "noname", limit=preview_limit or TOC_PREVIEW_LIMIT
            )
        except Exception as e:
            logger.warning("Không lấy được mục lục để viết lại câu hỏi: %s", e)
            return query, None

        toc_images = [r.get("image_path", "") for r in (toc_results or []) if r.get("image_path")]
        if not toc_images:
            logger.info("Không có ảnh mục lục, dùng câu hỏi gốc")
            return query, None

        try:
            raw = self._ask_vlm(
                build_toc_rewrite_prompt(query),
                toc_images,
                toc_rewrite_system_prompt,
            )
        except Exception as e:
            logger.warning("Viết lại câu hỏi thất bại, dùng câu gốc: %s", e)
            return query, None

        match = QUERY_TAG_RE.search(raw or "")
        if not match:
            logger.warning("Phản hồi không có thẻ <query>, dùng câu gốc")
            return query, None

        rewritten = match.group(1).strip()
        # Giữ cả câu gốc: câu viết lại có thể lệch ý, câu gốc neo lại ý định.
        return f"{query}({rewritten})", rewritten

    def ask(
        self,
        query: str,
        top_k: int | None = None,
        system_prompt: str | None = None,
        use_toc_rewrite: bool | None = None,
        toc_preview_limit: int | None = None,
        vlm_temperature: float | None = None,
    ) -> dict:
        """Thứ tự ưu tiên: tham số client truyền -> cấu hình bộ -> server."""
        saved = self.config.ask
        top_k = _first_set(top_k, saved.get("top_k"), DEFAULT_TOP_K)
        system_prompt = _first_set(system_prompt, saved.get("system_prompt"), "")
        use_toc_rewrite = _first_set(
            use_toc_rewrite, saved.get("use_toc_rewrite"), DEFAULT_USE_TOC_REWRITE
        )
        toc_preview_limit = _first_set(toc_preview_limit, saved.get("toc_preview_limit"))
        vlm_temperature = _first_set(vlm_temperature, saved.get("vlm_temperature"))

        rewritten: str | None = None
        search_query = query

        if use_toc_rewrite:
            search_query, rewritten = self.rewrite_query(query, toc_preview_limit)

        search_results = self.retrieval.search([search_query], top_k)
        payloads = search_results[0][:top_k] if search_results else []
        image_paths = [p.get("image_path", "") for p in payloads if p.get("image_path")]

        if not image_paths:
            return {
                "answer": "Không tìm thấy mục nào phù hợp trong bộ tài liệu này.",
                "rewritten_query": rewritten,
                "payloads": [],
                "connection_id": self.model.connection_id,
                "model_name": self.model.model_name,
            }

        answer = self._ask_vlm(
            query, image_paths, system_prompt or rag_prompt, vlm_temperature
        )
        logger.info(
            "Đã sinh câu trả lời (%d ký tự) từ %d mục bằng %s",
            len(answer),
            len(image_paths),
            self.model.name,
        )

        return {
            "answer": answer,
            "rewritten_query": rewritten,
            "payloads": payloads,
            "connection_id": self.model.connection_id,
            "model_name": self.model.model_name,
        }
