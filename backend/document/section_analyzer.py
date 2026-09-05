import numpy as np
# import easyocr
from typing import List, Dict
from PIL import Image
from .detected_element import DetectedElement
from .document_section import DocumentSection

from ..core.logging import get_logger

logger = get_logger(__name__)

class SectionAnalyzer:
    """
    Chịu trách nhiệm phân tích và xác định các sections trong tài liệu
    """
    
    def __init__(self):
        pass
        
    def identify_sections(self, all_elements: List[DetectedElement], num_pages) -> List[DocumentSection]:
        """
        Xác định các sections dựa trên paragraph_title
        Args:
            all_elements: Tất cả elements đã phát hiện
            num_pages: Số lượng trang
            
        Returns:
            List các DocumentSection đã xác định
        """
        logger.debug("\n📑 Xác định các sections...")
        
        sections = []
        
        # Lọc ra các paragraph_title
        titles = [elem for elem in all_elements if elem.type == 'paragraph_title']
        
        # Sắp xếp theo page_index và y coordinate
        titles.sort(key=lambda x: (x.page_index, x.coordinate[1]))
        
        logger.debug(f"  Tìm thấy {len(titles)} paragraph titles")

        if titles:
            if titles[0].coordinate[1] > 100:
                logger.debug("  ⚠️ Phát hiện nội dung trước paragraph title đầu tiên")
                noname_section = DocumentSection(
                    title=None,
                    title_element=None,
                    start_page=0,
                    start_y=0,
                    end_page=titles[0].page_index,
                    end_y=titles[0].coordinate[1]
                )
                sections.append(noname_section)
            else:
                if titles[0].page_index > 0:
                    logger.debug("  ⚠️ Phát hiện nội dung trước paragraph title đầu tiên")
                    noname_section = DocumentSection(
                        title=None,
                        title_element=None,
                        start_page=0,
                        start_y=0,
                        end_page=titles[0].page_index - 1,
                        end_y=99999999  # Lấy đến hết trang trước
                    )
                    sections.append(noname_section)

        
        # # Kiểm tra xem có phần đầu không có title không
        # if titles and (titles[0].page_index > 0 or titles[0].coordinate[1] > 100):
        #     # Có nội dung trước title đầu tiên
        #     print("  ⚠️ Phát hiện nội dung trước paragraph title đầu tiên → tạo section 'noname'")
        #     noname_section = DocumentSection(
        #         title=None,
        #         title_element=None,
        #         start_page=0,
        #         start_y=0,
        #         end_page=titles[0].page_index,
        #         end_y=titles[0].coordinate[1] # if titles[0].page_index == 0 else 999999 TODO: VERIFY LATER
        #     )
        #     sections.append(noname_section)
        
        # Xác định các section có title
        for i, title in enumerate(titles):
            # Không OCR title ở đây nữa - SummaryReporter sẽ làm
            logger.debug(f"\n  Section {i+1}: title tại trang {title.page_index} (y={title.coordinate[1]})")
            
            # Xác định điểm kết thúc của section (ĐẾN TRƯỚC TITLE TIẾP THEO)
            if i+1 < len(titles):
                # Có title tiếp theo - kết thúc TRƯỚC title đó
                next_title = titles[i+1]
                if next_title.coordinate[1] < 100:
                    # Nếu title tiếp theo quá gần, lấy đến hết trang hiện tại
                    end_page = next_title.page_index - 1
                    end_y = 999999
                    logger.debug(f"    → Kết thúc đến hết trang {end_page} (y={end_y})")
                else:
                    end_page = next_title.page_index
                    end_y = next_title.coordinate[1]  # Kết thúc TRƯỚC title tiếp theo
                    logger.debug(f"    → Kết thúc TRƯỚC title tiếp theo tại trang {end_page}, y={end_y}")
            else:
                # Section cuối cùng - lấy đến hết document
                end_page = num_pages - 1
                end_y = 999999
                logger.debug(f"    → Section cuối - lấy đến hết document")
            
            section = DocumentSection(
                title=None,  # Sẽ được OCR sau trong SummaryReporter
                title_element=title,
                start_page=title.page_index,
                start_y=title.coordinate[1],
                end_page=end_page,
                end_y=end_y
            )
            
            sections.append(section)
        
        logger.debug(f"\n✅ Đã xác định {len(sections)} sections")
        return sections
        
    def assign_elements_to_sections(self, all_elements: List[DetectedElement], sections: List[DocumentSection]):
        """
        Phân loại các elements vào từng section
        Không còn OCR titles - việc này được chuyển sang SummaryReporter
        
        Args:
            all_elements: Tất cả elements đã phát hiện
            sections: Các sections đã xác định
            page_images: Dict chứa các ảnh trang (không dùng nữa)
        """
        logger.debug("\n🔗 Phân loại elements vào các sections...")
        
        # Không OCR titles nữa - SummaryReporter sẽ làm việc này
        
        for elem in all_elements:
            if elem.type in ['formula', 'number', 'formula_number']:
                # Tìm section chứa element này
                for section in sections:
                    if self._is_element_in_section(elem, section):
                        section.elements.append(elem)
                        break
        
        # Báo cáo
        for i, section in enumerate(sections):
            title = section.title or f"section_{i}"
            logger.debug(f"  Section '{title}': {len(section.elements)} elements")
            
    def _is_element_in_section(self, elem: DetectedElement, section: DocumentSection) -> bool:
        """
        Kiểm tra xem element có thuộc section không
        LOGIC MỚI: Section từ title này đến TRƯỚC title tiếp theo (1 title/section)
        """
        elem_page = elem.page_index
        elem_y = elem.coordinate[1]
        
        # Trường hợp 1: Element và section cùng trang (có thể là start=end page)
        if section.start_page == section.end_page == elem_page:
            # Cả start và end cùng trang
            return section.start_y <= elem_y < section.end_y
            
        # Trường hợp 2: Element ở trang đầu của section (khác end_page)
        elif elem_page == section.start_page:
            return elem_y >= section.start_y
            
        # Trường hợp 3: Element ở trang cuối của section (khác start_page)  
        elif elem_page == section.end_page:
            return elem_y < section.end_y  # Chú ý: < thay vì <=
            
        # Trường hợp 4: Element ở trang giữa
        elif section.start_page < elem_page < section.end_page:
            return True
            
        return False