import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Trạng thái rỗng phải nói người dùng làm gì tiếp, không chỉ báo "không có gì".
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "default",
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  variant?: "default" | "bordered";
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "px-6 py-12 text-center",
        variant === "bordered" && "rounded-md border border-dashed bg-card/50",
        className,
      )}
    >
      <Icon className="mx-auto size-6 text-muted-foreground/70" aria-hidden />
      <h3 className="mt-3 text-[13px] font-medium">{title}</h3>
      {description && (
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
