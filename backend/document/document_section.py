from dataclasses import dataclass
from typing import List, Optional
from .detected_element import DetectedElement

@dataclass
class DocumentSection:
    """Đại diện cho một section của tài liệu"""
    title: Optional[str]  # None nếu là phần 'noname'
    title_element: Optional[DetectedElement]  # Element của title
    start_page: int  # Trang bắt đầu
    start_y: int  # Tọa độ Y bắt đầu trong trang
    end_page: int  # Trang kết thúc
    end_y: int  # Tọa độ Y kết thúc trong trang
    elements: List[DetectedElement] = None  # Các formula, number trong section
    
    def __post_init__(self):
        if self.elements is None:
            self.elements = []