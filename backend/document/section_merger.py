import re
import json
import numpy as np
from pathlib import Path
from typing import List, Dict, Tuple
from PIL import Image
from dataclasses import asdict
from .detected_element import DetectedElement
from .document_section import DocumentSection
from PIL import ImageDraw
import os

from ..core.logging import get_logger

logger = get_logger(__name__)

try:
    from paddleocr import FormulaRecognition, LayoutDetection
except ImportError:
    FormulaRecognition = None
    LayoutDetection = None

try:
    import easyocr
except ImportError:
    easyocr = None

class SectionMerger:
    """
    Chịu trách nhiệm cắt, ghép và lưu các sections dựa trên summary report
    CẬP NHẬT: Thêm phương thức tối ưu sử dụng OCR data đã lưu
    """
    
    # def __init__(self, output_dir: Path, lazy_load: bool = False):
    #     self.output_dir = output_dir
    #     self.data_dir = self.output_dir / "ocr_data"
        
    #     # Lazy loading - chỉ khởi tạo models khi cần thiết
    #     self.lazy_load = lazy_load
    #     self.formula_model = None
    #     self.reader = None
        
    #     if not lazy_load:
    #         # Khởi tạo ngay lập tức (cho backward compatibility)
    #         self._init_models()

    def __init__(self, config):
        self.config = config
        
        # Lazy loading - chỉ khởi tạo models khi cần thiết
        # self.lazy_load = self.config.get('lazy_load', False)
        # self.formula_model = None
        # self.reader = None
        self.cut_padding = self.config.get('cut_padding', 10)  # Padding mặc định

        # self.easy_ocr_reader = self.config.get('easy_ocr_reader', 'ja')

        # if easyocr:
        #     print(f"🔧 Khởi tạo EasyOCR với ngôn ngữ {self.easy_ocr_reader}...")
        #     self.reader = easyocr.Reader([self.easy_ocr_reader])
        # else:
        #     print("⚠️ EasyOCR không khả dụng, sẽ không sử dụng OCR cho sections")
        #     self.reader = None

        # if not self.lazy_load:
        #     # Khởi tạo ngay lập tức (cho backward compatibility)
        #     self._init_models()
    
    # def _init_models(self):
    #     """Khởi tạo models khi cần thiết"""
    #     if self.formula_model is None and FormulaRecognition:
    #         print("🔧 Khởi tạo Formula Recognition model...")
    #         self.formula_model = FormulaRecognition(model_name="UniMERNet")
    #     elif not FormulaRecognition:
    #         print("⚠️ FormulaRecognition không khả dụng")
            
    #     if self.reader is None and easyocr:
    #         print("🔧 Khởi tạo EasyOCR...")
    #         self.reader = easyocr.Reader(['ja'])
    #     elif not easyocr:
    #         print("⚠️ EasyOCR không khả dụng")
    
    '''
    self : SectionMerger
    summary_report : dict
    page_images : Dict[int, Image.Image]
    '''
    def merge_and_save_sections_optimized(self, output_dir, summary_report: dict, page_images: Dict[int, Image.Image], draw_debug: bool = False):
        """
        PHƯƠNG THỨC TỐI ƯU: Cắt, ghép và lưu sections với OCR data đã lưu
        KHÔNG cần detect layout lại → tăng tốc đáng kể
        """

        data_dir = Path(output_dir) / "ocr_data"
        merge_debug_dir = Path(output_dir) / "merge_debug"

        logger.debug("\n💾 Cắt ghép và lưu sections với OCR data đã lưu (TỐI ƯU)...")
        
        # Load tất cả OCR data từ files
        titles_data, page_numbers_data, formulas_data = self._load_ocr_data(data_dir)
        
        # DEBUG: Kiểm tra page numbers data
        logger.debug(f"\n🔍 DEBUG PAGE NUMBERS DATA:")
        for page_idx, data in page_numbers_data.items():
            coord = data['coordinate']
            img_height = page_images[page_idx].height
            logger.debug(f"   Page {page_idx}: number='{data['page_number']}' at y={coord[1]}-{coord[3]} (page height={img_height})")
        
        # Xác định vùng page numbers để cắt bỏ
        page_cut_positions = self._get_page_number_regions_from_data(page_numbers_data, page_images)
        # DEBUG: Kiểm tra cut positions
        if draw_debug:
            # vẽ các vùng cắt lên ảnh để kiểm tra lưu tại output debug
            for page_idx, cut_y in page_cut_positions.items():
                img = page_images[page_idx].copy()
                draw = ImageDraw.Draw(img)
                draw.rectangle([0, cut_y, img.width, img.height], fill=(255, 0, 0, 128))
                debug_output_dir = Path(output_dir) / "debug_cut_positions"
                debug_output_dir.mkdir(exist_ok=True)
                img.save(debug_output_dir / f"debug_cut_position_page_{page_idx}.png")

        # DEBUG: Kiểm tra cut positions
        logger.debug(f"\n🔍 DEBUG CUT POSITIONS(kiểm tra cut positions):")
        for page_idx, cut_y in page_cut_positions.items():
            img_height = page_images[page_idx].height
            removed_pixels = img_height - cut_y
            logger.debug(f"   Page {page_idx}: cut at y={cut_y}, remove {removed_pixels}px ({removed_pixels/img_height*100:.1f}%)")
        
        # Tạo sections từ summary report
        sections = self._create_sections_from_summary(summary_report)
        if not sections:
            logger.debug("⚠️ Không tìm thấy sections trong summary report")
            return
        logger.debug(f"  ✅ Tạo {len(sections)} sections từ summary report")
        # DEBUG: Kiểm tra titles data
        logger.debug(f"\n🔍 DEBUG TITLES DATA:")
        for page_idx, title in titles_data.items():
            logger.debug(f"   Page {page_idx}: title='{title}'")
        # DEBUG: Kiểm tra formulas data
        logger.debug(f"\n🔍 DEBUG FORMULAS DATA:")
        for page_idx, formulas in formulas_data.items():
            logger.debug(f"   Page {page_idx}: {len(formulas)} formulas")
            logger.debug(f" Content: {formulas[:3]}...")  # Hiển thị 3 formulas đầu tiên

        # DEBUG: Kiểm tra sections
        logger.debug(f"\n🔍 DEBUG SECTIONS:")
        for section in sections:
            logger.debug(f"   Section {section['index']}: {section['title']}")
        logger.debug(f"   Total sections: {len(sections)}")
        # Lặp qua từng section trong summary report

        section_images_dir = Path(output_dir) / "section_images"
        section_images_dir.mkdir(exist_ok=True)

        sections_dir = Path(output_dir) / "sections"
        sections_dir.mkdir(exist_ok=True)

        # section_metadatas_dir = Path(output_dir) / "section_metadatas"
        # section_metadatas_dir.mkdir(exist_ok=True)

        page_numbers_mapping = summary_report.get('page_numbers', {})

        full_metadatas = []

        logger.debug(f"\n🔍 BẮT ĐẦU XỬ LÝ CÁC SECTIONS...")
        for report_section in summary_report['sections']:
            
            section_index = report_section['index']
            section_title = report_section['title']
            section_name = self._sanitize_filename(section_title)
            
            section_dir = sections_dir / f"section_{section_index:02d}_{section_name}"
            section_dir.mkdir(exist_ok=True)
            logger.debug(f"\n  Processing section {section_index}: '{section_title}'...")
            
            # Tạo thư mục cho section
            # section_dir = Path(output_dir) / f"section_{section_index:02d}_{section_name}"
            # section_dir.mkdir(exist_ok=True)
            
            # Lấy section info từ summary report
            precise_range = report_section['precise_range']
            section_data = {
                'start_page': precise_range['start_page'],
                'start_y': precise_range['start_y'],
                'end_page': precise_range['end_page'],
                'end_y': precise_range['end_y']
            }
            
            logger.debug(f"    📋 Section range: page {section_data['start_page']}-{section_data['end_page']}, y={section_data['start_y']}-{section_data['end_y']}")
            
            # 1. Lấy formulas cho section từ OCR data
            logger.debug(f"    🔍 Lấy formulas cho section từ OCR data...")
            section_formulas = self._get_formulas_for_section_from_data(formulas_data, section_data)
            
            # 2. Cắt và ghép ảnh (loại bỏ page numbers)
            logger.debug(f"    🔗 Ghép ảnh với coordinate tracking...")
            merged_img, coord_transformations = self._merge_section_images_optimized(section_dir,
                merge_debug_dir, section_data, page_images, page_cut_positions, draw_debug
            )
            
            # SAVE merged image with debug info
            # merged_img_path = section_dir / "merged_image.png"
            merged_img_path = section_images_dir / f"section_{section_index:02d}_{section_name}.png"
            merged_img.save(merged_img_path)
            logger.debug(f"    ✅ Đã lưu merged_image.png: {merged_img.width}x{merged_img.height}")
            
            # # 3. Cắt và lưu title (nếu có và không phải noname)
            # if section_title != 'noname':
            #     # Tạo title image từ thông tin trong summary
            #     title_img = self._create_title_image_from_data(section_data, page_images, section_title)
            #     if title_img:
            #         title_img.save(section_dir / "title.png")
            
            # 4. Cập nhật coordinates của formulas
            logger.debug(f"    📐 Cập nhật coordinates cho {len(section_formulas)} formulas...")
            updated_formulas = self._update_formula_coordinates(section_formulas, coord_transformations)
            
            # 5. Lưu metadata với formulas đã cập nhật coordinates
            metadata = {
                # 'section_index': section_index,
                'section_title': section_title,
                'formulas': [{'content': formula['ocr_content'], 'coordinate': formula['coordinate'], 'page': page_numbers_mapping.get(formula['page_idx'])} for formula in updated_formulas],
                'section_pages': precise_range['page_numbers'],
                # list of integers from precise_range['start_page'] to precise_range['end_page']
                'section_pages_index': list(range(precise_range['start_page'], precise_range['end_page'] + 1)),
                'ancestors': report_section.get('ancestor_titles', []),
                'image_path': str(merged_img_path.resolve()),
                'chunk_images_dir': str(section_dir),
                # 'coordinate_transformations': coord_transformations,
                # 'page_cut_info': {
                #     'cut_positions': {str(k): v for k, v in page_cut_positions.items()},
                #     'total_formulas_before': len(section_formulas),
                #     'total_formulas_after': len(updated_formulas),
                #     'removed_by_cutting': len(section_formulas) - len(updated_formulas)
                # }
            }

            full_metadatas.append(metadata)
            
            # with open(section_dir / "metadata.json", 'w', encoding='utf-8') as f:
            #     json.dump(metadata, f, ensure_ascii=False, indent=2, default=self._convert_np)
            
            # print(f"    ✅ Đã lưu metadata với {len(updated_formulas)} formulas")
            
            # DEBUG: Lưu debug info
            # if draw_debug:
            #     debug_info = {
            #         'page_numbers_detected': page_numbers_data,
            #         'cut_positions': page_cut_positions,
            #         'section_data': section_data,
            #         'transformations': coord_transformations
            #     }
            #     with open(section_dir / "debug_info.json", 'w', encoding='utf-8') as f:
            #         json.dump(debug_info, f, ensure_ascii=False, indent=2, default=self._convert_np)

        with open(Path(output_dir) / "full_metadata.json", 'w', encoding='utf-8') as f:
            json.dump(full_metadatas, f, ensure_ascii=False, indent=2, default=self._convert_np)
    
        logger.debug(f"\n✅ HOÀN THÀNH! Đã cắt page numbers trên {len(page_cut_positions)} trang")
        if draw_debug:
            logger.debug(f"📂 Kiểm tra debug_info.json trong mỗi section để troubleshoot")
        return full_metadatas

    def _load_ocr_data(self, data_dir) -> Tuple[Dict[int, str], Dict[int, dict], Dict[int, List[dict]]]:
        """Load tất cả OCR data từ files"""
        logger.debug("  📂 Loading OCR data từ files...")
        
        # Load titles data
        titles_path = data_dir / 'titles_data.json'
        if titles_path.exists():
            with open(titles_path, 'r', encoding='utf-8') as f:
                titles_data = json.load(f)
                titles_data = {int(k): v for k, v in titles_data.items()}
        else:
            logger.debug("    ⚠️ Không tìm thấy titles_data.json")
            titles_data = {}
        
        # Load page numbers data
        page_numbers_path = Path(data_dir) / 'page_numbers_data.json'
        if page_numbers_path.exists():
            with open(page_numbers_path, 'r', encoding='utf-8') as f:
                page_numbers_data = json.load(f)
                page_numbers_data = {int(k): v for k, v in page_numbers_data.items()}
        else:
            logger.debug("    ⚠️ Không tìm thấy page_numbers_data.json")
            page_numbers_data = {}
        # Load formulas data
        formulas_path = Path(data_dir) / 'formulas_data.json'
        if formulas_path.exists():
            with open(formulas_path, 'r', encoding='utf-8') as f:
                formulas_data = json.load(f)
                formulas_data = {int(k): v for k, v in formulas_data.items()}
        else:
            logger.debug("    ⚠️ Không tìm thấy formulas_data.json")
            formulas_data = {}
        
        total_formulas = sum(len(f) for f in formulas_data.values())
        logger.debug(f"  ✅ Loaded: {len(titles_data)} titles, {len(page_numbers_data)} page numbers, {total_formulas} formulas")
        
        return titles_data, page_numbers_data, formulas_data
    
    def _create_sections_from_summary(self, summary_report: dict) -> List[dict]:
        """Tạo sections data từ summary report"""
        sections = []
        for section_info in summary_report['sections']:
            precise_range = section_info['precise_range']
            section_data = {
                'index': section_info['index'],
                'title': section_info['title'],
                'start_page': precise_range['start_page'],
                'start_y': precise_range['start_y'],
                'end_page': precise_range['end_page'],
                'end_y': precise_range['end_y']
            }
            sections.append(section_data)
        return sections
    
    def _get_formulas_for_section_from_data(self, formulas_data: Dict[int, List[dict]], section_data: dict) -> List[dict]:
        """Lấy formulas thuộc về section từ OCR data"""
        section_formulas = []
        
        for page_idx in range(section_data['start_page'], section_data['end_page'] + 1):
            if page_idx not in formulas_data:
                continue
                
            for formula in formulas_data[page_idx]:
                coord = formula['coordinate']
                formula_y = coord[1]
                
                if self._is_formula_in_section(page_idx, formula_y, section_data):
                    section_formulas.append(formula)
        
        logger.debug(f"      📋 Section có {len(section_formulas)} formulas")
        return section_formulas
    
    def _is_formula_in_section(self, formula_page: int, formula_y: float, section_data: dict) -> bool:
        """Kiểm tra formula có thuộc section không"""
        start_page = section_data['start_page']
        end_page = section_data['end_page']
        start_y = section_data['start_y']
        end_y = section_data['end_y']
        
        if start_page == end_page == formula_page:
            return start_y <= formula_y < end_y
        elif formula_page == start_page:
            return formula_y >= start_y
        elif formula_page == end_page:
            return formula_y < end_y
        elif start_page < formula_page < end_page:
            return True
        return False

    def _get_page_number_regions_from_data(self, page_numbers_data: Dict[int, dict], page_images: Dict[int, Image.Image]) -> Dict[int, int]:
        """Xác định vùng page numbers từ OCR data - trả về y_cut cho mỗi trang"""
        logger.debug("  🔢 Xác định vùng page numbers để cắt bỏ...")
        
        # biến để lưu vị trí cắt cho mỗi trang
        page_cut_positions = {}
        # in thông tin debug
        logger.debug("  🔢 Vị trí cắt cho từng trang:")
        
        for page_idx, data in page_numbers_data.items():
            coordinate = data['coordinate']
            y1, y2 = coordinate[1], coordinate[3]
            logger.debug(f"    📄 Trang📄 Trang📄 Trang📄 Trang {page_idx}: Vùng cắt y={y1}-{y2}")
            img_height = page_images[page_idx].height
            
            # Xác định vị trí cắt: CẮT TRƯỚC page number với padding
            # padding = 20  # Tăng padding để đảm bảo cắt sạch
            cut_y_position = max(0, y1 - self.cut_padding)
            
            # LUÔN CẮT page numbers (bỏ điều kiện 80% height)
            page_cut_positions[page_idx] = cut_y_position
            logger.debug(f"    📄 Trang {page_idx}: Page number {data['page_number']} tại y={y1}-{y2}")
            logger.debug(f"        → SẼ CẮT ảnh từ y=0 đến y={cut_y_position} (loại bỏ {img_height - cut_y_position}px)")
        
        return page_cut_positions
    
        """Ghép ảnh sections với coordinate tracking và cắt bỏ page numbers"""
    def _merge_section_images_optimized(self, section_dir, output_dir, section_data: dict, page_images: Dict[int, Image.Image],
                                       page_cut_positions: Dict[int, int], draw_debug: bool) -> Tuple[Image.Image, List[dict]]:
        images_to_merge = []
        coord_transformations = []
        current_y_offset = 0
        
        start_page = section_data['start_page']
        end_page = section_data['end_page']
        start_y = section_data['start_y']
        end_y = section_data['end_y']
        
        logger.debug(f"    🔗 Merging section từ trang {start_page} đến {end_page}")
        logger.debug(f"    ✂️ Page cut positions: {page_cut_positions}")
        
        for page_idx in range(start_page, end_page + 1):
            img = page_images[page_idx]
            width, height = img.size
            
            logger.debug(f"\n      📄 Processing trang {page_idx} (size: {width}x{height})")
            
            # Xác định vùng cắt dựa trên section
            if page_idx == start_page and page_idx == end_page:
                y1 = start_y
                y2 = min(end_y, height)
                case_desc = f"Section trong 1 trang: y={y1} đến y={y2}"
            elif page_idx == start_page:
                y1 = start_y
                y2 = height
                case_desc = f"Trang đầu - từ y={y1}"
            elif page_idx == end_page:
                y1 = 0
                y2 = min(end_y, height)
                case_desc = f"Trang cuối - đến y={y2}"
            else:
                y1 = 0
                y2 = height
                case_desc = "Trang giữa - lấy toàn bộ"
            
            logger.debug(f"         📐 {case_desc}")
            
            # *** QUAN TRỌNG: ÁP DỤNG PAGE CUTTING TRƯỚC ***
            original_y2 = y2
            if page_idx in page_cut_positions:
                page_cut_y = page_cut_positions[page_idx]
                logger.debug(f"         ✂️ PHÁT HIỆN page cut position: y={page_cut_y}")
                # lưu lại file ảnh để kiểm tra
                os.makedirs(output_dir, exist_ok=True)
                img_copy = img.copy()
                img_copy.save(f"{output_dir}/debug_page_{page_idx}.png")
                # Nếu y1 >= page_cut_y, toàn bộ section nằm trong vùng page number, bỏ qua trang này

                # ÁP DỤNG CẮT: Không lấy phần nào > cut_position
                if y1 >= page_cut_y:
                    logger.debug(f"         ❌ TOÀN BỘ section nằm trong vùng page number, bỏ qua trang này")
                    continue
                
                if y2 > page_cut_y:
                    y2 = page_cut_y
                    logger.debug(f"         ✂️ CẮT: y2 từ {original_y2} → {y2} (loại bỏ page number)")
            
            # Cắt ảnh nếu còn có nội dung
            if y2 > y1:
                logger.debug(f"         🔲 Cropping: (0, {y1}, {width}, {y2})")
                cropped = img.crop((0, y1, width, y2))
                image_chunk = img.crop((0, y1, width, original_y2))
                image_chunk.save(section_dir / f"chunk_page_{page_idx}.png")
                images_to_merge.append(cropped)
                
                # Tạo transformation info
                transformation = {
                    'page_idx': page_idx,
                    'original_y_start': y1,
                    'original_y_end': y2,
                    'merged_y_start': current_y_offset,
                    'merged_y_end': current_y_offset + (y2 - y1),
                    'cropped_height': y2 - y1,
                    'page_number_cut': page_idx in page_cut_positions,
                    'cut_position': page_cut_positions.get(page_idx, None),
                    'original_section_y2': original_y2
                }
                coord_transformations.append(transformation)
                
                removed_pixels = original_y2 - y2 if page_idx in page_cut_positions else 0
                logger.debug(f"         ✅ Cropped: {width}x{y2-y1} pixels → offset {current_y_offset}")
                if removed_pixels > 0:
                    logger.debug(f"         ✂️ Loại bỏ {removed_pixels}px (page number area)")

                if draw_debug:
                    #lưu ảnh cắt để kiểm tra
                    cropped.save(f"{output_dir}/debug_cropped_page_{page_idx}.png")
                    # Cập nhật offset cho ảnh tiếp theo
                
                
                current_y_offset += (y2 - y1)
            else:
                logger.debug(f"         ⚠️ Bỏ qua trang {page_idx}: không còn nội dung sau khi cắt page number")
        
        # Ghép ảnh
        if not images_to_merge:
            logger.debug("    ❌ Không có ảnh nào để ghép!")
            return Image.new('RGB', (100, 100), 'white'), []
        
        logger.debug(f"\n    🔗 Ghép {len(images_to_merge)} ảnh...")
        
        if len(images_to_merge) == 1:
            final_img = images_to_merge[0]
        else:
            total_width = max(img.width for img in images_to_merge)
            total_height = sum(img.height for img in images_to_merge)
            
            logger.debug(f"    📐 Final size: {total_width}x{total_height}")
            final_img = Image.new('RGB', (total_width, total_height), 'white')
            y_offset = 0
            
            for i, img in enumerate(images_to_merge):
                x_offset = (total_width - img.width) // 2
                final_img.paste(img, (x_offset, y_offset))
                logger.debug(f"        Paste {i}: {img.width}x{img.height} at ({x_offset}, {y_offset})")
                y_offset += img.height
        
        total_cut_pages = len([p for p in page_cut_positions.keys() if start_page <= p <= end_page])
        total_saved_pixels = sum(
            trans.get('original_section_y2', trans['original_y_end']) - trans['original_y_end'] 
            for trans in coord_transformations if trans.get('page_number_cut', False)
        )
        
        logger.debug(f"    ✅ Merged image size: {final_img.width}x{final_img.height}")
        logger.debug(f"    ✂️ Đã cắt page numbers trên {total_cut_pages} trang")
        logger.debug(f"    💾 Tiết kiệm: {total_saved_pixels}px")
        
        return final_img, coord_transformations
    
    def _create_title_image_from_data(self, section_data: dict, page_images: Dict[int, Image.Image], title: str) -> Image.Image:
        """Tạo title image từ section data (ước lượng vị trí title)"""
        start_page = section_data['start_page']
        start_y = section_data['start_y']
        
        if start_page in page_images:
            img = page_images[start_page]
            # Ước lượng vùng title (khoảng 50 pixels từ start_y)
            title_height = min(50, img.height - start_y)
            if title_height > 0:
                return img.crop((0, start_y, img.width, start_y + title_height))
        return None
    
    def _update_formula_coordinates(self, formulas: List[dict], coord_transformations: List[dict]) -> List[dict]:
        """Cập nhật coordinates của formulas trong ảnh ghép - có xét đến việc cắt page numbers"""
        updated_formulas = []
        
        logger.debug(f"    🔧 Updating coordinates cho {len(formulas)} formulas...")
        
        for i, formula in enumerate(formulas):
            page_idx = formula['page_idx']
            orig_x1, orig_y1, orig_x2, orig_y2 = formula['coordinate']
            
            # Tìm transformation cho trang này
            transformation = None
            for trans in coord_transformations:
                if trans['page_idx'] == page_idx:
                    transformation = trans
                    break
            
            if transformation is None:
                logger.debug(f"      ❌ Formula {i+1}: Không tìm thấy transformation cho trang {page_idx}")
                continue
            
            # KIỂM TRA: Formula có bị cắt bởi page number removal không?
            if transformation.get('page_number_cut', False):
                cut_position = transformation.get('cut_position')
                if cut_position and orig_y1 >= cut_position:
                    logger.debug(f"      ❌ Formula {i+1}: Bị loại bỏ do nằm trong vùng page number (y={orig_y1} >= cut={cut_position})")
                    continue
                elif cut_position and orig_y2 > cut_position:
                    logger.debug(f"      ⚠️ Formula {i+1}: Bị cắt một phần do page number (y2={orig_y2} > cut={cut_position})")
                    # Có thể điều chỉnh orig_y2 = cut_position nếu muốn giữ lại phần trên
                    continue
            
            # Kiểm tra formula có trong vùng section đã được merge không
            if not (transformation['original_y_start'] <= orig_y1 < transformation['original_y_end'] and
                    transformation['original_y_start'] <= orig_y2 <= transformation['original_y_end']):
                logger.debug(f"      ❌ Formula {i+1}: Ngoài vùng section")
                logger.debug(f"         Formula y={orig_y1}-{orig_y2} vs Section y={transformation['original_y_start']}-{transformation['original_y_end']}")
                continue
            
            # Transform coordinates
            new_x1 = orig_x1
            new_x2 = orig_x2
            new_y1 = transformation['merged_y_start'] + (orig_y1 - transformation['original_y_start'])
            new_y2 = transformation['merged_y_start'] + (orig_y2 - transformation['original_y_start'])
            
            # Validation
            if new_y1 < 0 or new_y2 < new_y1:
                logger.debug(f"      ❌ Formula {i+1}: Coordinates không hợp lệ new_y={new_y1}-{new_y2}")
                continue
            
            # Tạo formula đã cập nhật
            updated_formula = {
                'formula_id': formula['formula_id'],
                'coordinate': [new_x1, new_y1, new_x2, new_y2],
                'ocr_content': formula.get('ocr_content', ''),
                'score': formula.get('score', 0.0),
                'original_coordinate': formula['coordinate'],
                'page_idx': page_idx,
                'transformation_info': {
                    'page_cut': transformation.get('page_number_cut', False),
                    'cut_position': transformation.get('cut_position'),
                    'y_offset': transformation['merged_y_start']
                }
            }
            
            updated_formulas.append(updated_formula)
            
            logger.debug(f"      ✅ Formula {i+1}: [{orig_x1},{orig_y1},{orig_x2},{orig_y2}] → [{new_x1},{new_y1},{new_x2},{new_y2}]")
            if transformation.get('page_number_cut'):
                logger.debug(f"         (Trang {page_idx} đã cắt page number tại y={transformation.get('cut_position')})")
        
        logger.debug(f"    ✅ Hoàn thành: {len(updated_formulas)}/{len(formulas)} formulas")
        removed_count = len(formulas) - len(updated_formulas)
        if removed_count > 0:
            logger.debug(f"    📊 Đã loại bỏ {removed_count} formulas do page number cutting hoặc ngoài vùng")
        
        return updated_formulas

    # ===== PHƯƠNG THỨC CŨ (GIỮ LẠI CHO BACKWARD COMPATIBILITY) =====
    def merge_and_save_sections(self, output_dir, sections: List[DocumentSection], page_images: Dict[int, Image.Image], 
                               summary_report: dict, all_elements: List[DetectedElement]):
        """
        Phương thức cũ: Cắt, ghép và lưu các sections với formula data từ layout_visualization
        """
        logger.debug("\n💾 Cắt ghép và lưu sections với formulas data từ layout_visualization...")
        
        # Load formulas data từ layout_visualization
        formulas_data = self._load_formulas_data(output_dir)

        # Tạo mapping giữa sections gốc và summary report
        section_mapping = self._create_section_mapping(sections, summary_report)
        
        # Detect page numbers để cắt bỏ
        page_number_regions = self._detect_page_number_regions(all_elements, page_images, summary_report)
        
        for report_section in summary_report['sections']:
            section_index = report_section['index']
            section_title = report_section['title']
            
            logger.debug(f"\n  Processing section {section_index}: '{section_title}'...")
            
            # Tìm section gốc tương ứng
            original_section = section_mapping.get(section_index)
            if original_section is None:
                logger.debug(f"    ⚠️ Không tìm thấy section gốc cho index {section_index}")
                continue
            
            # Tạo thư mục cho section
            section_name = self._sanitize_filename(section_title)
            section_dir = Path(output_dir) / f"section_{section_index:02d}_{section_name}"
            section_dir.mkdir(exist_ok=True)
            
            # 1. LẤY FORMULAS CHO SECTION NÀY từ formulas_data 
            logger.debug(f"    🔍 Lấy formulas cho section từ formulas_data...")
            section_formulas = self._get_formulas_for_section(formulas_data, original_section)
            
            # 2. Cắt và ghép ảnh chính (với việc loại bỏ page numbers)
            logger.debug(f"    🔗 Ghép ảnh và tính toán coordinate transformation...")
            merged_img, coord_transformations = self._merge_section_images_with_coordinate_tracking(
                original_section, page_images, page_number_regions
            )
            merged_img_path = section_dir / "merged_image.png"
            merged_img.save(merged_img_path)
            logger.debug(f"    ✅ Đã lưu merged_image.png (đã loại bỏ page numbers)")
            
            # 3. Cắt và lưu title (nếu có)
            if original_section.title_element:
                title_img = self._crop_element(original_section.title_element, page_images)
                title_img.save(section_dir / "title.png")
            
            # 4. CẬP NHẬT COORDINATES của formulas trong ảnh ghép
            logger.debug(f"    📐 Cập nhật coordinates cho {len(section_formulas)} formulas...")
            updated_formulas = self._update_formula_coordinates(section_formulas, coord_transformations)
            
            logger.debug(f"    ✅ Đã cập nhật coordinates cho {len(updated_formulas)} formulas")
            
            # 5. Lưu metadata đơn giản - chỉ formulas với coordinates đã cập nhật
            metadata = {
                'section_index': section_index,
                'section_title': section_title,
                'formulas': updated_formulas
            }
            
            with open(section_dir / "metadata.json", 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2, default=self._convert_np)
            
            logger.debug(f"    ✅ Đã lưu metadata.json với {len(updated_formulas)} formulas")
    
    def _load_formulas_data(self, output_dir) -> List[dict]:
        """Load formulas data từ tất cả các thư mục trang trong layout_visualization"""
        layout_vis_dir = Path(output_dir) / "layout_visualization"

        if not layout_vis_dir.exists():
            logger.debug("  ⚠️ Không tìm thấy thư mục layout_visualization")
            return []
            
        all_formulas = []
        
        # Tìm tất cả thư mục trang
        page_dirs = [d for d in layout_vis_dir.iterdir() if d.is_dir() and d.name.startswith('formula_page_')]
        
        if not page_dirs:
            logger.debug("  ⚠️ Không tìm thấy thư mục formula_page_* nào")
            return []
        
        for page_dir in sorted(page_dirs):
            formulas_data_path = page_dir / 'formulas_data.json'
            
            if formulas_data_path.exists():
                try:
                    with open(formulas_data_path, 'r', encoding='utf-8') as f:
                        page_formulas = json.load(f)
                    all_formulas.extend(page_formulas)
                    logger.debug(f"    ✅ Loaded {len(page_formulas)} formulas từ {page_dir.name}")
                except Exception as e:
                    logger.debug(f"    ⚠️ Lỗi khi load {formulas_data_path}: {e}")
            else:
                logger.debug(f"    ⚠️ Không tìm thấy formulas_data.json trong {page_dir.name}")
        
        logger.debug(f"  ✅ Tổng cộng loaded {len(all_formulas)} formulas từ {len(page_dirs)} trang")
        return all_formulas
    
    def _get_formulas_for_section(self, formulas_data: List[dict], section: DocumentSection) -> List[dict]:
        """Lấy các formulas thuộc về một section cụ thể"""
        section_formulas = []
        
        for formula in formulas_data:
            page_idx = formula['page_idx']
            coord = formula['original_coordinate']
            formula_y = coord[1]  # Y coordinate
            
            # Kiểm tra xem formula có nằm trong section không
            if self._is_formula_in_section_old(page_idx, formula_y, section):
                section_formulas.append(formula)
                
        logger.debug(f"      📋 Section có {len(section_formulas)} formulas")
        return section_formulas
    
    def _is_formula_in_section_old(self, formula_page: int, formula_y: float, section: DocumentSection) -> bool:
        """Kiểm tra xem formula có thuộc section không (phiên bản cũ)"""
        # Trường hợp 1: Formula và section cùng trang (có thể start=end page)
        if section.start_page == section.end_page == formula_page:
            return section.start_y <= formula_y < section.end_y  # < không phải <=
            
        # Trường hợp 2: Formula ở trang đầu của section (khác end_page)
        elif formula_page == section.start_page:
            return formula_y >= section.start_y
            
        # Trường hợp 3: Formula ở trang cuối của section (khác start_page) 
        elif formula_page == section.end_page:
            return formula_y < section.end_y  # < để loại trừ title tiếp theo
            
        # Trường hợp 4: Formula ở trang giữa
        elif section.start_page < formula_page < section.end_page:
            return True
            
        return False
    
    def _merge_section_images_with_coordinate_tracking(self, section: DocumentSection, 
                                                     page_images: Dict[int, Image.Image],
                                                     page_number_regions: Dict[int, Tuple[int, int]]) -> Tuple[Image.Image, List[dict]]:
        """Ghép các phần ảnh của một section với việc track coordinate transformations"""
        images_to_merge = []
        coord_transformations = []
        current_y_offset = 0
        
        logger.debug(f"    🔗 Merging section từ trang {section.start_page} đến {section.end_page}")
        
        # Xử lý từng trang trong section
        for page_idx in range(section.start_page, section.end_page + 1):
            img = page_images[page_idx]
            width, height = img.size
            
            # Xác định vùng cắt theo các trường hợp khác nhau
            if page_idx == section.start_page and page_idx == section.end_page:
                # Section nằm hoàn toàn trong 1 trang
                y1 = section.start_y
                y2 = min(section.end_y, height)
                case_desc = f"Section trong 1 trang: y={y1} đến y={y2}"
                
            elif page_idx == section.start_page:
                # Trang đầu của section
                y1 = section.start_y
                y2 = height
                case_desc = f"Trang đầu - từ y={y1}"
                
            elif page_idx == section.end_page:
                # Trang cuối của section
                y1 = 0
                y2 = min(section.end_y, height)
                case_desc = f"Trang cuối - đến y={y2}"
                
            else:
                # Trang giữa
                y1 = 0
                y2 = height
                case_desc = "Trang giữa - lấy toàn bộ"
            
            logger.debug(f"      📐 {case_desc}")
            
            # Xử lý page number removal (nếu có)
            original_y2 = y2
            if page_idx in page_number_regions:
                page_num_y1, page_num_y2 = page_number_regions[page_idx]
                if page_num_y1 < y2:
                    y2 = min(y2, page_num_y1)
                    logger.debug(f"      🔢 Page number removal: điều chỉnh y2 từ {original_y2} → {y2}")
            
            # Cắt và lưu ảnh
            if y2 > y1:
                cropped = img.crop((0, y1, width, y2))
                images_to_merge.append(cropped)
                
                # Tạo coordinate transformation info
                transformation = {
                    'page_idx': page_idx,
                    'original_y_start': y1,
                    'original_y_end': y2,
                    'merged_y_start': current_y_offset,
                    'merged_y_end': current_y_offset + (y2 - y1),
                    'cropped_height': y2 - y1
                }
                coord_transformations.append(transformation)
                
                logger.debug(f"      ✅ Cropped: {width}x{y2-y1} pixels → merged offset {current_y_offset}")
                current_y_offset += (y2 - y1)
        
        # Ghép các ảnh theo chiều dọc
        if not images_to_merge:
            return Image.new('RGB', (100, 100), 'white'), []
            
        if len(images_to_merge) == 1:
            final_img = images_to_merge[0]
        else:
            total_width = max(img.width for img in images_to_merge)
            total_height = sum(img.height for img in images_to_merge)
            
            final_img = Image.new('RGB', (total_width, total_height), 'white')
            y_offset = 0
            
            for img in images_to_merge:
                x_offset = (total_width - img.width) // 2
                final_img.paste(img, (x_offset, y_offset))
                y_offset += img.height
        
        logger.debug(f"    ✅ Merged image final size: {final_img.width}x{final_img.height}")
        return final_img, coord_transformations
    
    def _detect_page_number_regions(self, all_elements: List[DetectedElement], 
                                   page_images: Dict[int, Image.Image], 
                                   summary_report: dict) -> Dict[int, Tuple[int, int]]:
        """Detect các vùng chứa page numbers để cắt bỏ"""
        logger.debug("  🔢 Detecting page number regions để cắt bỏ...")
        
        page_number_regions = {}
        page_numbers = summary_report.get('page_numbers', {})
        
        # Tìm number elements trên mỗi trang
        number_elements = [elem for elem in all_elements if elem.type == 'number']
        
        for page_idx, page_number in page_numbers.items():
            page_idx = int(page_idx)
            
            # Tìm number elements trên trang này
            page_numbers_on_page = [elem for elem in number_elements if elem.page_index == page_idx]
            
            if not page_numbers_on_page:
                continue
                
            # OCR để tìm element chứa page number
            for elem in page_numbers_on_page:
                if self.reader:
                    ocr_result = self._ocr_element_from_page(elem, page_images)
                    if ocr_result.strip().isdigit() and int(ocr_result.strip()) == page_number:
                        # Tìm thấy page number, xác định vùng cắt
                        y1, y2 = elem.coordinate[1], elem.coordinate[3]
                        padding = 20
                        img_height = page_images[page_idx].height
                        
                        cut_y_start = max(0, y1 - padding)
                        cut_y_end = img_height
                        
                        page_number_regions[page_idx] = (cut_y_start, cut_y_end)
                        logger.debug(f"    📄 Trang {page_idx}: Page number {page_number} tại y={y1}-{y2}, sẽ cắt từ y={cut_y_start}")
                        break
                        
        return page_number_regions
    
    def _create_section_mapping(self, sections: List[DocumentSection], summary_report: dict) -> Dict[int, DocumentSection]:
        """Tạo mapping giữa sections gốc và summary report"""
        mapping = {}
        for i, section in enumerate(sections):
            if i < len(summary_report['sections']):
                mapping[summary_report['sections'][i]['index']] = section
        return mapping
    
    def _sanitize_filename(self, filename: str) -> str:
        """Làm sạch tên file, loại bỏ ký tự không hợp lệ"""
        filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
        if len(filename) > 50:
            filename = filename[:50]
        return filename.strip()
        
    def _crop_element(self, elem: DetectedElement, page_images: Dict[int, Image.Image]) -> Image.Image:
        """Cắt một element từ ảnh gốc"""
        img = page_images[elem.page_index]
        x1, y1, x2, y2 = elem.coordinate
        return img.crop((x1, y1, x2, y2))
        
    def _ocr_element_from_page(self, elem: DetectedElement, page_images: Dict[int, Image.Image]) -> str:
        """OCR một element từ page images"""
        if not self.reader:
            return ""
            
        img = page_images[elem.page_index]
        x1, y1, x2, y2 = elem.coordinate
        cropped = img.crop((x1, y1, x2, y2))
        result = self.reader.readtext(np.array(cropped), detail=0)
        if not result:
            return ""
        return ' '.join(result)
    
    def _convert_np(self, obj):
        """Convert numpy objects to JSON serializable objects"""
        if isinstance(obj, np.generic):
            return obj.item()
        if isinstance(obj, (np.ndarray,)):
            return obj.tolist()
        return obj