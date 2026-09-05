"""Entrypoint Gradio UI.

Chạy: python -m frontend.app.main
"""

import logging

import gradio as gr

from .api_client import BackendClient
from .config import get_config
from .services.chat import ChatService
from .services.files import FileService
from .ui import chat, file_management

logger = logging.getLogger(__name__)

CSS = """
.gradio-container { max-width: 1600px !important; }
footer { display: none !important; }
"""


def build_ui() -> gr.Blocks:
    config = get_config()
    client = BackendClient()
    file_service = FileService(client)
    chat_service = ChatService(client)

    with gr.Blocks(title="Cosmo ChatPDF", css=CSS, theme=gr.themes.Soft()) as demo:
        gr.Markdown("# Cosmo ChatPDF\nHỏi–đáp trên tài liệu PDF scan bằng Visual RAG cấp mục.")

        backend_ok = client.health_check()
        gr.Markdown(
            f"**Backend:** `{config.backend_url}` — "
            + ("🟢 đang hoạt động" if backend_ok else "🔴 không kết nối được")
        )

        file_management.build_tab(file_service)
        chat.build_tab(chat_service)

    return demo


def main() -> None:
    config = get_config()
    logging.basicConfig(
        level=getattr(logging, config.log_level.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    )
    logger.info("Khởi động Cosmo ChatPDF UI, backend=%s", config.backend_url)

    build_ui().launch(
        server_name=config.server_name,
        server_port=config.server_port,
        show_api=False,
    )


if __name__ == "__main__":
    main()
