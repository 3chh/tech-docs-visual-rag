"""Tab quản lý file: thêm vào hàng đợi, index, xoá."""

import gradio as gr

from ..services.files import FileService


def build_tab(file_service: FileService) -> None:
    with gr.Tab("📁 Quản lý tài liệu"):
        gr.Markdown(
            "Thêm file PDF vào hàng đợi rồi bấm **Index tất cả**. "
            "Mỗi file trở thành một cuốn trong collection."
        )

        with gr.Row():
            with gr.Column(scale=2):
                collection_input = gr.Textbox(
                    label="Collection",
                    value="default",
                    info="Các file cùng collection sẽ được tìm kiếm chung",
                )
                files_input = gr.File(
                    label="File PDF",
                    file_count="multiple",
                    file_types=[".pdf"],
                )
            with gr.Column(scale=1):
                display_name_input = gr.Textbox(
                    label="Tên hiển thị",
                    placeholder="Để trống sẽ lấy tên file",
                )
                vertical_split_input = gr.Checkbox(
                    label="Tách đôi trang",
                    value=False,
                    info="Bật khi sách scan 2 trang trên một tờ",
                )
                max_pages_input = gr.Number(
                    label="Giới hạn số trang",
                    value=None,
                    precision=0,
                    info="Để trống là xử lý toàn bộ",
                )

        with gr.Row():
            add_btn = gr.Button("➕ Thêm vào hàng đợi", variant="secondary")
            process_btn = gr.Button("🚀 Index tất cả", variant="primary")
            clear_btn = gr.Button("🗑️ Xoá hàng đợi", variant="stop")

        status_output = gr.Textbox(label="Trạng thái", interactive=False, lines=4)
        queue_output = gr.Markdown(label="Hàng đợi", value="_Hàng đợi trống._")

        with gr.Row():
            remove_index_input = gr.Number(label="Xoá file số", value=0, precision=0)
            remove_btn = gr.Button("Xoá file", variant="secondary")

        def on_add(collection, files, display_name, vertical_split, max_pages):
            paths = [f.name for f in files] if files else []
            max_pages_value = int(max_pages) if max_pages else None
            message = file_service.add_files(
                collection, paths, display_name, vertical_split, max_pages_value
            )
            return message, file_service.format_queue(collection)

        def on_process(collection):
            message = file_service.process_all(collection)
            return message, file_service.format_queue(collection)

        def on_clear(collection):
            count = file_service.queue.clear(collection)
            return f"Đã xoá {count} file khỏi hàng đợi.", file_service.format_queue(collection)

        def on_remove(collection, index):
            removed = file_service.queue.remove(collection, int(index))
            message = (
                f"Đã xoá: {removed.display_name}" if removed else "Không có file ở vị trí đó."
            )
            return message, file_service.format_queue(collection)

        add_btn.click(
            on_add,
            inputs=[
                collection_input,
                files_input,
                display_name_input,
                vertical_split_input,
                max_pages_input,
            ],
            outputs=[status_output, queue_output],
        )
        process_btn.click(
            on_process, inputs=[collection_input], outputs=[status_output, queue_output]
        )
        clear_btn.click(
            on_clear, inputs=[collection_input], outputs=[status_output, queue_output]
        )
        remove_btn.click(
            on_remove,
            inputs=[collection_input, remove_index_input],
            outputs=[status_output, queue_output],
        )
