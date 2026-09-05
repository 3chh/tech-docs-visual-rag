/**
 * Tham số người dùng override được.
 *
 * Khoảng min/max phải khớp với `backend/app/schemas/overrides.py`.
 * Test `backend/tests/test_overrides.py` khoá các khoảng đó lại, nên khi
 * backend đổi mà đây chưa đổi thì test sẽ đỏ.
 */

export interface PdfToImageOverrides {
  dpi?: number;
  min_dpi?: number;
  anchor_size?: number;
  thread_count?: number;
  vertical_split?: boolean;
}

export interface PreprocessOverrides {
  padding?: number;
  use_cut_padding?: boolean;
  batch_size?: number;
  cut_params?: number[];
  pdf_to_image?: PdfToImageOverrides;
}

export interface OcrOverrides {
  title_batch_size?: number;
  number_batch_size?: number;
  formula_batch_size?: number;
}

export interface ChunkingOverrides {
  cut_padding?: number;
  min_section_height_px?: number;
}

export interface TocValidatorOverrides {
  model_name?: string;
  temperature?: number;
}

/** Gửi kèm mỗi file lúc upload. */
export interface ProcessingOverrides {
  preprocess?: PreprocessOverrides;
  layout?: { batch_size?: number };
  ocr?: OcrOverrides;
  chunking?: ChunkingOverrides;
  toc_validator?: TocValidatorOverrides;
}

/** Gửi kèm mỗi câu hỏi. */
export interface AskOverrides {
  topK: number;
  useTocRewrite: boolean;
  tocPreviewLimit?: number;
  vlmTemperature?: number;
  systemPrompt?: string;
}

/** Ràng buộc số, khớp với Field(ge=..., le=...) ở backend. */
export const LIMITS = {
  dpi: { min: 72, max: 1200 },
  min_dpi: { min: 20, max: 600 },
  anchor_size: { min: 100_000, max: 5_000_000 },
  thread_count: { min: 1, max: 1024 },
  padding: { min: 0, max: 200 },
  preprocess_batch_size: { min: 1, max: 128 },
  cut_params: { min: 0, max: 1000 },
  layout_batch_size: { min: 1, max: 256 },
  ocr_batch_size: { min: 1, max: 128 },
  chunk_cut_padding: { min: 0, max: 300 },
  min_section_height: { min: 0, max: 2000 },
  temperature: { min: 0, max: 2, step: 0.1 },
  top_k: { min: 1, max: 20 },
  toc_preview_limit: { min: 1, max: 100 },
} as const;

const STORAGE_KEY = "cosmo.settings.v1";

export interface StoredSettings {
  ask: AskOverrides;
  processing: ProcessingOverrides;
}

export const DEFAULT_SETTINGS: StoredSettings = {
  ask: { topK: 5, useTocRewrite: true },
  processing: {},
};

/** Lưu vào localStorage vì đây là sở thích của từng người, không phải state server. */
export function loadSettings(): StoredSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    return {
      ask: { ...DEFAULT_SETTINGS.ask, ...parsed.ask },
      processing: parsed.processing ?? {},
    };
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

export interface CollectionConfig {
  preprocess: {
    dpi: number;
    min_dpi: number;
    vertical_split: boolean;
    anchor_size: number;
    thread_count: number;
    padding: number;
    use_cut_padding: boolean;
    text_model?: string;
  };
  chunking: {
    cut_padding: number;
    min_section_height_px: number;
    remove_page_number: boolean;
    keep_chunk_pages: boolean;
  };
  ocr: {
    formula_batch_size: number;
    title_batch_size: number;
    number_batch_size: number;
    lazy_load: boolean;
  };
  toc: {
    use_toc_rewrite: boolean;
    model_name: string;
    temperature: number;
    preview_limit: number;
  };
  retrieval: {
    top_k: number;
  };
}

export const DEFAULT_COLLECTION_CONFIG: CollectionConfig = {
  preprocess: {
    dpi: 200,
    min_dpi: 150,
    vertical_split: false,
    anchor_size: 2_000_000,
    thread_count: 4,
    padding: 10,
    use_cut_padding: true,
    text_model: "doc-layout-v1",
  },
  chunking: {
    cut_padding: 8,
    min_section_height_px: 40,
    remove_page_number: true,
    keep_chunk_pages: false,
  },
  ocr: {
    formula_batch_size: 8,
    title_batch_size: 16,
    number_batch_size: 16,
    lazy_load: true,
  },
  toc: {
    use_toc_rewrite: true,
    model_name: "gpt-4o-mini",
    temperature: 0.2,
    preview_limit: 10,
  },
  retrieval: {
    top_k: 5,
  },
};

export function loadCollectionConfig(collection: string): CollectionConfig {
  try {
    const raw = localStorage.getItem(`cosmo.collection.${collection}`);
    if (!raw) return DEFAULT_COLLECTION_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      preprocess: { ...DEFAULT_COLLECTION_CONFIG.preprocess, ...(parsed.preprocess ?? {}) },
      chunking: { ...DEFAULT_COLLECTION_CONFIG.chunking, ...(parsed.chunking ?? {}) },
      ocr: { ...DEFAULT_COLLECTION_CONFIG.ocr, ...(parsed.ocr ?? {}) },
      toc: { ...DEFAULT_COLLECTION_CONFIG.toc, ...(parsed.toc ?? {}) },
      retrieval: { ...DEFAULT_COLLECTION_CONFIG.retrieval, ...(parsed.retrieval ?? {}) },
    };
  } catch {
    return DEFAULT_COLLECTION_CONFIG;
  }
}

export function saveCollectionConfig(collection: string, config: CollectionConfig): void {
  try {
    localStorage.setItem(`cosmo.collection.${collection}`, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export function configToProcessingOverrides(c: CollectionConfig): ProcessingOverrides {
  return {
    preprocess: {
      padding: c.preprocess.padding,
      use_cut_padding: c.preprocess.use_cut_padding,
      pdf_to_image: {
        dpi: c.preprocess.dpi,
        min_dpi: c.preprocess.min_dpi,
        vertical_split: c.preprocess.vertical_split,
        anchor_size: c.preprocess.anchor_size,
        thread_count: c.preprocess.thread_count,
      },
    },
    chunking: {
      cut_padding: c.chunking.cut_padding,
      min_section_height_px: c.chunking.min_section_height_px,
    },
    ocr: {
      formula_batch_size: c.ocr.formula_batch_size,
      title_batch_size: c.ocr.title_batch_size,
      number_batch_size: c.ocr.number_batch_size,
    },
    toc_validator: {
      model_name: c.toc.model_name,
      temperature: c.toc.temperature,
    },
  };
}

