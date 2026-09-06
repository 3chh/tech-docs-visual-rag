/**
 * Sở thích hỏi đáp của từng người dùng.
 *
 * Cấu hình bộ tài liệu KHÔNG ở đây: nó nằm trên server
 * (`POST`/`PUT /collections`) vì backend cần nó để áp lúc index và cả team
 * phải thấy cùng một cấu hình. Xem `features/documents/collection-config.ts`.
 */

/**
 * Mọi trường đều tuỳ chọn, và mặc định là RỖNG.
 *
 * Bỏ trống nghĩa là "dùng mặc định của bộ tài liệu". Điền sẵn `topK: 5` ở đây
 * là vô hiệu hoá cấu hình bộ, vì server không phân biệt được với việc người
 * dùng chủ động chọn 5.
 */
export interface AskPreferences {
  topK?: number;
  useTocRewrite?: boolean;
  tocPreviewLimit?: number;
  vlmTemperature?: number;
  systemPrompt?: string;
}

export interface StoredSettings {
  ask: AskPreferences;
}

export const DEFAULT_SETTINGS: StoredSettings = { ask: {} };

const STORAGE_KEY = "cosmo.settings";

/** Lưu vào localStorage vì đây là sở thích của từng người, không phải state server. */
export function loadSettings(): StoredSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    return { ask: parsed.ask ?? {} };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: StoredSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Chế độ riêng tư chặn localStorage; bỏ qua, cấu hình chỉ mất khi tải lại.
  }
}

/** Bỏ khoá rỗng để chỉ gửi cái người dùng đổi thật. */
export function pruneEmpty<T extends object>(obj: T): Partial<T> | undefined {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      const nested = pruneEmpty(value as object);
      if (nested && Object.keys(nested).length > 0) out[key] = nested;
      continue;
    }
    out[key] = value;
  }

  return Object.keys(out).length > 0 ? (out as Partial<T>) : undefined;
}
