/** Client gọi backend. Đường dẫn đi qua /api để nginx và vite cùng proxy được. */

import type {
  AskResponse,
  HealthResponse,
  SearchResponse,
  SettingsResponse,
  TableOfContents,
  UploadFileMeta,
  UploadResponse,
} from "./types";

const BASE = "/api";

/** Một lượt search gồm embed + rerank + VLM đọc ảnh, có thể mất vài phút. */
const SEARCH_TIMEOUT_MS = 1_000_000;
const UPLOAD_TIMEOUT_MS = 3_600_000;
const QUICK_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
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
      throw new ApiError(
        body ? `${response.status}: ${body.slice(0, 300)}` : `HTTP ${response.status}`,
        response.status,
      );
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

export const api = {
  health(): Promise<HealthResponse> {
    return request<HealthResponse>("/health");
  },

  settings(): Promise<SettingsResponse> {
    return request<SettingsResponse>("/settings");
  },

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
  }): Promise<AskResponse> {
    return postJson<AskResponse>(
      "/ask",
      {
        query: params.query,
        user_id: params.collection,
        top_k: params.topK ?? 5,
        use_toc_rewrite: params.useTocRewrite ?? true,
        system_prompt: params.systemPrompt ?? "",
        include_base64: true,
        toc_preview_limit: params.tocPreviewLimit,
        vlm_temperature: params.vlmTemperature,
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
