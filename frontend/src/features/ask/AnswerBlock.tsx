import { AlertCircle, FileSearch, Search, Wand2 } from "lucide-react";

import { PageBadge, SectionHeading } from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";
import type { AskTurn, SearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AnswerBlock({
  turn,
  activeSourcePath,
  onPickSource,
}: {
  turn: AskTurn;
  activeSourcePath?: string;
  onPickSource: (source: SearchResult) => void;
}) {
  return (
    <article className="space-y-3.5">
      {/* Câu hỏi căn phải để phân biệt với câu trả lời */}
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-md rounded-br-sm border bg-card px-3 py-2 text-[13px]">
          {turn.question}
        </p>
      </div>

      {turn.status === "pending" && <PendingState />}
      {turn.status === "error" && <ErrorState message={turn.error} />}

      {turn.status === "done" && (
        <div className="space-y-3.5">
          {turn.rewrittenQuery && <RewriteNote rewritten={turn.rewrittenQuery} />}

          <div className="whitespace-pre-wrap text-[13px] leading-relaxed">
            {turn.answer}
          </div>

          {turn.sources.length > 0 && (
            <div className="space-y-2">
              <SectionHeading>Nguồn ({turn.sources.length})</SectionHeading>
              <ul className="space-y-1">
                {turn.sources.map((source, i) => (
                  <li key={source.image_path || i}>
                    <SourceRow
                      index={i + 1}
                      source={source}
                      isActive={source.image_path === activeSourcePath}
                      onPick={() => onPickSource(source)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function RewriteNote({ rewritten }: { rewritten: string }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <Wand2 className="mt-0.5 size-3 shrink-0" aria-hidden />
      <span>
        Đã tìm theo thuật ngữ trong tài liệu:{" "}
        <span className="text-foreground">{rewritten}</span>
      </span>
    </p>
  );
}

function SourceRow({
  index,
  source,
  isActive,
  onPick,
}: {
  index: number;
  source: SearchResult;
  isActive: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-current={isActive ? "true" : undefined}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-md border px-2.5 py-2 text-left",
        "transition-colors hover:bg-accent",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
        isActive ? "border-primary/45 bg-primary/[0.04]" : "bg-card",
      )}
    >
      <span
        className={cn(
          "mt-px flex size-4 shrink-0 items-center justify-center rounded-sm font-mono text-[10px] tabular",
          isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        {index}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">
          {source.section_title || "Mục không có tiêu đề"}
        </span>
        {source.ancestors.length > 0 && (
          <span
            className="block truncate text-xs text-muted-foreground"
            title={source.ancestors.join(" › ")}
          >
            {source.ancestors.join(" › ")}
          </span>
        )}
      </span>

      {source.section_pages[0] && (
        <PageBadge page={source.section_pages[0]} className="mt-px shrink-0" />
      )}
    </button>
  );
}

function PendingState() {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Đang tra cứu">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Search className="size-3 animate-pulse" aria-hidden />
        Đang tìm mục liên quan rồi đọc ảnh tài liệu...
      </p>
      <Skeleton className="h-3.5 w-4/5" />
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-3/5" />
    </div>
  );
}

function ErrorState({ message }: { message?: string }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/[0.04] px-3 py-2.5"
    >
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-destructive">
        <AlertCircle className="size-3.5 shrink-0" aria-hidden />
        Không tra cứu được
      </p>
      {message && <p className="mt-1 pl-5 text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}

/** Không tìm thấy mục nào: khác với lỗi, cần gợi ý cách sửa câu hỏi. */
export function NoResultNote() {
  return (
    <div className="rounded-md border border-dashed bg-card/50 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[13px] font-medium">
        <FileSearch className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        Không tìm thấy mục nào phù hợp
      </p>
      <p className="mt-1 pl-5 text-xs text-muted-foreground">
        Thử dùng từ ngữ gần với tiêu đề mục trong tài liệu, hoặc kiểm tra bộ tài liệu
        đã được đánh chỉ mục chưa.
      </p>
    </div>
  );
}
