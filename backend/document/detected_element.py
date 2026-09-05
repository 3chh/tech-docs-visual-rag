from dataclasses import dataclass
from typing import List, Optional

@dataclass
class DetectedElement:
    """Đại diện cho một phần tử được phát hiện (title, formula, number)"""
    type: str  # 'paragraph_title', 'formula', 'number'
    coordinate: List[int]  # [x1, y1, x2, y2]
    page_index: int  # Trang chứa element này
    page_name: str  # Tên file gốc
    score: float # 
    content: Optional[str] = None  # Nội dung OCR