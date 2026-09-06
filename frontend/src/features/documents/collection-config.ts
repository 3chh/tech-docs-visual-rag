/**
 * Cấu hình của một bộ tài liệu, dạng **thưa**.
 *
 * Nguyên tắc quan trọng nhất ở đây: chỉ gửi lên server những trường người
 * dùng thực sự đổi. Điền sẵn mặc định rồi gửi hết là ghi đè mặc định của
 * server bằng phỏng đoán của client — đúng lỗi đã xảy ra ba lần trong repo
 * này (`vertical_split=False`, `top_k=5`, `toc.model_name="gpt-4o-mini"`).
 *
 * Giá trị mặc định chỉ dùng làm placeholder, lấy từ `GET /settings` để đúng
 * với cấu hình server thật thay vì hằng số chép tay.
 */

import type {
  CollectionAsk,
  CollectionProcessing,
  SettingsResponse,
} from "@/lib/types";

export interface CollectionDraft {
  processing: CollectionProcessing;
  ask: CollectionAsk;
}

export const EMPTY_DRAFT: CollectionDraft = { processing: {}, ask: {} };

/**
 * Đặt giá trị theo đường dẫn, trả về object mới.
 *
 * `undefined` thì XOÁ khoá đó và dọn luôn object cha nếu rỗng — nhờ vậy draft
 * luôn thưa và "chưa đổi" không bao giờ biến thành `null` gửi lên server.
 */
export function setPath<T extends Record<string, unknown>>(
  obj: T,
  path: readonly string[],
  value: unknown,
): T {
  const [head, ...rest] = path;
  const next: Record<string, unknown> = { ...obj };

  if (rest.length === 0) {
    if (value === undefined || value === "") delete next[head];
    else next[head] = value;
    return next as T;
  }

  const child = setPath(
    (next[head] as Record<string, unknown>) ?? {},
    rest,
    value,
  );

  if (Object.keys(child).length === 0) delete next[head];
  else next[head] = child;

  return next as T;
}

/**
 * Đặt một trường của draft.
 *
 * Bọc `setPath` để hai gốc `processing` và `ask` luôn tồn tại: pruning của
 * `setPath` sẽ xoá cả gốc khi nhánh rỗng, mà `CollectionDraft` cần chúng là
 * object để `getPath` và form đọc được.
 */
export function setDraftValue(
  draft: CollectionDraft,
  path: readonly string[],
  value: unknown,
): CollectionDraft {
  const next = setPath(
    draft as unknown as Record<string, unknown>,
    path,
    value,
  ) as Partial<CollectionDraft>;

  return { processing: next.processing ?? {}, ask: next.ask ?? {} };
}

export function getPath(obj: object, path: readonly string[]): unknown {
  return path.reduce<unknown>(
    (acc, key) =>
      acc && typeof acc === "object"
        ? (acc as Record<string, unknown>)[key]
        : undefined,
    obj,
  );
}

type Base = {
  /** `processing.*` hoặc `ask.*` — đường dẫn trong CollectionDraft. */
  path: readonly string[];
  label: string;
  tooltip?: string;
};

export type Field =
  | (Base & {
      kind: "number";
      unit?: string;
      min: number;
      max: number;
      step?: number;
      serverDefault: (s: SettingsResponse) => number;
    })
  | (Base & {
      kind: "bool";
      serverDefault: (s: SettingsResponse) => boolean;
    })
  | (Base & {
      kind: "text";
      placeholder?: string;
      serverDefault: (s: SettingsResponse) => string;
    });

export interface FieldGroup {
  title: string;
  hint?: string;
  fields: Field[];
}

