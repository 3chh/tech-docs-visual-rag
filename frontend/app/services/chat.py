"""Luồng hỏi–đáp: viết lại câu hỏi theo mục lục, tìm ảnh-mục, VLM trả lời."""

import logging
import re

from ..api_client import BackendClient, BackendError
from ..prompts import build_toc_rewrite_prompt, rag_prompt, toc_rewrite_system_prompt
from ..rag import RagClient
from ..ui.agent_panel import conversation_log

logger = logging.getLogger(__name__)

QUERY_TAG_RE = re.compile(r"<query>(.*?)</query>", re.DOTALL)
TOC_PREVIEW_LIMIT = 20


class ChatService:
    def __init__(self, client: BackendClient | None = None, rag: RagClient | None = None):
        self.client = client or BackendClient()
        self._rag = rag

    @property
    def rag(self) -> RagClient:
        # Khởi tạo trễ để frontend chạy được ngay cả khi chưa cấu hình VLM.
        if self._rag is None:
            self._rag = RagClient()
        return self._rag

    def _rewrite_query_from_toc(self, query: str, collection: str) -> str:
        """Neo câu hỏi vào mục lục thật của corpus.

        Mục "noname" chứa bìa và mục lục; cho VLM nhìn vào đó rồi viết lại câu
        hỏi bằng đúng thuật ngữ có trong tài liệu.
        """
        try:
            toc = self.client.search_by_section_title(
                section_title="noname",
                user_id=collection,
                limit=TOC_PREVIEW_LIMIT,
                include_base64=False,
            )
        except BackendError as e:
            logger.warning("Không lấy được mục lục để viết lại câu hỏi: %s", e)
            return query

        toc_images = [r.get("image_path", "") for r in toc.get("results", []) if r.get("image_path")]
        if not toc_images:
            logger.info("Không có ảnh mục lục, dùng câu hỏi gốc")
            return query

        conversation_log.add("QueryRewrite", "info", f"Đọc {len(toc_images)} ảnh mục lục")

        try:
            raw = self.rag.get_answer(
                build_toc_rewrite_prompt(query),
                toc_images,
                system_prompt=toc_rewrite_system_prompt,
            )
        except Exception as e:
            logger.warning("Viết lại câu hỏi thất bại, dùng câu gốc: %s", e)
            conversation_log.add("QueryRewrite", "warning", "Không viết lại được, dùng câu gốc")
            return query

        match = QUERY_TAG_RE.search(raw or "")
        if not match:
            logger.warning("Phản hồi không có thẻ <query>, dùng câu gốc")
            return query

        rewritten = match.group(1).strip()
        # Giữ cả câu gốc: câu viết lại có thể lệch ý, câu gốc neo lại ý định.
        combined = f"{query}({rewritten})"
        conversation_log.add("QueryRewrite", "output", f"Câu hỏi mở rộng: {rewritten}")
        return combined

    def answer(
        self,
        query: str,
        collection: str,
        top_k: int = 5,
        system_prompt: str = "",
        use_toc_rewrite: bool = True,
    ) -> tuple[list[str], str]:
        """Trả về (danh sách ảnh-mục, câu trả lời)."""
        conversation_log.clear()
        conversation_log.add("Chat", "input", f"Câu hỏi: {query}")

        search_query = query
        if use_toc_rewrite:
            search_query = self._rewrite_query_from_toc(query, collection)

        conversation_log.add("Search", "info", f"Tìm kiếm trong collection '{collection}'")
        result = self.client.search_documents(
            query=search_query,
            user_id=collection,
            top_k=top_k,
            include_images=True,
        )

        image_paths = [r.get("image_path", "") for r in result.get("results", [])]
        image_paths = [p for p in image_paths if p]
        conversation_log.add("Search", "output", f"Tìm được {len(image_paths)} mục liên quan")

        if not image_paths:
            conversation_log.add("Chat", "warning", "Không tìm thấy tài liệu phù hợp")
            return [], "Không tìm thấy tài liệu nào phù hợp với câu hỏi của bạn."

        conversation_log.add("RAG", "info", "VLM đang đọc ảnh và soạn câu trả lời...")
        answer = self.rag.get_answer(query, image_paths, system_prompt=system_prompt or rag_prompt)
        conversation_log.add("RAG", "output", f"Đã sinh câu trả lời ({len(answer)} ký tự)")
        conversation_log.add("Chat", "info", "Hoàn tất")

        return image_paths, answer
