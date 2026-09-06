import type { TranslationDictionary } from "../types";

export const vi: TranslationDictionary = {
  app_name: "Cosmo ChatPDF",
  app_tagline: "Không gian làm việc Tài liệu & Bản vẽ",

  // Navigation & Tabs
  nav_chat: "Tra cứu",
  nav_documents: "Tài liệu",
  nav_outline: "Cây mục lục",
  nav_new_chat: "Cuộc trò chuyện mới",

  // Sidebar
  collections_title: "Bộ tài liệu",
  add_collection: "Thêm bộ tài liệu",
  new_collection_placeholder: "Tên bộ tài liệu mới...",
  chat_history_title: "Lịch sử trò chuyện",
  no_history: "Chưa có cuộc trò chuyện nào.",
  delete_session: "Xoá cuộc trò chuyện",
  current_collection: "Bộ tài liệu đang mở",

  // Chat & Q&A
  ask_placeholder: "Đặt câu hỏi về thông số, công thức hoặc điều khoản trong tài liệu...",
  sources_title: "Trích dẫn",
  formulas_found: "công thức",
  rewritten_note: "Chuẩn hoá thuật ngữ:",
  empty_chat_title: "Tra cứu tài liệu",
  empty_chat_desc: "Tra cứu thông số, công thức kỹ thuật và đối soát trang gốc từ tài liệu.",

  // Document Canvas
  canvas_title: "Bản vẽ & Tài liệu",
  toc_button: "Mục lục",
  search_toc_placeholder: "Lọc mục lục...",
  no_toc: "Chưa có mục lục cho bộ tài liệu này.",
  no_source_selected: "Chưa chọn trích dẫn",
  no_source_desc: "Chọn một trích dẫn trong câu trả lời để xem ảnh cắt lát.",
  zoom_in: "Phóng to",
  zoom_out: "Thu nhỏ",
  reset_zoom: "Kích thước chuẩn (100%)",
  copy_formula: "Sao chép công thức",
  formula_copied: "Đã sao chép vào bộ nhớ tạm!",
  view_mode_pdf: "Tài liệu gốc",
  view_mode_slice: "Trích dẫn",
  page_counter: "Trang",
  prev_page: "Trang trước",
  next_page: "Trang kế",
  open_canvas_btn: "Mở Canvas",

  // Documents Library
  documents_title: "Quản lý Tài liệu",
  drag_drop_pdf: "Kéo thả file PDF vào đây hoặc chọn từ máy tính",
  browse_files: "Chọn tệp PDF",
  processing_btn: "Bắt đầu xử lý",
  in_collection: "Tài liệu trong bộ",
  open_in_canvas: "Xem trong Canvas",
  total_sections: "mục",
  total_pages: "trang",

  // Outline
  outline_title: "Mục lục tổng quan",
  refresh_btn: "Tải lại",
  filter_placeholder: "Lọc mục lục...",

  // Settings
  settings_title: "Cấu hình Hệ thống & Bộ tài liệu",
  system_settings_tab: "Hệ thống chung",
  collection_settings_tab: "Bộ tài liệu hiện tại",
  general_tab: "Cơ bản",
  runtime_tab: "Tra cứu & VLM",
  processing_tab: "Xử lý PDF",
  fixed_tab: "Tham số cố định",
  reset_settings: "Khôi phục mặc định",
  save_settings: "Lưu cấu hình",

  // Settings Plain Language Parameters
  top_k_title: "Số trích dẫn tối đa",
  top_k_plain_desc: "Số đoạn trích dẫn tối đa dùng cho mỗi câu trả lời.",
  top_k_tooltip: "Giá trị cao giúp kết quả chi tiết hơn nhưng thời gian phản hồi lâu hơn.",

  toc_rewrite_title: "Chuẩn hoá câu hỏi",
  toc_rewrite_plain_desc: "Tự động chuẩn hoá từ ngữ câu hỏi theo thuật ngữ trong mục lục.",
  toc_rewrite_tooltip: "Hỗ trợ tìm chính xác bảng biểu và công thức kỹ thuật.",

  vlm_temp_title: "Nhiệt độ mô hình VLM",
  vlm_temp_plain_desc: "Mức độ chặt chẽ khi trích xuất thông số và công thức.",
  vlm_temp_tooltip: "Khuyên dùng mức 0 để đảm bảo số liệu chính xác tuyệt đối.",

  dpi_title: "Độ phân giải scan (DPI)",
  dpi_plain_desc: "Độ phân giải hình ảnh khi quét trang PDF.",
  dpi_tooltip: "DPI cao giúp đọc rõ công thức và chữ nhỏ nhưng tốn tài nguyên hơn.",

  split_title: "Tách đôi trang scan",
  split_plain_desc: "Tự động chia đôi đối với tài liệu scan 2 trang trên một tờ.",
  split_tooltip: "Áp dụng cho tài liệu scan dạng trang đôi.",

  padding_title: "Lề bù cắt lát (Padding)",
  padding_plain_desc: "Khoảng lề biên bổ sung xung quanh mục trích đoạn.",
  padding_tooltip: "Giúp giữ trọn vẹn chân bảng và công thức sát mép.",

  // User & Auth
  account: "Tài khoản",
  guest_user: "Khách tham quan",
  engineer_user: "Kỹ sư Kết cấu",
  sign_in: "Đăng nhập",
  sign_out: "Đăng xuất",
  switch_account: "Chuyển tài khoản",
  language_switch: "Ngôn ngữ / Language",
  language_name: "Tiếng Việt",
};
