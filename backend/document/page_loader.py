import re
from pathlib import Path
from typing import List
from PIL import Image

from ..core.logging import get_logger

logger = get_logger(__name__)

class PageLoader:
    """
    Chịu trách nhiệm load và sắp xếp các trang tài liệu
    """
    
    def __init__(self, input_dir: str):
        self.input_dir = Path(input_dir)
        
    def load_pages(self) -> List[str]:
        """
        Load và sắp xếp các trang theo thứ tự
        Pattern: page_X_Y.png với X, Y là số
        """
        logger.debug("\n📄 Loading các trang...")
        
        # Tìm tất cả file ảnh
        image_files = []
        for ext in ['*.png', '*.jpg', '*.jpeg']:
            image_files.extend(self.input_dir.glob(ext))
        
        # Sắp xếp theo tên file
        def extract_page_numbers(filename):
            match = re.search(r'page_(\d+)_(\d+)', filename.stem)
            if match:
                return (int(match.group(1)), int(match.group(2)))
            match = re.search(r'page_(\d+)', filename.stem)
            if match:
                return (int(match.group(1)), 0)  # gán Y=0 nếu không có
            return (999, 999)

        
        image_files.sort(key=extract_page_numbers)
        all_pages = [str(f) for f in image_files]
        
        logger.debug(f"✅ Đã load {len(all_pages)} trang")
        for i, page in enumerate(all_pages):
            logger.debug(f"  - Trang {i}: {Path(page).name}")
            
        return all_pages
        
    def load_page_images(self, all_pages: List[str]) -> dict:
        """Load và cache tất cả ảnh trang"""
        page_images = {}
        for page_idx, page_path in enumerate(all_pages):
            page_images[page_idx] = Image.open(page_path).convert("RGB")
        return page_images