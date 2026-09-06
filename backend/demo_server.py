"""Demo/Mock Backend Server cho Cosmo ChatPDF.

Chạy: python demo_server.py
Không cần GPU, không cần torch/cuda/model weights.
Cung cấp đầy đủ các endpoint API phục vụ UI và trả dữ liệu mẫu chân thực.
Hỗ trợ cả FastAPI (nếu có) lẫn fallback chuẩn về built-in http.server.
"""

import base64
import io
import json
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

if sys.platform == "win32":
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass

PORT = int(os.environ.get("BACKEND_PORT", 2005))

# --- Dữ liệu chuẩn mô phỏng (Demo Backend) ---



# --- Mock Dữ liệu chuẩn ---
MOCK_SETTINGS = {
    "runtime": {
        "top_k_default": 5,
        "top_k_min": 1,
        "top_k_max": 20,
        "use_toc_rewrite_default": True,
        "toc_preview_limit": 4,
    },
    "document": {
        "worker_endpoint": "http://worker:8001/upload_pdf/",
        "preprocess": {
            "cut_params": [0, 0, 0, 0],
            "padding": 30,
            "batch_size": 16,
            "text_model": "PP-OCRv5_server_det",
            "use_cut_padding": True,
            "pdf_to_image": {
                "dpi": 300,
                "min_dpi": 45,
                "anchor_size": 500990,
                "thread_count": 8,
                "vertical_split": True,
            },
        },
        "layout": {"model_name": "PP-DocLayout_plus-L", "batch_size": 32},
        "ocr": {
            "number_batch_size": 16,
            "title_batch_size": 16,
            "formula_batch_size": 16,
            "lazy_load": False,
        },
        "chunking": {
            "cut_padding": 60,
            "remove_page_number": True,
            "keep_chunk_pages": True,
            "min_section_height_px": 50,
        },
        "toc_validator": {
            "type": "gemini",
            "model_name": "gemini-2.0-flash",
            "endpoint": "https://generativelanguage.googleapis.com/v1beta/openai/",
            "temperature": 0.2,
        },
    },
    "indexing": {
        "embedding": {
            "type": "longcolqwen",
            "model_name": "tsystems/colqwen2.5-3b-multilingual-v1.0",
            "device": "cpu (demo mode)",
            "dim": 128,
            "max_num_visual_tokens": 8192,
            "min_width": 600,
            "doc_dim": 8203,
            "prefix_num_tokens": 11,
            "batching_mode": "dynamic",
            "max_token": 13000,
        },
        "vectordb": {
            "type": "qdrant-standalone",
            "uri": "http://localhost:6333",
            "collection_name": "context",
            "search_limit": 16384,
        },
    },
    "models": {
        "vlm": {
            "type": "openai",
            "endpoint": "http://localhost:3333/v1",
            "model_name": "OpenGVLab/InternVL3-8B",
            "api_key_configured": True,
        }
    },
    "metadata_dir": "./data/metadata",
    "log_level": "INFO",
}

