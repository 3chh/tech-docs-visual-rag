import { cn } from "@/lib/utils";

/**
 * Số trang in trên giấy, ví dụ "-93-".
 *
 * Đây là thông tin quan trọng nhất trong mỗi kết quả: người dùng cần mở đúng
 * trang đó trên bản cứng. Dùng màu bút-đánh-dấu để nhặt ra khỏi trang được
 * ngay, và là chỗ DUY NHẤT trong app dùng màu này.
 */
export function PageBadge({
  page,
  className,
}: {
  page: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5",
        "border-highlight-border bg-highlight font-mono text-sm leading-none",
        "text-highlight-foreground tabular",
        className,
      )}
    >
      <span className="sr-only">trang </span>
      {page}
    </span>
  );
}

/** Nhiều số trang liền nhau, ví dụ khi một mục trải nhiều trang. */
export function PageBadgeList({
  pages,
  max = 4,
  className,
}: {
  pages: string[];
  max?: number;
  className?: string;
}) {
  if (pages.length === 0) return null;

  const shown = pages.slice(0, max);
  const hidden = pages.length - shown.length;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {shown.map((page) => (
        <PageBadge key={page} page={page} />
      ))}
      {hidden > 0 && (
        <span className="text-sm text-muted-foreground tabular">+{hidden}</span>
      )}
    </span>
  );
}
