from paddleocr import LayoutDetection
from PIL import Image, ImageDraw
from pathlib import Path
from typing import List, Dict
from .detected_element import DetectedElement
import numpy as np

from ..core.logging import get_logger

logger = get_logger(__name__)

class ElementDetector:
    """
    Chịu trách nhiệm phát hiện các elements trong tài liệu
    (paragraph_title, formula, number, formula_number)
    """
    def __init__(self, config: Dict):
        logger.debug("🔧 Khởi tạo Layout Detection model...")
        self.batch_size = config.get("batch_size", 128)
        self.layout_model = LayoutDetection(model_name=config.get("model_name", "PP-DocLayout_plus-L"))

    def detect_all_elements(self, page_images: List[Image.Image], output_dir: Path, draw_debug: bool) -> List[DetectedElement]:
        """
        Phát hiện tất cả các elements trong các trang

        Args:
            page_images: Danh sách các ảnh PIL.Image đã load
            output_dir: Thư mục output để lưu layout visualization
            draw_debug: Có vẽ và lưu ảnh debug không

        Returns:
            List các DetectedElement đã phát hiện
        """
        logger.debug("\n🔍 Detecting elements trong tất cả các trang...")

        target_labels = {'paragraph_title', 'formula', 'number', 'formula_number'}
        all_elements = []

        if draw_debug:
            layout_vis_dir = Path(output_dir) / "layout_visualization"
            layout_vis_dir.mkdir(exist_ok=True)
        else:
            layout_vis_dir = None

        # convert images list to numpy array for layout detection
        np_images = [np.array(img) for img in page_images]

        outputs = self.layout_model.predict(
            np_images, batch_size=self.batch_size, layout_nms=True
        )

        # print("output of layout detection:")
        # print(outputs)

        for page_idx, (vis_img, output) in enumerate(zip(page_images, outputs)):
            logger.debug(f"\n  Processing trang {page_idx}")

            if draw_debug:
                vis_img = vis_img.copy()
                draw = ImageDraw.Draw(vis_img)
            # for res in output:
            # boxes = res.boxes if hasattr(res, 'boxes') else res.get('boxes', [])
            boxes = []
            if hasattr(output, 'boxes'):
                boxes = output.boxes
            elif isinstance(output, dict):
                boxes = output.get('boxes', [])
            else:
                logger.debug(output)
                continue

            for box in boxes:
                if isinstance(box, dict):
                    label = box.get('label', '')
                    coord = box.get('coordinate', [])
                    score = box.get('score', 0.0)
                else:
                    label = getattr(box, 'label', '')
                    coord = getattr(box, 'coordinate', [])
                    score = getattr(box, 'score', 0.0)

                if label in target_labels:
                    element = DetectedElement(
                        type=label,
                        coordinate=coord,
                        page_index=page_idx,
                        page_name=f"page_{page_idx}",
                        score=score
                    )
                    all_elements.append(element)
                    logger.debug(f"    - Tìm thấy {label} tại {coord[:2]}")

                if draw_debug and coord and len(coord) == 4:
                    color = {
                        'paragraph_title': 'red',
                        'formula': 'blue',
                        'number': 'green',
                        'formula_number': 'orange'
                    }.get(label, 'yellow')
                    draw.rectangle(coord, outline=color, width=3)
                    draw.text((coord[0], coord[1]), label, fill=color)

            if draw_debug:
                vis_img.save(layout_vis_dir / f"layout_{page_idx:02d}.png")

        logger.debug(f"\n✅ Tổng cộng phát hiện được {len(all_elements)} elements")

        stats = {}
        for elem in all_elements:
            stats[elem.type] = stats.get(elem.type, 0) + 1
        logger.debug("📊 Thống kê:")
        for label, count in stats.items():
            logger.debug(f"  - {label}: {count}")

        return all_elements