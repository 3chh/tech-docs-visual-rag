import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Chuỗi mục cha, ví dụ: 5章 › 5.4
 *
 * Điều khoản con vô nghĩa nếu không biết nó thuộc mục nào, nên chuỗi này
 * luôn hiện cùng tên mục.
 */
export function SectionPath({
  ancestors,
  className,
}: {
  ancestors: string[];
  className?: string;
}) {
  if (ancestors.length === 0) return null;

  return (
    <nav
      aria-label="Mục cha"
      className={cn("flex min-w-0 flex-wrap items-center gap-0.5 text-xs", className)}
    >
      {ancestors.map((ancestor, i) => (
        <span key={`${ancestor}-${i}`} className="flex min-w-0 items-center gap-0.5">
          {i > 0 && (
            <ChevronRight
              className="size-3 shrink-0 text-muted-foreground/60"
              aria-hidden
            />
          )}
          <span className="truncate text-muted-foreground" title={ancestor}>
            {ancestor}
          </span>
        </span>
      ))}
    </nav>
  );
}