MOCK_TOC = {
    "collection_name": "default",
    "total_books": 2,
    "books": [
        {
            "book_index": 0,
            "book_folder": "0",
            "title": "TCVN 11823:2017 - Tiêu chuẩn Thiết kế Cầu đường bộ (Phần 5: Kết cấu thép)",
            "total_pages": 142,
            "total_sections": 5,
            "page_numbers": {"0": "-1-", "1": "-2-", "2": "-93-", "3": "-94-", "4": "-95-"},
            "sections": [
                {
                    "index": 0,
                    "title": "noname",
                    "page_range": "1-5",
                    "formulas": 0,
                    "ancestors": [],
                    "ancestor_titles": ["Bìa và Mục lục tổng quan"],
                },
                {
                    "index": 1,
                    "title": "5.1 Phạm vi áp dụng và yêu cầu vật liệu",
                    "page_range": "6-15",
                    "formulas": 1,
                    "ancestors": [0],
                    "ancestor_titles": ["Chương 5: Kết cấu thép"],
                },
                {
                    "index": 2,
                    "title": "5.4.4 Cấu kiện chịu nén đúng tâm và nén uốn",
                    "page_range": "93-94",
                    "formulas": 3,
                    "ancestors": [0, 1],
                    "ancestor_titles": ["Chương 5: Kết cấu thép", "5.4 Trạng thái giới hạn chịu lực"],
                },
                {
                    "index": 3,
                    "title": "5.4.5 Cấu kiện chịu kéo đúng tâm",
                    "page_range": "95-98",
                    "formulas": 2,
                    "ancestors": [0, 1],
                    "ancestor_titles": ["Chương 5: Kết cấu thép", "5.4 Trạng thái giới hạn chịu lực"],
                },
                {
                    "index": 4,
                    "title": "5.7 Liên kết bu lông cường độ cao và mối hàn",
                    "page_range": "5-14",
                    "formulas": 4,
                    "ancestors": [0],
                    "ancestor_titles": ["Chương 5: Kết cấu thép"],
                },
            ],
        },
        {
            "book_index": 1,
            "book_folder": "1",
            "title": "QCVN 02:2022/BXD - Quy chuẩn Quốc gia về Số liệu Điều kiện Tự nhiên Xây dựng",
            "total_pages": 5,
            "total_sections": 4,
            "page_numbers": {"0": "-i-", "1": "-1-", "2": "-2-", "3": "-3-"},
            "sections": [
                {
                    "index": 0,
                    "title": "noname",
                    "page_range": "1-1",
                    "formulas": 0,
                    "ancestors": [],
                    "ancestor_titles": ["Bìa và Giới thiệu"],
                },
                {
                    "index": 1,
                    "title": "1.1 Quy định chung và phạm vi bắt buộc",
                    "page_range": "2-2",
                    "formulas": 0,
                    "ancestors": [0],
                    "ancestor_titles": ["1. Quy định chung"],
                },
                {
                    "index": 2,
                    "title": "2.2 Phân vùng gió bão và áp lực gió tiêu chuẩn",
                    "page_range": "3-3",
                    "formulas": 2,
                    "ancestors": [0],
                    "ancestor_titles": ["2. Dữ liệu khí tượng và gió"],
                },
                {
                    "index": 3,
                    "title": "3.3 Tổ hợp tác động và hệ số tầm quan trọng",
                    "page_range": "4-5",
                    "formulas": 1,
                    "ancestors": [0],
                    "ancestor_titles": ["3. Tác động tự nhiên"],
                },
            ],
        },
    ],
}

MOCK_COLLECTIONS = ["default", "qcvn-xaydung-2026", "tcvn-cau-duong", "ho-so-du-an-cau-nhat-tan"]