// Min/max phải khớp ProcessingOverrides và AskOverrides ở backend, nếu không
// người dùng nhập được giá trị mà server trả 422.
export const COLLECTION_FIELD_GROUPS: FieldGroup[] = [
  {
    title: "Render PDF sang ảnh",
    hint: "Ảnh càng nét thì OCR càng đúng, nhưng chậm và tốn bộ nhớ hơn.",
    fields: [
      {
        kind: "number",
        path: ["processing", "preprocess", "pdf_to_image", "dpi"],
        label: "Độ phân giải (DPI)",
        tooltip: "Tài liệu scan mờ thì tăng lên; PDF số hoá sạch để nguyên.",
        unit: "DPI",
        min: 72,
        max: 1200,
        step: 10,
        serverDefault: (s) => s.document.preprocess.pdf_to_image.dpi,
      },
      {
        kind: "number",
        path: ["processing", "preprocess", "pdf_to_image", "min_dpi"],
        label: "DPI tối thiểu",
        tooltip: "Sàn khi DPI được tính động theo khổ sách.",
        unit: "DPI",
        min: 20,
        max: 600,
        step: 10,
        serverDefault: (s) => s.document.preprocess.pdf_to_image.min_dpi,
      },
      {
        kind: "number",
        path: ["processing", "preprocess", "pdf_to_image", "anchor_size"],
        label: "Số pixel neo",
        tooltip:
          "Dùng để chuẩn hoá số pixel giữa các khổ sách khác nhau: DPI thực = neo / (rộng × cao) × DPI.",
        min: 100_000,
        max: 5_000_000,
        step: 100_000,
        serverDefault: (s) => s.document.preprocess.pdf_to_image.anchor_size,
      },
      {
        kind: "number",
        path: ["processing", "preprocess", "pdf_to_image", "thread_count"],
        label: "Số luồng render",
        min: 1,
        max: 1024,
        serverDefault: (s) => s.document.preprocess.pdf_to_image.thread_count,
      },
      {
        kind: "bool",
        path: ["processing", "vertical_split"],
        label: "Tách đôi trang scan",
        tooltip: "Bật khi mỗi ảnh scan chứa hai trang sách nằm cạnh nhau.",
        serverDefault: (s) => s.document.preprocess.pdf_to_image.vertical_split,
      },
    ],
  },
  {
    title: "Cắt lề",
    fields: [
      {
        kind: "number",
        path: ["processing", "preprocess", "padding"],
        label: "Lề chừa lại",
        unit: "px",
        min: 0,
        max: 200,
        serverDefault: (s) => s.document.preprocess.padding,
      },
      {
        kind: "bool",
        path: ["processing", "preprocess", "use_cut_padding"],
        label: "Bật cắt lề",
        serverDefault: (s) => s.document.preprocess.use_cut_padding,
      },
      {
        kind: "number",
        path: ["processing", "preprocess", "batch_size"],
        label: "Batch cắt lề",
        min: 1,
        max: 128,
        serverDefault: (s) => s.document.preprocess.batch_size,
      },
    ],
  },
  {
    title: "Cắt tài liệu thành mục",
    hint: "Quyết định một điều khoản được cắt thành ảnh-mục như thế nào.",
    fields: [
      {
        kind: "number",
        path: ["processing", "chunking", "cut_padding"],
        label: "Lề bù quanh mục",
        tooltip: "Chừa thêm lề để chữ không sát mép ảnh cắt.",
        unit: "px",
        min: 0,
        max: 300,
        serverDefault: (s) => s.document.chunking.cut_padding,
      },
      {
        kind: "number",
        path: ["processing", "chunking", "min_section_height_px"],
        label: "Chiều cao mục tối thiểu",
        tooltip:
          "Mục thấp hơn ngưỡng này bị coi là tiêu đề lạc và gộp lùi vào mục trước.",
        unit: "px",
        min: 0,
        max: 2000,
        serverDefault: (s) => s.document.chunking.min_section_height_px,
      },
    ],
  },
  {
    title: "Nhận dạng chữ (OCR)",
    hint: "Chỉ ảnh hưởng tốc độ và bộ nhớ, không ảnh hưởng kết quả.",
    fields: [
      {
        kind: "number",
        path: ["processing", "layout", "batch_size"],
        label: "Batch layout",
        min: 1,
        max: 256,
        serverDefault: (s) => s.document.layout.batch_size,
      },
      {
        kind: "number",
        path: ["processing", "ocr", "title_batch_size"],
        label: "Batch tiêu đề",
        min: 1,
        max: 128,
        serverDefault: (s) => s.document.ocr.title_batch_size,
      },
      {
        kind: "number",
        path: ["processing", "ocr", "number_batch_size"],
        label: "Batch số trang",
        min: 1,
        max: 128,
        serverDefault: (s) => s.document.ocr.number_batch_size,
      },
      {
        kind: "number",
        path: ["processing", "ocr", "formula_batch_size"],
        label: "Batch công thức",
        min: 1,
        max: 128,
        serverDefault: (s) => s.document.ocr.formula_batch_size,
      },
    ],
  },
  {
    title: "Sửa cây mục lục",
    hint: "LLM đọc lại cây mục lục sau khi phân tích và sửa chỗ sai thứ bậc.",
    fields: [
      {
        kind: "text",
        path: ["processing", "toc_validator", "model_name"],
        label: "Model",
        tooltip:
          "Để trống thì dùng model của kết nối LLM đã chọn. Điền tên khác nếu muốn dùng model rẻ hơn cho việc này.",
        serverDefault: (s) => s.document.toc_validator.model_name,
      },
      {
        kind: "number",
        path: ["processing", "toc_validator", "temperature"],
        label: "Temperature",
        min: 0,
        max: 2,
        step: 0.1,
        serverDefault: (s) => s.document.toc_validator.temperature,
      },
    ],
  },
  {
    title: "Hỏi đáp",
    hint: "Mặc định khi tra cứu trong bộ này. Mỗi lượt hỏi vẫn đổi được riêng.",
    fields: [
      {
        kind: "number",
        path: ["ask", "top_k"],
        label: "Số mục lấy ra",
        tooltip: "Nhiều mục thì bao phủ rộng hơn nhưng câu trả lời loãng hơn.",
        min: 1,
        max: 20,
        serverDefault: (s) => s.runtime.top_k_default,
      },
      {
        kind: "bool",
        path: ["ask", "use_toc_rewrite"],
        label: "Neo câu hỏi vào mục lục",
        tooltip:
          "Viết lại câu hỏi theo đúng cách gọi trong mục lục trước khi truy xuất.",
        serverDefault: (s) => s.runtime.use_toc_rewrite_default,
      },
      {
        kind: "number",
        path: ["ask", "toc_preview_limit"],
        label: "Số ảnh mục lục cho VLM xem",
        min: 1,
        max: 100,
        serverDefault: (s) => s.runtime.toc_preview_limit,
      },
      {
        kind: "number",
        path: ["ask", "vlm_temperature"],
        label: "Temperature khi trả lời",
        min: 0,
        max: 2,
        step: 0.1,
        serverDefault: () => 0,
      },
    ],
  },
];

/** Số trường người dùng đã đổi, để hiện lên nút "Tuỳ chỉnh". */
export function countOverrides(draft: CollectionDraft): number {
  return COLLECTION_FIELD_GROUPS.flatMap((g) => g.fields).filter(
    (f) => getPath(draft, f.path) !== undefined,
  ).length;
}

/** Chuyển tên hiển thị thành mã định danh mà backend chấp nhận. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}
