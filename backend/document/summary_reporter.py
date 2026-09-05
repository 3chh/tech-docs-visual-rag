import json
import numpy as np
# import easyocr
from pathlib import Path
from typing import List, Dict, Tuple
from PIL import Image, ImageDraw
from .document_section import DocumentSection
from .detected_element import DetectedElement

from ..core.logging import get_logger

logger = get_logger(__name__)

try:
    from paddleocr import FormulaRecognition, LayoutDetection, TextRecognition
except ImportError:
    FormulaRecognition = None
    LayoutDetection = None
    TextRecognition = None


class SummaryReporter:
    """
    Chịu trách nhiệm tạo báo cáo tổng hợp (summary report) với OCR cho titles, numbers và formulas
    CẬP NHẬT: Lưu tất cả OCR data vào files để sử dụng lại
    """
    
    # def __init__(self, output_dir: Path, formula_batch_size: int = 16, lazy_load: bool = False):
    #     self.output_dir = output_dir
    #     self.formula_batch_size = formula_batch_size
        
    #     # Tạo thư mục lưu OCR data
    #     self.data_dir = self.output_dir / "ocr_data"
    #     self.data_dir.mkdir(exist_ok=True)
        
    #     # Lazy loading - chỉ khởi tạo models khi cần thiết
    #     self.lazy_load = lazy_load
    #     self.reader = None
    #     self.text_recognition_model = None
    #     self.layout_model = None
    #     self.formula_model = None
        
        # if not lazy_load:
        #     # Khởi tạo ngay lập tức (cho option 1)
        #     self._init_models()

    def __init__(self, config):
        self.number_batch_size = config.get('number_batch_size', 16)
        self.formula_batch_size = config.get('formula_batch_size', 16)
        self.title_batch_size = config.get('title_batch_size', 32)
        self.lazy_load = config.get('lazy_load', False)
        self.reader = None
        self.text_recognition_model = None
        # self.layout_model = None
        self.formula_model = None

        if not self.lazy_load:
            # Khởi tạo ngay lập tức (cho option 1)
            self._init_models()
    
    def _init_models(self):
        """Khởi tạo models khi cần thiết"""
        # if self.reader is None:
        #     print("🔧 Khởi tạo EasyOCR trong SummaryReporter...")
        #     self.reader = easyocr.Reader(['ja'])
        if not hasattr(self, 'text_recognition_model') or self.text_recognition_model is None:
            logger.debug("🔧 Khởi tạo PaddleOCR TextRecognition trong SummaryReporter...")
            self.text_recognition_model = TextRecognition(model_name="PP-OCRv5_server_rec")


        # if self.layout_model is None and LayoutDetection:
        #     print("🔧 Khởi tạo Layout Detection model trong SummaryReporter...")
        #     self.layout_model = LayoutDetection(model_name="PP-DocLayout_plus-L")
        elif not LayoutDetection:
            logger.debug("⚠️ LayoutDetection không khả dụng trong SummaryReporter")
            
        if self.formula_model is None and FormulaRecognition:
            logger.debug("🔧 Khởi tạo Formula Recognition model trong SummaryReporter...")
            self.formula_model = FormulaRecognition(model_name="PP-FormulaNet_plus-L")
        elif not FormulaRecognition:
            logger.debug("⚠️ FormulaRecognition không khả dụng trong SummaryReporter")
        
    def create_summary_report(self, output_dir, num_pages, sections: List[DocumentSection], 
                             all_elements: List[DetectedElement], page_images: Dict[int, Image.Image]) -> dict:
        """
        Tạo báo cáo tổng hợp với OCR cho tất cả elements
        CẬP NHẬT: Lưu tất cả OCR data vào files riêng để sử dụng lại
        """
        logger.debug("\n📊 Tạo summary report với OCR tất cả elements và lưu data...")

        # data_path = Path(output_dir) / "ocr_data"
        # data_path.mkdir(exist_ok=True)

        # Khởi tạo models nếu chưa có
        self._init_models()
        
        # 1. OCR và lưu TITLES
        logger.debug("  📝 OCR và lưu TITLES...")
        titles_data = self._ocr_and_save_titles(output_dir, sections, page_images, self.title_batch_size)
        
        # 2. OCR và lưu PAGE NUMBERS  
        # print("  🔢 OCR và lưu PAGE NUMBERS...")
        # page_numbers_data = self._ocr_and_save_page_numbers(output_dir, all_elements, page_images)

        # # 3. DETECT + OCR và lưu FORMULAS
        # print("  🔍 DETECT + OCR và lưu FORMULAS...")
        # formulas_data = self._detect_ocr_and_save_formulas(output_dir, page_images)

        page_numbers_data, formulas_data = self._ocr_and_save_page_numbers_and_formulas(output_dir, all_elements, page_images, self.number_batch_size, self.formula_batch_size)

        # 4. Tạo summary report từ data
        report = self._create_summary_report_from_data(
            num_pages, sections, titles_data, page_numbers_data, formulas_data
        )
        
        # 5. Lưu summary report
        summary_path = Path(output_dir) / "pre_summary_report.json"
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=4, default=self.convert_np)
            
        logger.debug(f"✅ Đã lưu summary report tại: {summary_path}")
        logger.debug(f"✅ Đã lưu tất cả OCR data trong: {output_dir}/ocr_data")
        
        # In thông tin tóm tắt
        self._print_summary_info(report)
        
        return report

    def _ocr_and_save_titles(self, output_dir, sections: List[DocumentSection], page_images: Dict[int, Image.Image], batch_size: int) -> Dict[int, str]:
        """OCR và lưu thông tin titles (batch processing)"""
        data_path = Path(output_dir) / 'ocr_data'
        data_path.mkdir(exist_ok=True)

        titles_data = {}
        title_imgs = []
        title_indices = []

        # 1. Crop all title images and collect their indices
        for i, section in enumerate(sections):
            if section.title_element is not None:
                elem = section.title_element
                img = page_images[elem.page_index]
                x1, y1, x2, y2 = elem.coordinate
                cropped = img.crop((x1, y1, x2, y2))
                temp_path = data_path / f"temp_title_{i}.png"
                cropped.save(temp_path)
                title_imgs.append(str(temp_path))
                title_indices.append(i)
            else:
                titles_data[i] = 'noname'

        # 2. Batch OCR
        if title_imgs:
            try:
                outputs = self.text_recognition_model.predict(input=title_imgs, batch_size=batch_size)
                for idx, output in zip(title_indices, outputs):
                    if hasattr(output, 'rec_text'):
                        titles_data[idx] = output.rec_text
                    elif isinstance(output, dict) and 'rec_text' in output:
                        titles_data[idx] = output['rec_text']
                    elif isinstance(output, str):
                        titles_data[idx] = output
                    else:
                        logger.debug(f"    [DEBUG] Unexpected OCR output format: {type(output)}, {output}")
                        titles_data[idx] = ""
                    logger.debug(f"    📝 Section {idx}: '{titles_data[idx]}'")
            except Exception as e:
                logger.debug(f"    [ERROR] Batch OCR for titles failed: {e}")
                for idx in title_indices:
                    titles_data[idx] = ""
        # 3. Save to file
        titles_path = data_path / 'titles_data.json'
        with open(titles_path, 'w', encoding='utf-8') as f:
            json.dump(titles_data, f, ensure_ascii=False, indent=2)

        logger.debug(f"    ✅ Đã lưu {len(titles_data)} titles vào: {titles_path}")
        return titles_data
    
    # def _ocr_and_save_page_numbers(self, output_dir, all_elements: List[DetectedElement], page_images: Dict[int, Image.Image], draw_debug: bool) -> Dict[int, dict]:
    #     """OCR và lưu thông tin page numbers với tọa độ"""

    #     data_path = Path(output_dir) / 'ocr_data'
    #     data_path.mkdir(exist_ok=True)

    #     page_numbers_data = {}
    #     number_elements = [elem for elem in all_elements if elem.type == 'number']
    #     # lưu tất cả number elements để debug later
    #     all_number_elements = number_elements.copy()
    #     print(f"  🔢 Bắt đầu OCR page numbers...")
    #     print(f"    🔍 Tìm thấy {len(number_elements)} number elements")
        
    #     # Tạo thư mục lưu ảnh page numbers đã cắt
    #     page_numbers_images_dir = data_path / 'page_numbers_images'
    #     page_numbers_images_dir.mkdir(exist_ok=True)
        
    #     # Group numbers by page
    #     numbers_by_page = {}
    #     for elem in number_elements:
    #         page_idx = elem.page_index
    #         if page_idx not in numbers_by_page:
    #             numbers_by_page[page_idx] = []
    #         numbers_by_page[page_idx].append(elem)
        
    #     # OCR numbers và tìm page numbers
    #     for page_idx, numbers in numbers_by_page.items():
    #         img_height = page_images[page_idx].height
    #         print(f"    📄 Trang {page_idx}: {len(numbers)} numbers, page height={img_height}")
            
    #         numbers.sort(key=lambda x: x.coordinate[1])
            
    #         # TỐI ƯU: OCR TẤT CẢ VÀ TÌM BEST CANDIDATE TRONG 1 VÒNG FOR
    #         all_numbers_dir = page_numbers_images_dir / f"all_numbers_page_{page_idx}"
    #         all_numbers_dir.mkdir(exist_ok=True)
            
    #         best_candidate = None
    #         best_score = -1

    #         # OCR tất cả numbers trong page 
    #         for i, elem in enumerate(numbers):
    #             y_pos = elem.coordinate[1]
    #             y_percent = (y_pos / img_height) * 100
                
    #             # OCR chỉ 1 lần cho mỗi element
    #             ocr_result = self._ocr_number_element_with_padding(data_path, elem, page_images, padding=10)
    #             print(f"        Number {i}: y={y_pos} ({y_percent:.1f}%), OCR='{ocr_result}', coord={elem.coordinate}")
                
    #             # Lưu ảnh debug trong cùng vòng for
    #             page_img = page_images[page_idx]
    #             x1, y1, x2, y2 = elem.coordinate
                
    #             # Thêm padding cho ảnh lưu debug
    #             img_width, img_height_img = page_img.size
    #             x1_padded = max(0, x1 - 10)
    #             y1_padded = max(0, y1 - 10)
    #             x2_padded = min(img_width, x2 + 10)
    #             y2_padded = min(img_height_img, y2 + 10)
                
    #             cropped_number = page_img.crop((x1_padded, y1_padded, x2_padded, y2_padded))
    #             number_filename = f"number_{i}_y{y_pos:.0f}_ocr_{ocr_result.strip().replace(' ', '_')}_padded.png"
    #             number_path = all_numbers_dir / number_filename
    #             cropped_number.save(number_path)
                
    #             # Tìm best candidate trong cùng vòng for
    #             if ocr_result.strip():
    #                 score = y_percent  # Vẫn chấp nhận text nhưng điểm thấp hơn
                
    #                 if score > best_score:
    #                     best_score = score
    #                     best_candidate = {
    #                         'element': elem,
    #                         'ocr_result': ocr_result.strip(),
    #                         'score': score,
    #                         'is_digit': ocr_result.strip().isdigit()
    #                     }
    #                 else:
    #                     print(f"        ❌ Bỏ qua candidate {i} với score {score:.1f} (không tốt hơn best {best_score:.1f})")
    #         if best_candidate:
    #             elem = best_candidate['element']
    #             ocr_content = best_candidate['ocr_result']
                
    #             # Xử lý page number - ưu tiên số nguyên, fallback sang text
    #             if best_candidate['is_digit']:
    #                 page_number = int(ocr_content)
    #                 page_type = "number"
    #             else:
    #                 page_number = ocr_content  # Giữ nguyên text
    #                 page_type = "text"
                
    #             # Cắt và lưu ảnh page number với padding
    #             page_img = page_images[page_idx]
    #             x1, y1, x2, y2 = elem.coordinate
                
    #             # Thêm padding 10px cho ảnh page number
    #             img_width, img_height_img = page_img.size
    #             x1_padded = max(0, x1 - 10)
    #             y1_padded = max(0, y1 - 10)
    #             x2_padded = min(img_width, x2 + 10)
    #             y2_padded = min(img_height_img, y2 + 10)
                
    #             cropped_page_number = page_img.crop((x1_padded, y1_padded, x2_padded, y2_padded))
                
    #             # Lưu ảnh page number đã cắt với padding
    #             safe_content = str(page_number).replace('/', '_').replace('\\', '_').replace(' ', '_')
    #             page_number_filename = f"page_{page_idx}_{page_type}_{safe_content}_padded.png"
    #             page_number_path = page_numbers_images_dir / page_number_filename
    #             cropped_page_number.save(page_number_path)
                
    #             page_numbers_data[page_idx] = {
    #                 'page_number': page_number,
    #                 'page_type': page_type,
    #                 'coordinate': elem.coordinate,
    #                 'ocr_content': ocr_content,
    #                 'score': best_candidate['score'],
    #                 'y_percent': (elem.coordinate[1] / img_height) * 100,
    #                 'cropped_image_path': str(page_number_path),
    #                 'is_digit': best_candidate['is_digit']
    #             }
    #             print(f"    ✅ CHỌN page {page_type}: {page_number} tại y={elem.coordinate[1]} ({best_candidate['score']:.1f}%)")
    #             print(f"    💾 Đã lưu ảnh: {page_number_filename}")
    #         else:
    #             print(f"    ❌ Không tìm thấy page number hợp lệ trên trang {page_idx} (không có OCR result)")
        
    #     # Lưu vào file
    #     page_numbers_path = data_path / 'page_numbers_data.json'
    #     with open(page_numbers_path, 'w', encoding='utf-8') as f:
    #         json.dump(page_numbers_data, f, ensure_ascii=False, indent=2, default=self.convert_np)
        
    #     print(f"    ✅ Đã lưu {len(page_numbers_data)} page numbers vào: {page_numbers_path}")
    #     print(f"    📁 Đã lưu {len(page_numbers_data)} ảnh page numbers vào: {page_numbers_images_dir}")
        
    #     # DEBUG: Tạo debug image cho page numbers
    #     self._create_page_numbers_debug_images(output_dir, page_numbers_data, page_images, number_elements)

    #     return page_numbers_data
    
    def _create_page_numbers_debug_images(self, output_dir, page_numbers_data: Dict[int, dict], 
                                         page_images: Dict[int, Image.Image], 
                                         all_number_elements: List[DetectedElement]):
        """Tạo debug images để kiểm tra page number detection"""
        debug_dir = Path(output_dir) / "page_numbers_debug"
        debug_dir.mkdir(exist_ok=True)
        
        for page_idx, page_img in page_images.items():
            debug_img = page_img.copy()
            draw = ImageDraw.Draw(debug_img)
            
            # Vẽ tất cả number elements
            page_numbers = [elem for elem in all_number_elements if elem.page_index == page_idx]
            for i, elem in enumerate(page_numbers):
                coord = elem.coordinate
                # Vẽ bounding box màu xanh cho tất cả numbers
                draw.rectangle(coord, outline='blue', width=2)
                draw.text((coord[0], coord[1] - 20), f"num_{i}", fill='blue')
            
            # Vẽ page number đã chọn (nếu có)
            if page_idx in page_numbers_data:
                selected_coord = page_numbers_data[page_idx]['coordinate']
                page_num = page_numbers_data[page_idx]['page_number']
                
                # Vẽ bounding box màu đỏ cho page number đã chọn
                draw.rectangle(selected_coord, outline='red', width=5)
                draw.text((selected_coord[0], selected_coord[1] - 40), f"PAGE_NUM: {page_num}", fill='red')
                
                # Vẽ cut line
                cut_y = selected_coord[1] - 50  # Padding 50px
                draw.line([(0, cut_y), (debug_img.width, cut_y)], fill='red', width=3)
                draw.text((10, cut_y - 30), f"CUT LINE: y={cut_y}", fill='red')
            
            # Lưu debug image
            debug_img.save(debug_dir / f"page_{page_idx}_page_numbers_debug.png")
        
        logger.debug(f"    📸 Đã lưu debug images tại: {debug_dir}")
        logger.debug(f"         → Kiểm tra để xem page numbers có được detect đúng không")
    
    # def _detect_ocr_and_save_formulas(self, output_dir, page_images: Dict[int, Image.Image]) -> Dict[int, List[dict]]:
    #     """Detect, OCR và lưu thông tin formulas theo trang"""

    #     data_path = Path(output_dir) / 'ocr_data'
    #     data_path.mkdir(exist_ok=True)

    #     if not self.layout_model:
    #         print("  ⚠️ Không có Layout Detection model, bỏ qua formula detection")
    #         return {}
        
    #     formulas_by_page = {}
    #     layout_vis_dir = Path(output_dir) / "layout_visualization"
    #     layout_vis_dir.mkdir(exist_ok=True)
        
    #     # Tạo thư mục lưu rejected formulas
    #     rejected_formulas_dir = Path(output_dir) / "rejected_formulas"
    #     rejected_formulas_dir.mkdir(exist_ok=True)
        
    #     # Collect all formulas from all pages
    #     all_formulas_batch = []
    #     all_rejected_formulas = []  # Lưu thông tin formulas bị loại
        
    #     for page_idx, page_img in page_images.items():
    #         print(f"    Detecting formulas trên trang {page_idx}...")
            
    #         # Tạo thư mục cho trang
    #         page_dir = layout_vis_dir / f"page_{page_idx}"
    #         page_dir.mkdir(exist_ok=True)
            
    #         # Lưu ảnh trang tạm
    #         temp_page_path = page_dir / f"temp_page_{page_idx}.png"
    #         page_img.save(temp_page_path)
            
    #         try:
    #             # Detect layout
    #             output = self.layout_model.predict(str(temp_page_path), batch_size=128, layout_nms=True)
                
    #             # Tạo layout visualization
    #             layout_vis_img = page_img.copy()
    #             draw = ImageDraw.Draw(layout_vis_img)
                
    #             page_formulas = []
    #             page_rejected_formulas = []  # Lưu formulas bị loại trên trang này
    #             formula_count = 0
    #             rejected_count = 0
                
    #             for res in output:
    #                 boxes = res.boxes if hasattr(res, 'boxes') else res.get('boxes', [])
                    
    #                 for box in boxes:
    #                     if isinstance(box, dict):
    #                         label = box.get('label', '')
    #                         coord = box.get('coordinate', [])
    #                         score = box.get('score', 0.0)
    #                     else:
    #                         label = getattr(box, 'label', '')
    #                         coord = getattr(box, 'coordinate', [])
    #                         score = getattr(box, 'score', 0.0)
                        
    #                     # Vẽ visualization cho debug
    #                     if coord and len(coord) == 4:
    #                         color = {
    #                             'paragraph_title': 'red',
    #                             'formula': 'blue', 
    #                             'number': 'green',
    #                             'formula_number': 'orange'
    #                         }.get(label, 'yellow')
    #                         draw.rectangle(coord, outline=color, width=3)
    #                         draw.text((coord[0], coord[1]), label, fill=color)
                        
    #                     # Collect formulas cho batch OCR với filtering theo kích thước
    #                     if label == 'formula' and coord and len(coord) == 4:
    #                         # Tính kích thước formula
    #                         formula_width = coord[2] - coord[0]
    #                         formula_height = coord[3] - coord[1]
    #                         formula_area = formula_width * formula_height
                            
    #                         # Lọc formula dựa trên kích thước tương đối với trang
    #                         page_width, page_height = page_img.size
    #                         page_area = page_width * page_height
                            
    #                         # Tính tỉ lệ kích thước
    #                         width_ratio = formula_width / page_width
    #                         height_ratio = formula_height / page_height
    #                         area_ratio = formula_area / page_area
                            
    #                         # Lấy ngưỡng lọc từ cấu hình
    #                         filter_config = self._get_formula_filter_config()
                            
    #                         # Kiểm tra điều kiện lọc
    #                         is_valid_size = (
    #                             width_ratio >= filter_config['min_width_ratio'] and 
    #                             height_ratio >= filter_config['min_height_ratio'] and 
    #                             area_ratio >= filter_config['min_area_ratio'] and
    #                             width_ratio <= filter_config['max_width_ratio'] and
    #                             height_ratio <= filter_config['max_height_ratio']
    #                         )
                            
    #                         if is_valid_size:
    #                             formula_img = page_img.crop(coord)
    #                             formula_path = page_dir / f"formula_{formula_count}.png"
    #                             formula_img.save(formula_path)
                                
    #                             formula_info = {
    #                                 'page_idx': page_idx,
    #                                 'formula_id': f"page_{page_idx}_formula_{formula_count}",
    #                                 'coordinate': coord,
    #                                 'score': score,
    #                                 'image_path': str(formula_path),
    #                                 'size_info': {
    #                                     'width': formula_width,
    #                                     'height': formula_height,
    #                                     'area': formula_area,
    #                                     'width_ratio': round(width_ratio, 4),
    #                                     'height_ratio': round(height_ratio, 4),
    #                                     'area_ratio': round(area_ratio, 6)
    #                                 }
    #                             }
                                
    #                             page_formulas.append(formula_info)
    #                             all_formulas_batch.append((formula_info, formula_path))
    #                             formula_count += 1
                                
    #                             print(f"        ✅ Formula {formula_count}: {formula_width}x{formula_height} "
    #                                   f"(w:{width_ratio:.3f}, h:{height_ratio:.3f}, area:{area_ratio:.5f})")
    #                         else:
    #                             # Tạo thư mục cho rejected formulas của trang này
    #                             page_rejected_dir = rejected_formulas_dir / f"page_{page_idx}"
    #                             page_rejected_dir.mkdir(exist_ok=True)
                                
    #                             # Lưu ảnh formula bị loại bỏ
    #                             rejected_formula_img = page_img.crop(coord)
    #                             rejected_formula_path = page_rejected_dir / f"rejected_formula_{rejected_count}.png"
    #                             rejected_formula_img.save(rejected_formula_path)
                                
    #                             # Xác định lý do bị loại bỏ
    #                             rejection_reason = []
    #                             if width_ratio < filter_config['min_width_ratio']:
    #                                 rejection_reason.append(f"width_too_small({width_ratio:.3f}<{filter_config['min_width_ratio']})")
    #                             if height_ratio < filter_config['min_height_ratio']:
    #                                 rejection_reason.append(f"height_too_small({height_ratio:.3f}<{filter_config['min_height_ratio']})")
    #                             if area_ratio < filter_config['min_area_ratio']:
    #                                 rejection_reason.append(f"area_too_small({area_ratio:.5f}<{filter_config['min_area_ratio']})")
    #                             if width_ratio > filter_config['max_width_ratio']:
    #                                 rejection_reason.append(f"width_too_large({width_ratio:.3f}>{filter_config['max_width_ratio']})")
    #                             if height_ratio > filter_config['max_height_ratio']:
    #                                 rejection_reason.append(f"height_too_large({height_ratio:.3f}>{filter_config['max_height_ratio']})")
                                
    #                             # Lưu thông tin formula bị loại bỏ
    #                             rejected_formula_info = {
    #                                 'page_idx': page_idx,
    #                                 'rejected_id': f"page_{page_idx}_rejected_{rejected_count}",
    #                                 'coordinate': coord,
    #                                 'score': score,
    #                                 'image_path': str(rejected_formula_path),
    #                                 'rejection_reasons': rejection_reason,
    #                                 'size_info': {
    #                                     'width': formula_width,
    #                                     'height': formula_height,
    #                                     'area': formula_area,
    #                                     'width_ratio': round(width_ratio, 4),
    #                                     'height_ratio': round(height_ratio, 4),
    #                                     'area_ratio': round(area_ratio, 6)
    #                                 },
    #                                 'filter_config_used': filter_config.copy()
    #                             }
                                
    #                             page_rejected_formulas.append(rejected_formula_info)
    #                             all_rejected_formulas.append(rejected_formula_info)
    #                             rejected_count += 1
                                
    #                             print(f"        ❌ Loại bỏ formula {rejected_count}: {formula_width}x{formula_height} "
    #                                   f"- {', '.join(rejection_reason)}")
                
    #             # Lưu layout visualization
    #             layout_vis_path = page_dir / f"layout_page_{page_idx}.png"
    #             layout_vis_img.save(layout_vis_path)
                
    #             # Lưu thông tin formulas của trang
    #             formulas_by_page[page_idx] = page_formulas
                
    #             # Lưu thông tin rejected formulas của trang
    #             if page_rejected_formulas:
    #                 page_rejected_dir = rejected_formulas_dir / f"page_{page_idx}"
    #                 rejected_info_path = page_rejected_dir / "rejected_formulas_info.json"
    #                 with open(rejected_info_path, 'w', encoding='utf-8') as f:
    #                     json.dump(page_rejected_formulas, f, ensure_ascii=False, indent=2, default=self.convert_np)
                
    #             # Xóa file tạm
    #             temp_page_path.unlink()
                
    #             print(f"      ✅ Trang {page_idx}: {len(page_formulas)} formulas (sau khi lọc), {len(page_rejected_formulas)} rejected")
                
    #         except Exception as e:
    #             print(f"    ⚠️ Lỗi detect formulas trang {page_idx}: {e}")
    #             formulas_by_page[page_idx] = []
        
    #     # In thống kê lọc formulas
    #     total_detected_formulas = sum(len(formulas) for formulas in formulas_by_page.values())
    #     total_rejected_formulas = len(all_rejected_formulas)
    #     print(f"  📊 THỐNG KÊ FORMULA FILTERING:")
    #     print(f"    - Formulas được chấp nhận: {total_detected_formulas}")
    #     print(f"    - Formulas bị loại bỏ: {total_rejected_formulas}")
    #     print(f"    - Tỉ lệ chấp nhận: {(total_detected_formulas/(total_detected_formulas+total_rejected_formulas)*100):.1f}%" if (total_detected_formulas+total_rejected_formulas) > 0 else "N/A")
    #     print(f"    - Tiết kiệm OCR: {total_rejected_formulas} formulas không cần OCR")
        
    #     # Lưu tổng hợp rejected formulas
    #     if all_rejected_formulas:
    #         self._save_rejected_formulas_summary(all_rejected_formulas, rejected_formulas_dir)
        
    #     # Batch OCR all formulas
    #     if all_formulas_batch and self.formula_model:
    #         print(f"  🚀 Batch OCR cho {len(all_formulas_batch)} formulas...")
    #         formula_contents = self._batch_ocr_formulas(all_formulas_batch)
            
    #         # Cập nhật nội dung OCR
    #         formula_idx = 0
    #         for page_idx, page_formulas in formulas_by_page.items():
    #             for formula in page_formulas:
    #                 if formula_idx < len(formula_contents):
    #                     formula['ocr_content'] = formula_contents[formula_idx]
    #                     formula_idx += 1
    #                 else:
    #                     formula['ocr_content'] = ""
        
    #     # Lưu formulas data
    #     formulas_path = data_path / 'formulas_data.json'
    #     with open(formulas_path, 'w', encoding='utf-8') as f:
    #         json.dump(formulas_by_page, f, ensure_ascii=False, indent=2, default=self.convert_np)
        
    #     total_formulas = sum(len(formulas) for formulas in formulas_by_page.values())
    #     print(f"    ✅ Đã lưu {total_formulas} formulas vào: {formulas_path}")
        
    #     return formulas_by_page

    def _ocr_and_save_page_numbers_and_formulas(
        self,
        output_dir,
        all_elements: List[DetectedElement],
        page_images: Dict[int, Image.Image],
        number_batch_size: int = 16,
        formula_batch_size: int = 16
    ) -> Tuple[Dict[int, dict], Dict[int, List[dict]]]:
        """
        OCR và lưu thông tin page numbers và formulas từ detected elements.
        Trả về tuple (page_numbers_data, formulas_data)
        """
        data_path = Path(output_dir) / 'ocr_data'
        data_path.mkdir(exist_ok=True)

        # --- PAGE NUMBERS ---
        page_numbers_data = {}
        number_elements = [elem for elem in all_elements if elem.type == 'number']
        all_number_elements = number_elements.copy()
        logger.debug(f"  🔢 Bắt đầu OCR page numbers...")
        logger.debug(f"    🔍 Tìm thấy {len(number_elements)} number elements")

        page_numbers_images_dir = data_path / 'page_numbers_images'
        page_numbers_images_dir.mkdir(exist_ok=True)

        # Prepare crops for batch OCR
        number_crops = []
        number_crop_infos = []
        for elem in number_elements:
            page_img = page_images[elem.page_index]
            x1, y1, x2, y2 = elem.coordinate
            img_width, img_height = page_img.size
            x1_padded = max(0, x1 - 10)
            y1_padded = max(0, y1 - 10)
            x2_padded = min(img_width, x2 + 10)
            y2_padded = min(img_height, y2 + 10)
            cropped = page_img.crop((x1_padded, y1_padded, x2_padded, y2_padded))
            temp_path = data_path / f"temp_number_{elem.page_index}_{x1}_{y1}_{x2}_{y2}.png"
            cropped.save(temp_path)
            number_crops.append(str(temp_path))
            number_crop_infos.append((elem, temp_path))

        # Batch OCR for numbers
        ocr_results = []
        if number_crops:
            try:
                ocr_results = self.text_recognition_model.predict(input=number_crops, batch_size=number_batch_size)
            except Exception as e:
                logger.debug(f"    [ERROR] Batch OCR for numbers failed: {e}")
                ocr_results = [""] * len(number_crops)

        # Group results by page and select best candidate per page
        numbers_by_page = {}
        for idx, (elem, crop_path) in enumerate(number_crop_infos):
            page_idx = elem.page_index
            if page_idx not in numbers_by_page:
                numbers_by_page[page_idx] = []
            ocr_result = ""
            if ocr_results and idx < len(ocr_results):
                output = ocr_results[idx]
                if hasattr(output, 'rec_text'):
                    ocr_result = output.rec_text
                elif isinstance(output, dict) and 'rec_text' in output:
                    ocr_result = output['rec_text']
                elif isinstance(output, str):
                    ocr_result = output
            numbers_by_page[page_idx].append((elem, ocr_result))

        for page_idx, numbers in numbers_by_page.items():
            img_height = page_images[page_idx].height
            numbers.sort(key=lambda x: x[0].coordinate[1])
            best_candidate = None
            best_score = -1
            for i, (elem, ocr_result) in enumerate(numbers):
                y_pos = elem.coordinate[1]
                y_percent = (y_pos / img_height) * 100
                if ocr_result.strip():
                    score = y_percent
                    if score > best_score:
                        best_score = score
                        best_candidate = {
                            'element': elem,
                            'ocr_result': ocr_result.strip(),
                            'score': score,
                            'is_digit': ocr_result.strip().isdigit()
                        }
            if best_candidate:
                elem = best_candidate['element']
                ocr_content = best_candidate['ocr_result']
                if best_candidate['is_digit']:
                    page_number = int(ocr_content)
                    page_type = "number"
                else:
                    page_number = ocr_content
                    page_type = "text"

                page_img = page_images[page_idx]
                x1, y1, x2, y2 = elem.coordinate
                img_width, img_height_img = page_img.size
                x1_padded = max(0, x1 - 10)
                y1_padded = max(0, y1 - 10)
                x2_padded = min(img_width, x2 + 10)
                y2_padded = min(img_height_img, y2 + 10)
                cropped_page_number = page_img.crop((x1_padded, y1_padded, x2_padded, y2_padded))
                safe_content = str(page_number).replace('/', '_').replace('\\', '_').replace(' ', '_')
                page_number_filename = f"page_{page_idx}_{page_type}_{safe_content}_padded.png"
                page_number_path = page_numbers_images_dir / page_number_filename
                cropped_page_number.save(page_number_path)

                page_numbers_data[page_idx] = {
                    'page_number': page_number,
                    'page_type': page_type,
                    'coordinate': elem.coordinate,
                    'ocr_content': ocr_content,
                    'score': best_candidate['score'],
                    'y_percent': (elem.coordinate[1] / img_height) * 100,
                    'cropped_image_path': str(page_number_path),
                    'is_digit': best_candidate['is_digit']
                }
                logger.debug(f"    ✅ CHỌN page {page_type}: {page_number} tại y={elem.coordinate[1]} ({best_candidate['score']:.1f}%)")
                logger.debug(f"    💾 Đã lưu ảnh: {page_number_filename}")
            else:
                logger.debug(f"    ❌ Không tìm thấy page number hợp lệ trên trang {page_idx} (không có OCR result)")

        # Lưu vào file
        page_numbers_path = data_path / 'page_numbers_data.json'
        with open(page_numbers_path, 'w', encoding='utf-8') as f:
            json.dump(page_numbers_data, f, ensure_ascii=False, indent=2, default=self.convert_np)

        logger.debug(f"    ✅ Đã lưu {len(page_numbers_data)} page numbers vào: {page_numbers_path}")
        logger.debug(f"    📁 Đã lưu {len(page_numbers_data)} ảnh page numbers vào: {page_numbers_images_dir}")

        self._create_page_numbers_debug_images(output_dir, page_numbers_data, page_images, all_number_elements)

        # --- FORMULAS ---
        formulas_data = {}
        formula_elements = [elem for elem in all_elements if elem.type == 'formula']
        logger.debug(f"  🔍 Bắt đầu xử lý formulas...")
        formulas_images_dir = data_path / 'formulas_images'
        formulas_images_dir.mkdir(exist_ok=True)

        formulas_by_page = {}
        all_formulas_batch = []

        # Prepare crops for batch OCR
        for elem in formula_elements:
            page_idx = elem.page_index
            page_img = page_images[page_idx]
            coord = elem.coordinate
            score = elem.score
            formula_width = coord[2] - coord[0]
            formula_height = coord[3] - coord[1]
            formula_area = formula_width * formula_height
            page_width, page_height = page_img.size
            page_area = page_width * page_height
            width_ratio = formula_width / page_width
            height_ratio = formula_height / page_height
            area_ratio = formula_area / page_area
            filter_config = self._get_formula_filter_config()
            is_valid_size = (
                width_ratio >= filter_config['min_width_ratio'] and 
                height_ratio >= filter_config['min_height_ratio'] and 
                area_ratio >= filter_config['min_area_ratio'] and
                width_ratio <= filter_config['max_width_ratio'] and
                height_ratio <= filter_config['max_height_ratio']
            )
            if is_valid_size and score >= filter_config['min_score']:
                formula_img = page_img.crop(coord)
                formula_path = formulas_images_dir / f"formula_page{page_idx}_{len(formulas_by_page.get(page_idx, []))}.png"
                formula_img.save(formula_path)
                formula_info = {
                    'page_idx': page_idx,
                    'formula_id': f"page_{page_idx}_formula_{len(formulas_by_page.get(page_idx, []))}",
                    'coordinate': coord,
                    'score': score,
                    'image_path': str(formula_path),
                    'size_info': {
                        'width': formula_width,
                        'height': formula_height,
                        'area': formula_area,
                        'width_ratio': round(width_ratio, 4),
                        'height_ratio': round(height_ratio, 4),
                        'area_ratio': round(area_ratio, 6)
                    }
                }
                formulas_by_page.setdefault(page_idx, []).append(formula_info)
                all_formulas_batch.append((formula_info, formula_path))
            # else: (handle rejected formulas if needed)
        formulas_data = formulas_by_page

        # Batch OCR for formulas if model available
        if all_formulas_batch and self.formula_model:
            logger.debug(f"  🚀 Batch OCR cho {len(all_formulas_batch)} formulas...")
            formula_paths = [str(path) for _, path in all_formulas_batch]
            formula_contents = []
            for i in range(0, len(formula_paths), formula_batch_size):
                batch_paths = formula_paths[i:i+formula_batch_size]
                try:
                    batch_results = self.formula_model.predict(batch_paths, batch_size=len(batch_paths))
                    batch_contents = [result['rec_formula'] if isinstance(result, dict) and 'rec_formula' in result else str(result) for result in batch_results]
                    formula_contents.extend(batch_contents)
                except Exception as e:
                    logger.debug(f"      ⚠️ Lỗi batch OCR: {e}")
                    formula_contents.extend([""] * len(batch_paths))
            # Assign OCR results back
            formula_idx = 0
            for page_idx, page_formulas in formulas_data.items():
                for formula in page_formulas:
                    if formula_idx < len(formula_contents):
                        formula['ocr_content'] = formula_contents[formula_idx]
                        formula_idx += 1
                    else:
                        formula['ocr_content'] = ""

        formulas_path = data_path / 'formulas_data.json'
        with open(formulas_path, 'w', encoding='utf-8') as f:
            json.dump(formulas_data, f, ensure_ascii=False, indent=2, default=self.convert_np)

        logger.debug(f"    ✅ Đã lưu {sum(len(f) for f in formulas_data.values())} formulas vào: {formulas_path}")

        return page_numbers_data, formulas_data

    def _create_summary_report_from_data(self, num_pages, sections: List[DocumentSection], 
                                        titles_data: Dict[int, str], page_numbers_data: Dict[int, dict], 
                                        formulas_data: Dict[int, List[dict]]) -> dict:
        """Tạo summary report từ các data đã OCR"""
        
        # Tạo page numbers mapping
        page_numbers = {}
        for page_idx, data in page_numbers_data.items():
            page_numbers[page_idx] = data['page_number']
        
        report = {
            'total_pages': num_pages,
            'total_sections': len(sections),
            'page_numbers': page_numbers,
            'sections': []
        }
        
        for i, section in enumerate(sections):
            title = titles_data.get(i, 'noname')
            
            # Tính page_range string
            page_range_list = []
            for page_idx in range(section.start_page, section.end_page + 1):
                if page_idx in page_numbers:
                    page_range_list.append(str(page_numbers[page_idx]))
            
            # Đếm formulas trong section
            section_formulas = 0
            for page_idx in range(section.start_page, section.end_page + 1):
                if page_idx in formulas_data:
                    for formula in formulas_data[page_idx]:
                        if self._is_formula_in_section(formula, section):
                            section_formulas += 1
            
            section_info = {
                'index': i,
                'title': title,
                'page_range': f"{section.start_page}-{section.end_page}",
                'precise_range': {
                    'start_page': section.start_page,
                    'start_y': section.start_y,
                    'end_page': section.end_page,
                    'end_y': section.end_y,
                    # 'page_numbers': ','.join(page_range_list) if page_range_list else f"{section.start_page},{section.end_page}"
                    'page_numbers': page_range_list
                },
                'total_elements': len(section.elements),
                'formulas': section_formulas,
                'numbers': len([e for e in section.elements if e.type in ['number', 'formula_number']])
            }
            report['sections'].append(section_info)
        
        return report
    
    def _is_formula_in_section(self, formula: dict, section: DocumentSection) -> bool:
        """Kiểm tra xem formula có thuộc section không"""
        page_idx = formula['page_idx']
        formula_y = formula['coordinate'][1]
        
        if section.start_page == section.end_page == page_idx:
            return section.start_y <= formula_y < section.end_y
        elif page_idx == section.start_page:
            return formula_y >= section.start_y
        elif page_idx == section.end_page:
            return formula_y < section.end_y
        elif section.start_page < page_idx < section.end_page:
            return True
        return False
    
    def _batch_ocr_formulas(self, formulas_batch: List[Tuple[dict, Path]]) -> List[str]:
        """Batch OCR cho tất cả formulas"""
        if not self.formula_model:
            return [""] * len(formulas_batch)
        
        formula_contents = []
        total_formulas = len(formulas_batch)
        
        for i in range(0, total_formulas, self.formula_batch_size):
            batch_end = min(i + self.formula_batch_size, total_formulas)
            batch_paths = [str(path) for _, path in formulas_batch[i:batch_end]]
            
            logger.debug(f"    🔄 Processing batch {i//self.formula_batch_size + 1}/{(total_formulas-1)//self.formula_batch_size + 1}")
            
            try:
                batch_results = self.formula_model.predict(batch_paths, batch_size=len(batch_paths))
                batch_contents = [str(result) if result is not None else "" for result in batch_results]
                formula_contents.extend(batch_contents)
            except Exception as e:
                logger.debug(f"      ⚠️ Lỗi batch OCR: {e}")
                formula_contents.extend([""] * len(batch_paths))
        
        return formula_contents
    
    def _print_summary_info(self, report: dict):
        """In thông tin tóm tắt"""
        logger.debug("\n📊 SUMMARY REPORT:")
        logger.debug(f"  - Tổng số trang: {report['total_pages']}")
        logger.debug(f"  - Tổng số sections: {report['total_sections']}")
        logger.debug(f"  - Số trang đã OCR: {len(report['page_numbers'])} pages")
        
        for section in report['sections']:
            precise = section['precise_range']
            logger.debug(f"  - Section {section['index']}: '{section['title']}' "
                  f"(trang {section['page_range']}, pages {precise['page_numbers']}, "
                  f"{section['formulas']} formulas, "
                  f"{section['numbers']} numbers)")
    
    # def _ocr_element(self, elem: DetectedElement, page_images: Dict[int, Image.Image]) -> str:
    #     """OCR một element"""
    #     img = page_images[elem.page_index]
    #     x1, y1, x2, y2 = elem.coordinate
    #     cropped = img.crop((x1, y1, x2, y2))
    #     result = self.reader.readtext(np.array(cropped), detail=0)
    #     return ' '.join(result) if result else ""

    def _ocr_element(self, data_path, elem: DetectedElement, page_images: Dict[int, Image.Image]) -> str:
        img = page_images[elem.page_index]
        x1, y1, x2, y2 = elem.coordinate
        cropped = img.crop((x1, y1, x2, y2))
        cropped_path = data_path / "temp_crop.png"
        cropped.save(cropped_path)

        try:
            output = self.text_recognition_model.predict(input=str(cropped_path), batch_size=1)
            if output and len(output) > 0:
                # Handle different PaddleOCR output formats
                if hasattr(output[0], 'rec_text'):
                    return output[0].rec_text
                elif isinstance(output[0], dict) and 'rec_text' in output[0]:
                    return output[0]['rec_text']
                elif isinstance(output[0], str):
                    return output[0]
                else:
                    logger.debug(f"    [DEBUG] Unexpected OCR output format: {type(output[0])}, {output[0]}")
                    return ""
            else:
                return ""
        except Exception as e:
            logger.debug(f"    [ERROR] OCR failed: {e}")
            return ""
    # EasyOCR
    # def _ocr_number_element_with_padding(self, elem: DetectedElement, page_images: Dict[int, Image.Image], padding: int = 10) -> str:
    #     """OCR một number element với padding để tránh mất chữ"""
    #     img = page_images[elem.page_index]
    #     x1, y1, x2, y2 = elem.coordinate
        
    #     # Thêm padding và đảm bảo không vượt quá giới hạn ảnh
    #     img_width, img_height = img.size
    #     x1_padded = max(0, x1 - padding)
    #     y1_padded = max(0, y1 - padding)
    #     x2_padded = min(img_width, x2 + padding)
    #     y2_padded = min(img_height, y2 + padding)
        
    #     cropped = img.crop((x1_padded, y1_padded, x2_padded, y2_padded))
    #     result = self.reader.readtext(np.array(cropped), detail=0)
    #     return ' '.join(result) if result else ""
    
    # PaddleOCR
    def _ocr_number_element_with_padding(self, data_path, elem: DetectedElement, page_images: Dict[int, Image.Image], padding: int = 10) -> str:
        img = page_images[elem.page_index]
        x1, y1, x2, y2 = elem.coordinate

        img_width, img_height = img.size
        x1_padded = max(0, x1 - padding)
        y1_padded = max(0, y1 - padding)
        x2_padded = min(img_width, x2 + padding)
        y2_padded = min(img_height, y2 + padding)

        cropped = img.crop((x1_padded, y1_padded, x2_padded, y2_padded))
        cropped_path = data_path / "temp_crop_number.png"
        cropped.save(cropped_path)

        try:
            output = self.text_recognition_model.predict(input=str(cropped_path), batch_size=1)
            if output and len(output) > 0:
                # Handle different PaddleOCR output formats
                if hasattr(output[0], 'rec_text'):
                    return output[0].rec_text
                elif isinstance(output[0], dict) and 'rec_text' in output[0]:
                    return output[0]['rec_text']
                elif isinstance(output[0], str):
                    return output[0]
                else:
                    logger.debug(f"    [DEBUG] Unexpected OCR output format: {type(output[0])}, {output[0]}")
                    return ""
            else:
                return ""
        except Exception as e:
            logger.debug(f"    [ERROR] OCR failed: {e}")
            return ""

    def convert_np(self, obj):
        """Convert numpy objects to JSON serializable"""
        if isinstance(obj, np.generic):
            return obj.item()
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return obj
    
    def load_corrected_summary_report(self, output_dir) -> dict:
        """Load summary report đã được sửa"""
        corrected_path = Path(output_dir) / 'summary_report_corrected.json'

        if corrected_path.exists():
            logger.debug(f"\n📊 Load summary report đã sửa từ: {corrected_path}")
            with open(corrected_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        else:
            logger.debug("\n⚠️ Sử dụng summary report gốc")
            original_path = Path(output_dir) / 'summary_report.json'
            with open(original_path, 'r', encoding='utf-8') as f:
                return json.load(f)

    def load_ocr_data(self, data_path) -> Tuple[Dict[int, str], Dict[int, dict], Dict[int, List[dict]]]:
        """Load tất cả OCR data đã lưu"""
        logger.debug("📂 Loading OCR data từ files...")
        
        # Load titles data
        titles_path = data_path / 'titles_data.json'
        if titles_path.exists():
            with open(titles_path, 'r', encoding='utf-8') as f:
                titles_data = json.load(f)
                titles_data = {int(k): v for k, v in titles_data.items()}
        else:
            titles_data = {}
        
        # Load page numbers data
        page_numbers_path = data_path / 'page_numbers_data.json'
        if page_numbers_path.exists():
            with open(page_numbers_path, 'r', encoding='utf-8') as f:
                page_numbers_data = json.load(f)
                page_numbers_data = {int(k): v for k, v in page_numbers_data.items()}
        else:
            page_numbers_data = {}
        
        # Load formulas data
        formulas_path = data_path / 'formulas_data.json'
        if formulas_path.exists():
            with open(formulas_path, 'r', encoding='utf-8') as f:
                formulas_data = json.load(f)
                formulas_data = {int(k): v for k, v in formulas_data.items()}
        else:
            formulas_data = {}
        
        logger.debug(f"  ✅ Titles: {len(titles_data)}")
        logger.debug(f"  ✅ Page numbers: {len(page_numbers_data)}")
        logger.debug(f"  ✅ Formulas: {sum(len(f) for f in formulas_data.values())}")
        
        return titles_data, page_numbers_data, formulas_data
    
    def configure_formula_filtering(self, min_width_ratio: float = 0.025, 
                                   min_height_ratio: float = 0.015,
                                   min_area_ratio: float = 0.0003,
                                   max_width_ratio: float = 0.85,
                                   max_height_ratio: float = 0.25):
        """
        Cấu hình ngưỡng lọc formulas - ĐÃ TĂNG NGƯỠNG để lọc bỏ nhiều ký hiệu nhỏ hơn
        
        Args:
            min_width_ratio: Tỉ lệ chiều rộng tối thiểu so với trang (default: 2.5% - tăng từ 1.5%)
            min_height_ratio: Tỉ lệ chiều cao tối thiểu so với trang (default: 1.5% - tăng từ 0.8%)
            min_area_ratio: Tỉ lệ diện tích tối thiểu so với trang (default: 0.03% - tăng từ 0.01%)
            max_width_ratio: Tỉ lệ chiều rộng tối đa so với trang (default: 85% - giảm từ 90%)
            max_height_ratio: Tỉ lệ chiều cao tối đa so với trang (default: 25% - giảm từ 30%)
        """
        self.formula_filter_config = {
            'min_width_ratio': min_width_ratio,
            'min_height_ratio': min_height_ratio,
            'min_area_ratio': min_area_ratio,
            'max_width_ratio': max_width_ratio,
            'max_height_ratio': max_height_ratio
        }
        
        logger.debug(f"📐 Cấu hình formula filtering:")
        logger.debug(f"  - Min width: {min_width_ratio:.3f} ({min_width_ratio*100:.1f}%)")
        logger.debug(f"  - Min height: {min_height_ratio:.3f} ({min_height_ratio*100:.1f}%)")
        logger.debug(f"  - Min area: {min_area_ratio:.5f} ({min_area_ratio*100:.3f}%)")
        logger.debug(f"  - Max width: {max_width_ratio:.3f} ({max_width_ratio*100:.1f}%)")
        logger.debug(f"  - Max height: {max_height_ratio:.3f} ({max_height_ratio*100:.1f}%)")

    def _get_formula_filter_config(self):
        """Lấy cấu hình filter, sử dụng default nếu chưa được set"""
        if not hasattr(self, 'formula_filter_config'):
            # Cấu hình mặc định - TĂNG NGƯỎNG để lọc bỏ nhiều ký hiệu nhỏ hơn
            self.formula_filter_config = {
                'min_width_ratio': 0.045,   # 2.5% chiều rộng trang (tăng từ 1.5%)
                'min_height_ratio': 0.015,  # 1.5% chiều cao trang (tăng từ 0.8%)
                'min_area_ratio': 0.0003,   # 0.03% diện tích trang (tăng từ 0.01%)
                'max_width_ratio': 0.85,    # 85% chiều rộng trang (giảm từ 90%)
                'max_height_ratio': 0.25,    # 25% chiều cao trang (giảm từ 30%)
                'min_score': 0.65  # Ngưỡng điểm tối thiểu để chấp nhận formula
            }
        return self.formula_filter_config
    
    def _save_rejected_formulas_summary(self, all_rejected_formulas: List[dict], rejected_dir: Path):
        """Lưu tổng hợp thông tin về các formulas bị loại bỏ"""
        
        # Thống kê rejection reasons
        rejection_stats = {}
        size_stats = {
            'widths': [],
            'heights': [],
            'areas': [],
            'width_ratios': [],
            'height_ratios': [],
            'area_ratios': []
        }
        
        for formula in all_rejected_formulas:
            # Đếm rejection reasons
            for reason in formula['rejection_reasons']:
                if reason not in rejection_stats:
                    rejection_stats[reason] = 0
                rejection_stats[reason] += 1
            
            # Collect size statistics
            size_info = formula['size_info']
            size_stats['widths'].append(size_info['width'])
            size_stats['heights'].append(size_info['height'])
            size_stats['areas'].append(size_info['area'])
            size_stats['width_ratios'].append(size_info['width_ratio'])
            size_stats['height_ratios'].append(size_info['height_ratio'])
            size_stats['area_ratios'].append(size_info['area_ratio'])
        
        # Tính toán thống kê
        def calc_stats(values):
            if not values:
                return {'min': 0, 'max': 0, 'avg': 0, 'count': 0}
            return {
                'min': min(values),
                'max': max(values),
                'avg': sum(values) / len(values),
                'count': len(values)
            }
        
        summary = {
            'summary_info': {
                'total_rejected': len(all_rejected_formulas),
                'timestamp': self.get_timestamp(),
                'filter_config_used': all_rejected_formulas[0]['filter_config_used'] if all_rejected_formulas else {}
            },
            'rejection_reasons_stats': rejection_stats,
            'size_statistics': {
                'width_pixels': calc_stats(size_stats['widths']),
                'height_pixels': calc_stats(size_stats['heights']),
                'area_pixels': calc_stats(size_stats['areas']),
                'width_ratios': calc_stats(size_stats['width_ratios']),
                'height_ratios': calc_stats(size_stats['height_ratios']),
                'area_ratios': calc_stats(size_stats['area_ratios'])
            },
            'rejected_formulas_by_page': {},
            'all_rejected_formulas': all_rejected_formulas
        }
        
        # Nhóm theo trang
        for formula in all_rejected_formulas:
            page_idx = formula['page_idx']
            if page_idx not in summary['rejected_formulas_by_page']:
                summary['rejected_formulas_by_page'][page_idx] = []
            summary['rejected_formulas_by_page'][page_idx].append(formula)
        
        # Lưu summary report
        summary_path = rejected_dir / "rejected_formulas_summary.json"
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2, default=self.convert_np)
        
        # Tạo human-readable report
        readable_report = self._create_readable_rejected_report(summary)
        readable_path = rejected_dir / "rejected_formulas_report.txt"
        with open(readable_path, 'w', encoding='utf-8') as f:
            f.write(readable_report)
        
        logger.debug(f"    📄 Đã lưu rejected formulas summary: {summary_path.name}")
        logger.debug(f"    📋 Đã lưu readable report: {readable_path.name}")
    
    def _create_readable_rejected_report(self, summary: dict) -> str:
        """Tạo báo cáo dễ đọc về rejected formulas"""
        lines = []
        lines.append("=" * 80)
        lines.append("📊 BÁO CÁO FORMULAS BỊ LOẠI BỎ")
        lines.append("=" * 80)
        lines.append(f"Thời gian: {summary['summary_info']['timestamp']}")
        lines.append(f"Tổng số formulas bị loại: {summary['summary_info']['total_rejected']}")
        lines.append("")
        
        # Rejection reasons
        lines.append("🚫 LÝ DO BỊ LOẠI BỎ:")
        lines.append("-" * 40)
        rejection_stats = summary['rejection_reasons_stats']
        for reason, count in sorted(rejection_stats.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / summary['summary_info']['total_rejected']) * 100
            lines.append(f"  - {reason}: {count} lần ({percentage:.1f}%)")
        lines.append("")
        
        # Size statistics
        lines.append("📏 THỐNG KÊ KÍCH THƯỚC:")
        lines.append("-" * 40)
        size_stats = summary['size_statistics']
        
        lines.append("Kích thước pixels:")
        lines.append(f"  - Width: {size_stats['width_pixels']['min']:.0f} - {size_stats['width_pixels']['max']:.0f} (avg: {size_stats['width_pixels']['avg']:.1f})")
        lines.append(f"  - Height: {size_stats['height_pixels']['min']:.0f} - {size_stats['height_pixels']['max']:.0f} (avg: {size_stats['height_pixels']['avg']:.1f})")
        lines.append(f"  - Area: {size_stats['area_pixels']['min']:.0f} - {size_stats['area_pixels']['max']:.0f} (avg: {size_stats['area_pixels']['avg']:.0f})")
        lines.append("")
        
        lines.append("Tỉ lệ so với trang:")
        lines.append(f"  - Width ratio: {size_stats['width_ratios']['min']:.4f} - {size_stats['width_ratios']['max']:.4f} (avg: {size_stats['width_ratios']['avg']:.4f})")
        lines.append(f"  - Height ratio: {size_stats['height_ratios']['min']:.4f} - {size_stats['height_ratios']['max']:.4f} (avg: {size_stats['height_ratios']['avg']:.4f})")
        lines.append(f"  - Area ratio: {size_stats['area_ratios']['min']:.6f} - {size_stats['area_ratios']['max']:.6f} (avg: {size_stats['area_ratios']['avg']:.6f})")
        lines.append("")
        
        # By page breakdown
        lines.append("📄 PHÂN BỐ THEO TRANG:")
        lines.append("-" * 40)
        by_page = summary['rejected_formulas_by_page']
        for page_idx in sorted(by_page.keys(), key=int):
            count = len(by_page[page_idx])
            lines.append(f"  - Page {page_idx}: {count} formulas bị loại")
        lines.append("")
        
        # Filter config
        lines.append("⚙️ CẤU HÌNH LỌC ĐÃ SỬ DỤNG:")
        lines.append("-" * 40)
        filter_config = summary['summary_info']['filter_config_used']
        if filter_config:
            lines.append(f"  - Min width ratio: {filter_config['min_width_ratio']:.4f} ({filter_config['min_width_ratio']*100:.2f}%)")
            lines.append(f"  - Min height ratio: {filter_config['min_height_ratio']:.4f} ({filter_config['min_height_ratio']*100:.2f}%)")
            lines.append(f"  - Min area ratio: {filter_config['min_area_ratio']:.6f} ({filter_config['min_area_ratio']*100:.4f}%)")
            lines.append(f"  - Max width ratio: {filter_config['max_width_ratio']:.4f} ({filter_config['max_width_ratio']*100:.2f}%)")
            lines.append(f"  - Max height ratio: {filter_config['max_height_ratio']:.4f} ({filter_config['max_height_ratio']*100:.2f}%)")
        lines.append("")
        
        lines.append("💡 HƯỚNG DẪN:")
        lines.append("-" * 40)
        lines.append("  - Xem ảnh rejected formulas trong thư mục page_X/")
        lines.append("  - Điều chỉnh ngưỡng lọc nếu cần thiết")
        lines.append("  - Sử dụng configure_formula_filtering() để thay đổi cấu hình")
        lines.append("=" * 80)
        
        return "\n".join(lines)
    
    def get_timestamp(self) -> str:
        """Lấy timestamp hiện tại"""
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")