class DemoHandler(SimpleHTTPRequestHandler):
    def _send_json(self, data: dict | list, status: int = 200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # Chuẩn hoá path (bỏ tiền tố /api nếu có)
        if path.startswith("/api"):
            path = path[4:]

        if path in ("/health", "/healthz"):
            self._send_json({"status": "ok", "service": "cosmo-chatpdf-demo", "version": "1.0.0"})
            return

        if path in ("/api/v1/settings", "/settings"):
            self._send_json(MOCK_SETTINGS)
            return

        if path in ("/table_of_contents", "/api/v1/search/table_of_contents"):
            coll = query.get("collection_name", ["default"])[0]
            toc = dict(MOCK_TOC)
            toc["collection_name"] = coll
            self._send_json(toc)
            return

        if path.startswith("/list_collections"):
            self._send_json({"collections": MOCK_COLLECTIONS})
            return

        if path in ("/api/v1/search/collections", "/collections"):
            self._send_json(MOCK_COLLECTIONS)
            return

        self._send_json({"detail": f"Path {path} Not Found"}, status=404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith("/api"):
            path = path[4:]

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length > 0 else b"{}"
        try:
            payload = json.loads(body.decode("utf-8", errors="replace"))
        except Exception:
            payload = {}

        if path in ("/search_by_section_title", "/api/v1/search/search_by_section_title"):
            title = (
                payload.get("section_title")
                or payload.get("sectionTitle")
                or "5.4.4 Cấu kiện chịu nén đúng tâm và nén uốn"
            )
            is_qcvn = (
                "1.1" in title
                or "2.2" in title
                or "3.3" in title
                or payload.get("bookIndex") == 1
            )

            if is_qcvn:
                page = 2 if "1.1" in title else (3 if "2.2" in title else (4 if "3.3" in title else 1))
                formulas = []
                if "2.2" in title:
                    formulas = [
                        {"content": r"W_0 = \gamma \cdot q_{3s,10}", "coordinate": [100, 150, 450, 200], "page": "Trang 3"},
                        {"content": r"v_{10} = \sqrt{\dfrac{2 W_0}{\rho}}", "coordinate": [100, 220, 350, 260], "page": "Trang 3"},
                    ]
                elif "3.3" in title:
                    formulas = [
                        {"content": r"S_d = \sum \gamma_{Gi} G_{ki} + \gamma_{Q1} Q_{k1} + \sum \psi_{0j} Q_{kj}", "coordinate": [100, 150, 450, 200], "page": "Trang 4"},
                    ]
                result = {
                    "section_title": title,
                    "ancestors": ["QCVN 02:2022/BXD", "Số liệu điều kiện tự nhiên"],
                    "section_pages": [f"Trang {page}"],
                    "formulas": formulas,
                    "metadata": {"file_name": "qcvn_02_2022.pdf", "db_name": "qcvn"},
                    "image_path": f"/qcvn_02_2022.pdf#page={page}",
                    "image_base64": None,
                    "chunk_images": [],
                }
            else:
                page = 2 if "5.1" in title else (3 if "5.4.4" in title else (4 if "5.4.5" in title else (5 if "5.7" in title else 1)))
                formulas = []
                if "5.4.4" in title:
                    formulas = [
                        {"content": r"\sigma_c = \dfrac{N}{A_g} \le \sigma_{cud}", "coordinate": [100, 150, 450, 200], "page": "Trang 3"},
                        {"content": r"\lambda = \dfrac{l_e}{r}", "coordinate": [100, 220, 350, 260], "page": "Trang 3"},
                    ]
                elif "5.4.5" in title:
                    formulas = [
                        {"content": r"\sigma_t = \dfrac{N}{A_n} \le f_y", "coordinate": [100, 150, 450, 200], "page": "Trang 4"},
                    ]
                elif "5.7" in title:
                    formulas = [
                        {"content": r"V_n = 0.6 \cdot f_{ub} \cdot m \cdot A_b", "coordinate": [100, 150, 450, 200], "page": "Trang 5"},
                    ]
                result = {
                    "section_title": title,
                    "ancestors": ["Chương 5: Kết cấu thép", "5.4 Trạng thái giới hạn chịu lực"],
                    "section_pages": [f"Trang {page}"],
                    "formulas": formulas,
                    "metadata": {"file_name": "sample_document.pdf", "db_name": "tcvn"},
                    "image_path": f"/sample_document.pdf#page={page}",
                    "image_base64": None,
                    "chunk_images": [],
                }
            self._send_json({"results": [result], "total": 1})
            return

        if path in ("/api/v1/chat/ask", "/ask"):
            user_query = payload.get("query", "")
            source1 = {
                "section_title": "5.4.4 Cấu kiện chịu nén đúng tâm và nén uốn",
                "ancestors": ["Chương 5: Kết cấu thép", "5.4 Trạng thái giới hạn chịu lực"],
                "section_pages": ["Trang 3", "Trang 4"],
                "formulas": [
                    {"content": r"\sigma_c = \dfrac{N}{A_g} \le \sigma_{cud}", "coordinate": [100, 150, 450, 200], "page": "Trang 3"},
                    {"content": r"\lambda = \dfrac{l_e}{r}", "coordinate": [100, 220, 350, 260], "page": "Trang 3"},
                ],
                "metadata": {"file_name": "sample_document.pdf", "db_name": "tcvn"},
                "image_path": "/sample_document.pdf#page=3",
                "image_base64": None,
                "chunk_images": [],
            }

            answer_text = (
                f"Đối với câu hỏi **\"{user_query}\"**:\n\n"
                "1. **Điều kiện kiểm tra cường độ chịu nén:**\n"
                "Theo **Mục 5.4.4** (Trang 3), ứng suất nén tính toán phải thỏa mãn công thức giới hạn:\n\n"
                "$$\\sigma_c = \\frac{N}{A_g} \\le \\sigma_{cud}$$\n\n"
                "Trong đó:\n"
                "- $N$: Lực nén dọc trục tính toán theo tổ hợp tác động cơ bản.\n"
                "- $A_g$: Diện tích mặt cắt ngang nguyên của thanh thép.\n"
                "- $\\sigma_{cud}$ : Ứng suất nén giới hạn danh định, phụ thuộc vào độ mảnh $\\lambda = \\dfrac{l_e}{r}$.\n\n"
                "2. **Hệ số uốn dọc và ổn định cục bộ:**\n"
                "Được tra theo **Bảng 5.4.1** (Trang 4) căn cứ vào cấp độ dẻo và bề dày bản cánh/bản bụng."
            )

            response = {
                "query": user_query,
                "answer": answer_text,
                "rewritten_query": "Quy định tính toán kiểm tra khả năng chịu nén cấu kiện thép theo TCVN 11823",
                "sources": [source1],
                "total_sources": 1,
            }
            self._send_json(response)
            return

        if path in ("/upload_files", "/upload_files/", "/api/v1/indexing/upload"):
            self._send_json({
                "success": True,
                "message": "Giả lập upload và phân tích PDF thành công trong chế độ Demo.",
                "processed_files": 1,
                "total_pages": 35,
                "file_pages": {"tailieu_demo.pdf": 35},
                "errors": [],
            })
            return

        if path in ("/search_with_images", "/api/v1/search/search_with_images"):
            result = {
                "section_title": "5.4.4 Cấu kiện chịu nén đúng tâm và nén uốn",
                "ancestors": ["Chương 5: Kết cấu thép", "5.4 Trạng thái giới hạn chịu lực"],
                "section_pages": ["Trang 3", "Trang 4"],
                "formulas": [
                    {"content": r"\sigma_c = \dfrac{N}{A_g} \le \sigma_{cud}", "coordinate": [100, 150, 450, 200], "page": "Trang 3"},
                ],
                "metadata": {"file_name": "sample_document.pdf", "db_name": "tcvn"},
                "image_path": "/sample_document.pdf#page=3",
                "image_base64": None,
                "chunk_images": [],
            }
            self._send_json({
                "user_id": payload.get("user_id", "default"),
                "query": payload.get("query", ""),
                "top_k": payload.get("top_k", 5),
                "results": [result],
                "total_results": 1,
            })
            return

        self._send_json({"detail": f"Path {path} not mocked"}, status=404)


def run():
    server = HTTPServer(("0.0.0.0", PORT), DemoHandler)
    print("================================================================")
    print(f"[INFO] Cosmo ChatPDF Demo Backend Server running at:")
    print(f"[INFO] http://localhost:{PORT}")
    print(f"[INFO] Supporting APIs: /health, /settings, /table_of_contents, /ask...")
    print("================================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[INFO] Stopped Demo Backend Server.")
        server.server_close()


if __name__ == "__main__":
    run()
