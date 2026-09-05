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


export interface AskResponse {
  query: string;
  answer: string;
  /** Câu hỏi sau khi neo vào mục lục; null nếu không viết lại được. */
  rewritten_query: string | null;
  sources: SearchResult[];
  total_sources: number;
}

/** Một lượt hỏi đáp trong phiên tra cứu. */
export interface AskTurn {
  id: string;
  question: string;
  answer: string;
  sources: SearchResult[];
  status: "pending" | "done" | "error";
  error?: string;
  /** Câu hỏi sau khi neo vào mục lục, nếu có. */
  rewrittenQuery?: string;
}

/* ---- Cấu hình hệ thống (GET /settings) ---- */

export interface RuntimeSettings {
  top_k_default: number;
  top_k_min: number;
  top_k_max: number;
  use_toc_rewrite_default: boolean;
  toc_preview_limit: number;
}

export interface PdfToImageSettings {
  dpi: number;
  min_dpi: number;
  anchor_size: number;
  thread_count: number;
  vertical_split: boolean;
}

export interface PreprocessSettings {
  cut_params: number[];
  padding: number;
  batch_size: number;
  text_model: string;
  use_cut_padding: boolean;
  pdf_to_image: PdfToImageSettings;
}

export interface ChunkingSettings {
  cut_padding: number;
  remove_page_number: boolean;
  keep_chunk_pages: boolean;
  min_section_height_px: number;
}

export interface DocumentSettings {
  worker_endpoint: string;
  preprocess: PreprocessSettings;
  layout: { model_name: string; batch_size: number };
  ocr: {
    number_batch_size: number;
    title_batch_size: number;
    formula_batch_size: number;
    lazy_load: boolean;
  };
  chunking: ChunkingSettings;
  toc_validator: {
    type: string;
    model_name: string;
    endpoint: string;
    temperature: number;
    api_key_configured: boolean;
  };
}

export interface IndexingSettings {
  embedding: {
    type: string;
    model_name: string;
    device: string;
    dim: number;
    max_num_visual_tokens: number;
    min_width: number | null;
    batching_mode: string;
    batch_size: number;
    max_token: number;
    prefix_num_tokens: number;
    doc_dim: number;
  };
  vectordb: {
    type: string;
    uri: string;
    grpc_port: number;
    database_name: string;
    collection_name: string;
    search_limit: number;
    upsert_batch_size: number;
  };
}

export interface ModelEndpoint {
  type: string;
  endpoint: string;
  model_name: string;
  api_key_configured: boolean;
}

export interface SettingsResponse {
  runtime: RuntimeSettings;
  document: DocumentSettings;
  indexing: IndexingSettings;
  models: { vlm: ModelEndpoint; llm: ModelEndpoint };
  data_dir: string;
  metadata_dir: string;
  log_level: string;
  editable_note: string;
}
