import type { TranslationDictionary } from "../types";

export const vi: TranslationDictionary = {
  app_name: "Cosmo ChatPDF",
  app_tagline: "Không gian làm việc Visual RAG",

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
  sources_title: "Nguồn trích dẫn",
  formulas_found: "công thức toán",
  rewritten_note: "Thuật ngữ chuẩn hoá theo mục lục:",
  empty_chat_title: "Hỏi đáp & Đối soát trực quan",
  empty_chat_desc: "Hệ thống trích xuất trực tiếp ảnh chụp trang gốc, bảng biểu số liệu và công thức toán học với trích dẫn trang đối soát.",

  // Document Canvas
  canvas_title: "Document Canvas",
  toc_button: "Mục lục",
  search_toc_placeholder: "Lọc mục lục...",
  no_toc: "Chưa có cấu trúc mục lục cho bộ tài liệu này.",
  no_source_selected: "Chưa chọn tài liệu hoặc trích dẫn",
  no_source_desc: "Nhấp vào trích dẫn trong câu trả lời hoặc chọn mục trong Cây mục lục để đối soát trực quan.",
  zoom_in: "Phóng to",
  zoom_out: "Thu nhỏ",
  reset_zoom: "Kích thước chuẩn (100%)",
  copy_formula: "Sao chép công thức",
  formula_copied: "Đã sao chép vào bộ nhớ tạm!",
  view_mode_pdf: "Xem PDF gốc",
  view_mode_slice: "Ảnh cắt lát Visual RAG",
  page_counter: "Trang",
  prev_page: "Trang trước",
  next_page: "Trang kế",
  open_canvas_btn: "Mở Canvas",

  // Documents Library
  documents_title: "Quản lý Tài liệu",
  drag_drop_pdf: "Kéo thả file PDF vào đây hoặc chọn từ máy tính",
  browse_files: "Chọn tệp PDF",
  processing_btn: "Bắt đầu xử lý & Chỉ mục",
  in_collection: "Danh sách tài liệu đã chỉ mục",
  open_in_canvas: "Xem trong Canvas",
  total_sections: "mục",
  total_pages: "trang",

  // Outline
  outline_title: "Cây Mục lục Tổng quan",
  refresh_btn: "Tải lại",
  filter_placeholder: "Tìm kiếm mục...",

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
  top_k_title: "Số mục tham chiếu tối đa",
  top_k_plain_desc: "Số đoạn trang tài liệu liên quan nhất được chọn để gửi cho AI trả lời.",
  top_k_tooltip: "Tăng giá trị giúp câu trả lời đầy đủ hơn nhưng tốn thời gian xử lý ảnh hơn.",

  toc_rewrite_title: "Chuẩn hoá câu hỏi theo thuật ngữ",
  toc_rewrite_plain_desc: "Tự động đổi câu hỏi người dùng khớp với thuật ngữ chuyên môn trong mục lục tài liệu.",
  toc_rewrite_tooltip: "Giúp tìm chính xác các bảng biểu và công thức ngay cả khi bạn đặt câu hỏi nôm na.",

  vlm_temp_title: "Độ sáng tạo của mô hình đọc ảnh (Temperature)",
  vlm_temp_plain_desc: "Mức độ tự do suy luận khi AI đọc ảnh bản vẽ và công thức.",
  vlm_temp_tooltip: "Khuyên dùng mức 0 đối với tài liệu kỹ thuật để đảm bảo số liệu chính xác tuyệt đối.",

  dpi_title: "Độ sắc nét khi quét trang PDF (DPI)",
  dpi_plain_desc: "Độ phân giải chuyển đổi từ tệp PDF sang ảnh để nhận dạng quang học.",
  dpi_tooltip: "DPI cao (ví dụ 300) giúp đọc rõ chữ nhỏ và công thức phức tạp nhưng tốn dung lượng hơn.",

  split_title: "Tự động tách đôi trang sách quét",
  split_plain_desc: "Nhận diện sách quét hai trang liền nhau (A3 sang 2 trang A4) và tách đôi theo chiều dọc.",
  split_tooltip: "Rất hữu ích khi số hoá tài liệu tiêu chuẩn hoặc giáo trình dạng trang đôi.",

  padding_title: "Khoảng bù lề cắt lát (Padding)",
  padding_plain_desc: "Khoảng lề biên bổ sung xung quanh mục để tránh cắt phạm vào công thức hoặc chân bảng.",
  padding_tooltip: "Đơn vị tính bằng pixel. Giá trị từ 20-60px giúp giữ nguyên vẹn ngữ cảnh xung quanh.",

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
