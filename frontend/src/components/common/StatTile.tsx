import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Số lớn dạng mono + nhãn nhỏ. Dùng cho thống kê bộ tài liệu. */
export function StatTile({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon?: LucideIcon;
  label: string;
  value: number | string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border bg-card px-3.5 py-3", className)}>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="size-3.5" aria-hidden />}
        {label}
      </dt>
      <dd className="mt-1 font-mono text-lg leading-tight tabular">{value}</dd>
    </div>
  );
}
