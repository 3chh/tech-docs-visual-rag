/** Client gọi backend. Đường dẫn đi qua /api để nginx và vite cùng proxy được. */

import type {
  AskResponse,
  CollectionListResponse,
  CollectionOut,
  ConnectionListResponse,
  CreateCollectionInput,
  CreateConnectionInput,
  HealthResponse,
  SearchResponse,
  SettingsResponse,
  TableOfContents,
  UpdateCollectionInput,
  UpdateConnectionInput,
  UploadFileMeta,
  UploadResponse,
} from "./types";

const BASE = "/api";

/** Một lượt search gồm embed + rerank + VLM đọc ảnh, có thể mất vài phút. */
const SEARCH_TIMEOUT_MS = 1_000_000;
const UPLOAD_TIMEOUT_MS = 3_600_000;
const QUICK_TIMEOUT_MS = 15_000;

/** Mã lỗi backend mà UI cần phân biệt để xử lý khác nhau. */
export const ERR_NO_MODELS = "no_models_configured";
export const ERR_COLLECTION_NOT_CONFIGURED = "collection_not_configured";
export const ERR_CONNECTION_INVALID = "connection_invalid";

/**
 * Backend trả lỗi dạng `{detail: {code, message}}`. `code` là hợp đồng ổn
 * định để UI rẽ nhánh: `no_models_configured` thì mở popup dẫn sang Cấu hình
 * chung, còn `connection_invalid` thì báo ngay tại field. Chuỗi `message`
 * đổi được mà không làm hỏng client.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function parseError(status: number, body: string): ApiError {
  try {
    const detail = (JSON.parse(body) as { detail?: unknown }).detail;

    if (typeof detail === "string") return new ApiError(detail, status);

    if (detail && typeof detail === "object") {
      const { code, message, ...extra } = detail as {
        code?: string;
        message?: string;
      };
      return new ApiError(message ?? `HTTP ${status}`, status, code, extra);
    }
  } catch {
    // Không phải JSON (ví dụ lỗi từ nginx): dùng nguyên văn bên dưới.
  }

  return new ApiError(
    body ? `${status}: ${body.slice(0, 300)}` : `HTTP ${status}`,
    status,
  );
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = QUICK_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw parseError(response.status, body);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Backend quá thời gian chờ");
    }
    throw new ApiError("Không kết nối được backend");
  } finally {
    clearTimeout(timer);
  }
}

function postJson<T>(path: string, body: unknown, timeoutMs?: number): Promise<T> {
  return request<T>(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
}

function sendJson<T>(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<T> {
  return request<T>(path, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const api = {
  health(): Promise<HealthResponse> {
    return request<HealthResponse>("/health");
  },

  /** Thông tin hệ thống, chỉ đọc — đổi những giá trị này phải deploy lại. */
  settings(): Promise<SettingsResponse> {
    return request<SettingsResponse>("/settings");
  },

  // --- Cấu hình chung: kết nối mô hình -----------------------------------
  // Key chỉ đi một chiều lên server; đọc lên chỉ được bản che.

  connections(): Promise<ConnectionListResponse> {
    return request<ConnectionListResponse>("/connections");
  },

  createConnection(input: CreateConnectionInput): Promise<ConnectionListResponse> {
    return sendJson<ConnectionListResponse>("/connections", "POST", input);
  },

  /** Bỏ trống api_key để giữ key hiện tại. */
  updateConnection(
    id: string,
    input: UpdateConnectionInput,
  ): Promise<ConnectionListResponse> {
    return sendJson<ConnectionListResponse>(`/connections/${id}`, "PUT", input);
  },

  deleteConnection(id: string): Promise<ConnectionListResponse> {
    return sendJson<ConnectionListResponse>(`/connections/${id}`, "DELETE");
  },

  // --- Cấu hình bộ tài liệu ----------------------------------------------

  /** Bộ đã cấu hình, kèm can_create và loại mô hình còn thiếu. */
  configuredCollections(): Promise<CollectionListResponse> {
    return request<CollectionListResponse>("/collections");
  },

  collection(name: string): Promise<CollectionOut | null> {
    return request<CollectionOut>(
      `/collections/${encodeURIComponent(name)}`,
    ).catch((error: unknown) => {
      // 404 nghĩa là bộ chưa được cấu hình, không phải lỗi hệ thống.
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    });
  },

  createCollection(input: CreateCollectionInput): Promise<CollectionOut> {
    return sendJson<CollectionOut>("/collections", "POST", input);
  },

  updateCollection(
    name: string,
    input: UpdateCollectionInput,
  ): Promise<CollectionOut> {
    return sendJson<CollectionOut>(
      `/collections/${encodeURIComponent(name)}`,
      "PUT",
      input,
    );
  },

  deleteCollection(name: string): Promise<{ status: string; note: string }> {
    return sendJson<{ status: string; note: string }>(
      `/collections/${encodeURIComponent(name)}`,
      "DELETE",
    );
  },

  /** Tên các collection đã có dữ liệu trong vector DB. */
  listCollections(userId: string): Promise<string[]> {
    return request<{ collections: string[] }>(
      `/list_collections/${encodeURIComponent(userId)}`,
    ).then((r) => r.collections);
  },

  /**
   * Hỏi đáp: backend truy xuất rồi để VLM đọc ảnh và soạn câu trả lời.
   * VLM chạy phía backend nên API key không đi ra trình duyệt.
   */
  ask(params: {
    query: string;
    collection: string;
    topK?: number;
    useTocRewrite?: boolean;
    systemPrompt?: string;
    tocPreviewLimit?: number;
    vlmTemperature?: number;
    /** Thử model khác cho riêng lượt này, không sửa cấu hình bộ. */
    connectionId?: string;
  }): Promise<AskResponse> {
    // Để undefined chứ KHÔNG điền mặc định ở đây: undefined nghĩa là "dùng
    // mặc định của bộ tài liệu". Điền sẵn 5 hay true là vô hiệu hoá cấu hình
    // bộ, vì server không phân biệt được với việc người dùng chọn đúng số đó.
    return postJson<AskResponse>(
      "/ask",
      {
        query: params.query,
        user_id: params.collection,
        top_k: params.topK,
        use_toc_rewrite: params.useTocRewrite,
        system_prompt: params.systemPrompt,
        include_base64: true,
        toc_preview_limit: params.tocPreviewLimit,
        vlm_temperature: params.vlmTemperature,
        connection_id: params.connectionId,
      },
      SEARCH_TIMEOUT_MS,
    );
  },

  /** Chỉ truy xuất, không sinh câu trả lời. Nhanh hơn /ask. */
  search(params: {
    query: string;
    collection: string;
    topK?: number;
  }): Promise<SearchResponse> {
    return postJson<SearchResponse>(
      "/search_with_images",
      {
        query: params.query,
        user_id: params.collection,
        top_k: params.topK ?? 5,
        include_base64: true,
      },
      SEARCH_TIMEOUT_MS,
    );
  },

  /** Lọc theo tên mục. Dùng với "noname" để lấy bìa và mục lục. */
  searchBySectionTitle(params: {
    sectionTitle: string;
    collection: string;
    limit?: number;
    includeBase64?: boolean;
  }): Promise<SearchResponse> {
    return postJson<SearchResponse>(
      "/search_by_section_title",
      {
        section_title: params.sectionTitle,
        user_id: params.collection,
        limit: params.limit ?? 20,
        include_base64: params.includeBase64 ?? false,
      },
      SEARCH_TIMEOUT_MS,
    );
  },

  tableOfContents(collection: string): Promise<TableOfContents | null> {
    return request<TableOfContents>(
      `/table_of_contents?collection_name=${encodeURIComponent(collection)}`,
    ).catch((error: unknown) => {
      // 404 nghĩa là chưa index gì, không phải lỗi.
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    });
  },

  regenerateToc(collection: string): Promise<TableOfContents> {
    return postJson<TableOfContents>(
      `/table_of_contents/regenerate?collection_name=${encodeURIComponent(collection)}`,
      undefined,
    );
  },

  async uploadFiles(params: {
    files: File[];
    collection: string;
    metadata: UploadFileMeta[];
  }): Promise<UploadResponse> {
    const form = new FormData();
    for (const file of params.files) form.append("files", file);
    form.append("user_id", params.collection);
    form.append("db_name", params.collection);
    form.append("metadata", JSON.stringify(params.metadata));

    return request<UploadResponse>(
      "/upload_files",
      { method: "POST", body: form },
      UPLOAD_TIMEOUT_MS,
    );
  },
};
