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
  /** Override tham số xử lý, khớp ProcessingOverrides ở backend. */
  [key: string]: unknown;
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
  /** Model nào đã trả lời, để người dùng biết câu trả lời đến từ đâu. */
  provider?: string | null;
  model_name?: string | null;
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
  models: {
    vlm: ModelEndpoint;
    llm: ModelEndpoint;
  };
  data_dir: string;
  metadata_dir: string;
  log_level: string;
  editable_note: string;
}

/** Khả năng của một kết nối mô hình. */
export type Capability = "vlm" | "llm";

export type ProviderKind = "openai" | "gemini" | "vllm" | "custom";

/** Một kết nối mô hình. KHÔNG bao giờ chứa api_key gốc. */
export interface ModelConnection {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  model_name: string;
  capabilities: string[];
  /** Bản che, ví dụ `sk-proj-••••4f2a`. Không bao giờ là key gốc. */
  masked_key: string | null;
  has_key: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConnectionListResponse {
  connections: ModelConnection[];
  /** Key trên đĩa có được mã hoá không. */
  encryption_enabled: boolean;
  /** Endpoint gợi ý theo nhà cung cấp, để điền sẵn form. */
  default_endpoints: Record<string, string>;
  /** Nhà cung cấp không cần API key (vLLM tự host). */
  providers_without_key: string[];
}

export interface CreateConnectionInput {
  name: string;
  provider: ProviderKind;
  model_name: string;
  capabilities: Capability[];
  api_key?: string;
  endpoint?: string;
}

/** Bỏ trống api_key để giữ key hiện tại. */
export type UpdateConnectionInput = Partial<
  Omit<CreateConnectionInput, "provider">
>;

/**
 * Tham số xử lý riêng của một bộ tài liệu.
 *
 * Trường bỏ trống nghĩa là "dùng mặc định của server". KHÔNG điền giá trị mặc
 * định ở client: làm vậy là ghi đè cấu hình đã lưu của bộ.
 */
export interface CollectionProcessing {
  max_pages?: number;
  vertical_split?: boolean;
  preprocess?: {
    padding?: number;
    use_cut_padding?: boolean;
    batch_size?: number;
    cut_params?: number[];
    pdf_to_image?: {
      dpi?: number;
      min_dpi?: number;
      anchor_size?: number;
      thread_count?: number;
    };
  };
  layout?: { batch_size?: number };
  ocr?: {
    title_batch_size?: number;
    number_batch_size?: number;
    formula_batch_size?: number;
  };
  chunking?: { cut_padding?: number; min_section_height_px?: number };
  toc_validator?: { model_name?: string; temperature?: number };
}

/** Mặc định hỏi đáp của một bộ tài liệu. */
export interface CollectionAsk {
  top_k?: number;
  use_toc_rewrite?: boolean;
  toc_preview_limit?: number;
  system_prompt?: string;
  vlm_temperature?: number;
}

/**
 * Tham số embedding của một bộ tài liệu.
 *
 * Khác `CollectionProcessing`/`CollectionAsk`: server lưu ĐẦY ĐỦ (không thưa)
 * và **đóng băng** sau khi tạo bộ. Vector chỉ so được với vector cùng tham số,
 * nên đổi là phải index lại cả bộ.
 *
 * Lúc gửi lên để tạo bộ thì vẫn thưa: bỏ trống nghĩa là lấy của server.
 */
export interface CollectionEmbedding {
  type?: string;
  model_name?: string;
  max_num_visual_tokens?: number;
  min_width?: number;
}

export interface CollectionOut {
  name: string;
  description: string;
  vlm_connection_id: string;
  llm_connection_id: string;
  created_at: string;
  updated_at: string;
  processing: CollectionProcessing;
  ask: CollectionAsk;
  /** Đã chốt lúc tạo bộ, không sửa được. */
  embedding: CollectionEmbedding;
  /** Cả hai kết nối còn dùng được không. False thì phải chọn lại mô hình. */
  is_ready: boolean;
  blocked_reason: string | null;
}

export interface CollectionListResponse {
  collections: CollectionOut[];
  /** Đã có mô hình để tạo bộ chưa. False thì phải sang Cấu hình chung trước. */
  can_create: boolean;
  /** Loại mô hình còn thiếu, để nói rõ cần thêm cái gì. */
  missing_capabilities: string[];
}

export interface CreateCollectionInput {
  name: string;
  vlm_connection_id: string;
  llm_connection_id: string;
  description?: string;
  processing?: CollectionProcessing;
  ask?: CollectionAsk;
  /** Chỉ gửi khi TẠO bộ. Sửa sau đó server trả 409 embedding_immutable. */
  embedding?: CollectionEmbedding;
}

/** Không có `embedding`: nó đóng băng sau khi tạo. */
export type UpdateCollectionInput = Partial<
  Omit<CreateCollectionInput, "name" | "embedding">
>;
