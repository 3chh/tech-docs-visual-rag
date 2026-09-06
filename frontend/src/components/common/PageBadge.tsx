import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

/**
 * Chuẩn hoá số trang (ví dụ "-93-", "- 93 -", "93", "93-95")
 * thành định dạng người dùng trực quan như "Trang 93" hoặc "Page 93".
 */
export function formatPageLabel(
  page: string | number | undefined | null,
  prefix = "Trang",
): string {
  if (page === null || page === undefined) return "";
  const raw = String(page).trim();
  if (!raw) return "";

  // Nếu chuỗi đã có sẵn chữ Trang / Page thì giữ nguyên
  if (/^(trang|page)\b/i.test(raw)) {
    return raw;
  }

  // Bỏ dấu gạch nối và khoảng trắng ở hai đầu (ví dụ "-93-", "- 93 -", "-- 93 --")
  const cleaned = raw.replace(/^[\s\-–—]+|[\s\-–—]+$/g, "").trim();
  if (!cleaned) return raw;

  // Xử lý dải trang như "93 - 95" hoặc "93-95"
  const rangeParts = cleaned.split(/\s*[\-–—]\s*/);
  if (rangeParts.length === 2 && rangeParts[0] && rangeParts[1]) {
    return `${prefix} ${rangeParts[0]} - ${rangeParts[1]}`;
  }

  return `${prefix} ${cleaned}`;
}

/**
 * Huy hiệu số trang in trong tài liệu (ví dụ "Trang 93").
 */
export function PageBadge({
  page,
  className,
}: {
  page: string | number;
  className?: string;
}) {
  const { t } = useI18n();
  const label = formatPageLabel(page, t("page_counter"));

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5",
        "border-highlight-border bg-highlight font-mono text-xs leading-none font-medium",
        "text-highlight-foreground tabular whitespace-nowrap",
        className,
      )}
    >
      {label}
    </span>
  );
}

/** Nhiều số trang liền nhau, ví dụ khi một mục trải nhiều trang. */
export function PageBadgeList({
  pages,
  max = 4,
  className,
}: {
  pages: (string | number)[];
  max?: number;
  className?: string;
}) {
  if (!pages || pages.length === 0) return null;

  const shown = pages.slice(0, max);
  const hidden = pages.length - shown.length;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      {shown.map((page, idx) => (
        <PageBadge key={`${page}-${idx}`} page={page} />
      ))}
      {hidden > 0 && (
        <span className="text-xs text-muted-foreground tabular font-medium">+{hidden}</span>
      )}
    </span>
  );
}

