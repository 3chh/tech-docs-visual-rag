"""Pipeline xử lý PDF: từ file scan thành các ảnh-mục kèm metadata.

Luồng:
    1. PDF -> ảnh (DPI động, tách đôi trang, cắt lề theo text detection)
    2. Layout detection: tiêu đề / công thức / số trang
    3. Suy ra biên mục (page, y) từ vị trí tiêu đề
    4. Gán element vào mục
    5. OCR một lần, lưu ra JSON để các bước sau dùng lại
    6. LLM sửa cây mục lục
    7. Ghép ảnh-mục + transform toạ độ công thức

Bước 5 tách riêng để bước 7 không phải chạy lại model — đó là lý do OCR data
được ghi ra file thay vì giữ trong bộ nhớ.
"""

import json
from contextlib import contextmanager
from copy import deepcopy
import os
import shutil
from pathlib import Path
from typing import Dict, List, Optional
try:
    import fitz
except ImportError:
    fitz = None

try:
    from paddleocr import TextDetection
except ImportError:
    TextDetection = None

try:
    from pdf2image import convert_from_path
except ImportError:
    convert_from_path = None

from PIL import Image

from ..core.logging import get_logger
from ..core.paths import metadata_dir
from .detected_element import DetectedElement
from .document_section import DocumentSection
from .element_detector import ElementDetector
from .llm_report_valid import ReportValidator
from .padding_remover import process_folder_cut_detect_pad
from .section_analyzer import SectionAnalyzer
from .section_merger import SectionMerger
from .summary_reporter import SummaryReporter

logger = get_logger(__name__)


