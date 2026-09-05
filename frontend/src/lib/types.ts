/** Kiểu dữ liệu khớp với schema của backend. */

export interface Formula {
  content: string;
  coordinate: number[];
  page: string | null;
}

export interface SearchResult {
  section_title: string;
  formulas: Formula[];
  /** Số trang in trên giấy, ví dụ "-93-". Không phải index. */
  section_pages: string[];
  /** Chuỗi mục cha, giữ ngữ cảnh phân cấp. */
  ancestors: string[];
  metadata: Record<string, unknown>;
  image_path: string;
  image_base64: string | null;
  /** Ảnh từng trang gốc của mục, để đối chiếu với ảnh ghép. */
  chunk_images: string[];
}

export interface SearchResponse {
  user_id: string;
  query: string;
  top_k: number;
  results: SearchResult[];
  total_results: number;
}

export interface TocSection {
  title: string;
  index?: number;
  page_range?: string;
  formulas?: number;
  ancestors?: number[];
  ancestor_titles?: string[];
}

export interface TocBook {
  book_index: number;
  book_folder: string;
  title: string | null;
  total_pages: number;
  total_sections: number;
  sections?: TocSection[];
  page_numbers?: Record<string, string>;
}

export interface TableOfContents {
  collection_name: string;
  total_books: number;
  books: TocBook[];
}

export interface UploadFileMeta {
  display_name: string;
  original_name?: string;
  vertical_split: boolean;
  max_pages?: number | null;
}

export interface UploadResponse {
  success: boolean;
  message: string;
  processed_files: number;
  total_pages: number;
  file_pages: Record<string, number>;
  errors: string[];
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}

/** Một lượt hỏi đáp trong phiên chat. */
export interface ChatTurn {
  id: string;
  question: string;
  answer: string | null;
  sources: SearchResult[];
  status: "pending" | "done" | "error";
  error?: string;
  /** Câu hỏi sau khi viết lại theo mục lục, nếu có. */
  rewrittenQuery?: string;
}

export interface AskResponse {
  query: string;
  answer: string;
  /** Câu hỏi sau khi neo vào mục lục; null nếu không viết lại được. */
  rewritten_query: string | null;
  sources: SearchResult[];
  total_sources: number;
}
