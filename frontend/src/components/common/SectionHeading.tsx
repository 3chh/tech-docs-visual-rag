import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Nhãn nhóm trong một khu vực. Chữ nhỏ, chữ hoa, kẻ dưới mảnh.
 * Không phải badge màu.
 */
export function SectionHeading({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 border-b pb-1.5",
        className,
      )}
    >
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </h3>
      {action}
    </div>
  );
}
