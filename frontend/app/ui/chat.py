"""Tab hỏi–đáp: câu hỏi, ảnh-mục tìm được, câu trả lời, bảng theo dõi."""

import logging

import gradio as gr

from ..api_client import BackendError
from ..services.chat import ChatService
from .agent_panel import conversation_log

logger = logging.getLogger(__name__)


def build_tab(chat_service: ChatService) -> None:
    with gr.Tab("💬 Hỏi đáp"):
        with gr.Row():
            with gr.Column(scale=3):
                collection_input = gr.Textbox(label="Collection", value="default")
                query_input = gr.Textbox(
                    label="Câu hỏi",
                    placeholder="Hỏi gì đó về tài liệu...",
                    lines=3,
                )

                with gr.Row():
                    top_k_input = gr.Slider(
                        label="Số mục lấy về", minimum=1, maximum=20, value=5, step=1
                    )
                    toc_rewrite_input = gr.Checkbox(
                        label="Viết lại câu hỏi theo mục lục",
                        value=True,
                        info="Dùng ảnh mục lục để chuẩn hoá thuật ngữ trước khi tìm",
                    )

                search_btn = gr.Button("🔍 Tìm và trả lời", variant="primary")

                answer_output = gr.Markdown(label="Câu trả lời", value="")
                gallery_output = gr.Gallery(
                    label="Ảnh-mục tham chiếu",
                    columns=2,
                    height=500,
                    object_fit="contain",
                )

            with gr.Column(scale=2):
                gr.Markdown("### Theo dõi xử lý")
                status_output = gr.Textbox(label="Trạng thái", value="🟢 Sẵn sàng", interactive=False)
                agent_output = gr.Markdown(value="_Chưa có hoạt động nào._")
                stats_output = gr.Textbox(
                    label="Thống kê", value="Chưa có số liệu", interactive=False, lines=6
                )

                with gr.Row():
                    refresh_btn = gr.Button("🔄 Làm mới", size="sm")
                    clear_log_btn = gr.Button("🗑️ Xoá log", size="sm")

                with gr.Accordion("Tuỳ chỉnh nâng cao", open=False):
                    system_prompt_input = gr.Textbox(
                        label="System prompt",
                        placeholder="Để trống sẽ dùng prompt mặc định",
                        lines=6,
                    )

        def on_search(collection, query, top_k, use_toc_rewrite, system_prompt):
            if not query or not query.strip():
                return (
                    "Vui lòng nhập câu hỏi.",
                    [],
                    conversation_log.status(),
                    conversation_log.format(),
                    conversation_log.stats(),
                )

            try:
                image_paths, answer = chat_service.answer(
                    query=query.strip(),
                    collection=collection.strip() or "default",
                    top_k=int(top_k),
                    system_prompt=system_prompt.strip(),
                    use_toc_rewrite=use_toc_rewrite,
                )
            except BackendError as e:
                conversation_log.add("Chat", "error", str(e))
                return (
                    f"**Lỗi kết nối backend**\n\n{e}",
                    [],
                    conversation_log.status(),
                    conversation_log.format(),
                    conversation_log.stats(),
                )
            except Exception as e:
                logger.exception("Lỗi khi xử lý câu hỏi")
                conversation_log.add("Chat", "error", str(e))
                return (
                    f"**Đã xảy ra lỗi**\n\n{e}",
                    [],
                    conversation_log.status(),
                    conversation_log.format(),
                    conversation_log.stats(),
                )

            return (
                answer,
                image_paths,
                conversation_log.status(),
                conversation_log.format(),
                conversation_log.stats(),
            )

        def on_refresh():
            return conversation_log.status(), conversation_log.format(), conversation_log.stats()

        def on_clear_log():
            conversation_log.clear()
            return "🟢 Sẵn sàng", "_Chưa có hoạt động nào._", "Chưa có số liệu"

        search_btn.click(
            on_search,
            inputs=[
                collection_input,
                query_input,
                top_k_input,
                toc_rewrite_input,
                system_prompt_input,
            ],
            outputs=[answer_output, gallery_output, status_output, agent_output, stats_output],
        )
        refresh_btn.click(on_refresh, outputs=[status_output, agent_output, stats_output])
        clear_log_btn.click(on_clear_log, outputs=[status_output, agent_output, stats_output])