class PdfManager:
    def __init__(self, config: dict):
        self.config = config
        self.section_analyzer = SectionAnalyzer()
        self.summary_reporter = SummaryReporter(config.get("summary_reporter", {}))
        self.section_merger = SectionMerger(config.get("section_merger", {}))
        self.element_detector = ElementDetector(config.get("element_detector", {}))
        self.report_validator = ReportValidator(config.get("llm_validator", {}))

        self.all_elements: List[DetectedElement] = []
        self.sections: List[DocumentSection] = []
        self.page_image_dict: Dict[int, Image.Image] = {}
        self.page_image_list: List[Image.Image] = []
        self.summary_report: dict = {}

    def get_dynamic_dpi(self, pdf_path: str, anchor_size: int = 500990, dpi: int = 300) -> int:
        """Chuẩn hoá số pixel giữa các khổ sách khác nhau.

        Sách khổ lớn render ở DPI thấp hơn để ảnh ra có cùng lượng pixel, nhờ đó
        ngân sách visual token của ColQwen ổn định giữa các tài liệu.
        """
        with fitz.open(pdf_path) as pdf_document:
            page = pdf_document[0]
            width, height = page.rect.width, page.rect.height
        logger.info("Kích thước PDF: %.0fx%.0f", width, height)
        return int(anchor_size / (width * height) * dpi)

    def process_pdf_to_image_and_cut_padding(
        self,
        output_dir,
        pdf_path: str = None,
        max_pages: int = None,
        do_vertical_split: bool = True,
        draw_debug: bool = True,
    ):
        config = self.config.get("preprocess_pdf", {})
        cut_params = tuple(config.get("cut_params", [20, 10, 80, 100]))
        padding = config.get("padding", 35)
        batch_size = config.get("batch_size", 16)
        text_model_name = config.get("text_model", "PP-OCRv5_server_det")
        use_cut_padding = config.get("use_cut_padding", True)

        pdf_to_image_cfg = config.get("pdf_to_image", {})
        dpi = pdf_to_image_cfg.get("dpi", 500)
        anchor_size = pdf_to_image_cfg.get("anchor_size", 500990)
        min_dpi = pdf_to_image_cfg.get("min_dpi", 40)
        thread_count = pdf_to_image_cfg.get("thread_count", 10)

        dpi = max(min_dpi, self.get_dynamic_dpi(pdf_path, anchor_size, dpi))
        logger.info("DPI động: %d", dpi)

        logger.info("Chuyển PDF sang ảnh...")
        images = convert_from_path(pdf_path, dpi=dpi, fmt="png", thread_count=thread_count)

        if max_pages:
            images = images[:max_pages]

        if do_vertical_split:
            # Sách scan 2 trang/tờ: tách đôi thành 2 ảnh trang riêng.
            splitted_images = []
            for image in images:
                width, height = image.size
                splitted_images.append(image.crop((0, 0, width // 2, height)))
                splitted_images.append(image.crop((width // 2, 0, width, height)))
            images = splitted_images

        if not use_cut_padding:
            logger.info("Bỏ qua bước cắt lề theo config")
            return images

        logger.info("Cắt lề và chuẩn hoá ảnh...")
        model = TextDetection(model_name=text_model_name)
        cutted_images = process_folder_cut_detect_pad(
            images=images,
            output_folder=output_dir,
            model=model,
            cut_params=cut_params,
            padding=padding,
            batch_size=batch_size,
            draw_debug=draw_debug,
        )
        logger.info("Đã xử lý ảnh đầu vào, lưu tại %s", output_dir)
        return cutted_images

    def process(
        self,
        output_dir: Optional[Path] = None,
        pdf_path: Optional[str] = None,
        max_pages: int = None,
        do_vertical_split: bool = True,
        draw_debug: bool = True,
    ) -> dict:
        """Chạy bước 1-5: từ PDF tới summary_report chưa qua LLM."""
        logger.info("=== Bắt đầu xử lý tài liệu: %s ===", pdf_path)

        preprocessed_images_path = Path(output_dir) / "preprocessed_images"

        self.page_image_list = self.process_pdf_to_image_and_cut_padding(
            preprocessed_images_path,
            pdf_path=pdf_path,
            max_pages=max_pages,
            do_vertical_split=do_vertical_split,
            draw_debug=draw_debug,
        )
        number_of_pages = len(self.page_image_list)
        self.page_image_dict = {i: self.page_image_list[i] for i in range(number_of_pages)}

        logger.info("Bước 2: detect elements")
        self.all_elements = self.element_detector.detect_all_elements(
            self.page_image_list, output_dir, draw_debug=draw_debug
        )
        logger.info("Phát hiện %d element trên %d trang", len(self.all_elements), number_of_pages)

        logger.info("Bước 3: xác định sections")
        self.sections = self.section_analyzer.identify_sections(self.all_elements, number_of_pages)
        logger.info("Xác định %d section", len(self.sections))

        logger.info("Bước 4: phân loại elements vào sections")
        self.section_analyzer.assign_elements_to_sections(self.all_elements, self.sections)

        logger.info("Bước 5: OCR và lưu data")
        self.summary_report = self.summary_reporter.create_summary_report(
            output_dir, number_of_pages, self.sections, self.all_elements, self.page_image_dict
        )
        return self.summary_report

    def process_with_corrected_summary(
        self,
        output_dir: Optional[Path] = None,
        pdf_path: Optional[str] = None,
        custom_config: dict = None,
        draw_debug: bool = False,
    ) -> List[dict]:
        """Chạy toàn bộ pipeline, trả metadata của từng ảnh-mục.

        `custom_config` override tham số cho riêng lần chạy này. Xem
        `_apply_overrides` để biết cái gì override được và vì sao.
        """
        custom_config = custom_config or {}
        max_pages = custom_config.get("max_pages")
        do_vertical_split = custom_config.get("vertical_split", True)

        # Ghi vào METADATA_DIR để API service đọc lại được qua volume chung.
        output_folder = str(metadata_dir() / str(output_dir))
        self._clear_and_recreate_dir(output_folder)

        with self._overrides(custom_config):
            return self._run_pipeline(
                output_folder, pdf_path, max_pages, do_vertical_split, draw_debug
            )

    @contextmanager
    def _overrides(self, custom_config: dict):
        """Áp override cho một lần chạy rồi trả lại giá trị cũ.

        PdfManager là singleton nên phải phục hồi, nếu không lần xử lý sau sẽ
        thừa hưởng tham số của lần trước.

        Chỉ override được thứ đọc lại mỗi lần chạy hoặc là thuộc tính số đơn
        giản. Tên model không override được vì model đã nạp vào VRAM.
        """
        saved: list[tuple[object, str, object]] = []

        def override(target: object, attr: str, value):
            saved.append((target, attr, getattr(target, attr)))
            setattr(target, attr, value)

        # Config đọc lại ở mỗi lần gọi process_pdf_to_image_and_cut_padding
        original_config = self.config
        merged = deepcopy(self.config)

        pre = custom_config.get("preprocess") or {}
        if pre:
            target = merged.setdefault("preprocess_pdf", {})
            for key in ("padding", "use_cut_padding", "batch_size", "cut_params"):
                if pre.get(key) is not None:
                    target[key] = pre[key]
            img = pre.get("pdf_to_image") or {}
            if img:
                img_target = target.setdefault("pdf_to_image", {})
                for key in ("dpi", "min_dpi", "anchor_size", "thread_count"):
                    if img.get(key) is not None:
                        img_target[key] = img[key]

        self.config = merged

        layout = custom_config.get("layout") or {}
        if layout.get("batch_size") is not None:
            override(self.element_detector, "batch_size", layout["batch_size"])

        ocr = custom_config.get("ocr") or {}
        for key in ("title_batch_size", "number_batch_size", "formula_batch_size"):
            if ocr.get(key) is not None:
                override(self.summary_reporter, key, ocr[key])

        chunking = custom_config.get("chunking") or {}
        if chunking.get("cut_padding") is not None:
            override(self.section_merger, "cut_padding", chunking["cut_padding"])
        if chunking.get("min_section_height_px") is not None:
            # Ngưỡng nằm ở module llm_report_valid, không phải thuộc tính
            # instance, nên set qua chính module đó.
            from . import llm_report_valid

            override(
                llm_report_valid,
                "MIN_SECTION_HEIGHT_PX",
                chunking["min_section_height_px"],
            )

        toc = custom_config.get("toc_validator") or {}
        for key in ("model_name", "temperature"):
            if toc.get(key) is not None:
                override(self.report_validator, key, toc[key])

        if custom_config:
            logger.info("Áp override cho lần chạy này: %s", custom_config)

        try:
            yield
        finally:
            self.config = original_config
            for target, attr, value in saved:
                setattr(target, attr, value)

    def _run_pipeline(
        self,
        output_folder: str,
        pdf_path: Optional[str],
        max_pages: Optional[int],
        do_vertical_split: bool,
        draw_debug: bool,
    ) -> List[dict]:
        self.process(output_folder, pdf_path, max_pages, do_vertical_split, draw_debug)

        logger.info("Bước 6: LLM kiểm tra và sửa cây mục lục")
        self.summary_report = self.report_validator.validate_report(self.summary_report)

        summary_path = Path(output_folder) / "summary_report.json"
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(
                self.summary_report,
                f,
                ensure_ascii=False,
                indent=4,
                default=self.summary_reporter.convert_np,
            )

        logger.info("Bước 7: ghép ảnh-mục với OCR data đã lưu")
        full_sections_metadatas = self.section_merger.merge_and_save_sections_optimized(
            output_folder, self.summary_report, self.page_image_dict
        )

        logger.info("Hoàn thành. Kết quả tại: %s", output_folder)
        return full_sections_metadatas

    @staticmethod
    def _clear_and_recreate_dir(output_folder: str) -> None:
        logger.info("Dọn thư mục output %s", output_folder)
        if os.path.exists(output_folder):
            shutil.rmtree(output_folder)
        os.makedirs(output_folder)
