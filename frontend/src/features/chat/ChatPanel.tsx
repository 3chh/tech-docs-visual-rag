import { ArrowUp, Loader2, MessageSquare, Search, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import type { ChatTurn, SearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

import { SourcePanel } from "./SourcePanel";

const TOP_K = 5;

export function ChatPanel({ collection }: { collection: string }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [useRewrite, setUseRewrite] = useState(true);
  const [activeSource, setActiveSource] = useState<SearchResult | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Đổi bộ tài liệu thì hội thoại cũ không còn ngữ cảnh.
  useEffect(() => {
    setTurns([]);
    setActiveSource(null);
  }, [collection]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function ask() {
    const question = draft.trim();
    if (!question || isBusy) return;

    const id = crypto.randomUUID();
    setTurns((prev) => [
      ...prev,
      { id, question, answer: null, sources: [], status: "pending" },
    ]);
    setDraft("");
    setIsBusy(true);

    try {
      const response = await api.ask({
        query: question,
        collection,
        topK: TOP_K,
        useTocRewrite: useRewrite,
      });

      setTurns((prev) =>
        prev.map((turn) =>
          turn.id === id
            ? {
                ...turn,
                status: "done",
                sources: response.sources,
                answer: response.answer,
                rewrittenQuery: response.rewritten_query ?? undefined,
              }
            : turn,
        ),
      );

      if (response.sources.length > 0) setActiveSource(response.sources[0]);
    } catch (error) {
      setTurns((prev) =>
        prev.map((turn) =>
          turn.id === id
            ? {
                ...turn,
                status: "error",
                error: error instanceof Error ? error.message : "Lỗi không xác định",
              }
            : turn,
        ),
      );
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Tự quản lý scroll để cuộn xuống lượt mới nhất; ScrollArea của
            shadcn không cho ref vào viewport. */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
            {turns.length === 0 ? (
              <EmptyState collection={collection} onPick={setDraft} />
            ) : (
              turns.map((turn) => (
                <TurnBlock
                  key={turn.id}
                  turn={turn}
                  activeSourcePath={activeSource?.image_path}
                  onPickSource={setActiveSource}
                />
              ))
            )}
          </div>
        </div>

        <div className="border-t bg-background">
          <div className="mx-auto w-full max-w-3xl space-y-2.5 p-4">
            <div className="flex items-end gap-2">
              <div className="relative flex-1">
                <label htmlFor="chat-input" className="sr-only">
                  Câu hỏi về tài liệu
                </label>
                <textarea
                  id="chat-input"
                  rows={1}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void ask();
                    }
                  }}
                  placeholder={`Hỏi về tài liệu trong ${collection}...`}
                  disabled={isBusy}
                  className={cn(
                    "w-full resize-none rounded-lg border bg-transparent py-2.5 pl-3.5 pr-11 text-sm",
                    "placeholder:text-muted-foreground focus-visible:outline-none",
                    "focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60",
                  )}
                />
                <Button
                  size="icon"
                  className="absolute bottom-1.5 right-1.5 size-7"
                  onClick={() => void ask()}
                  disabled={isBusy || !draft.trim()}
                  aria-label="Gửi câu hỏi"
                >
                  {isBusy ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <ArrowUp className="size-3.5" aria-hidden />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="rewrite"
                  checked={useRewrite}
                  onCheckedChange={setUseRewrite}
                  disabled={isBusy}
                />
                <Label
                  htmlFor="rewrite"
                  className="flex items-center gap-1 text-xs font-normal text-muted-foreground"
                >
                  <Sparkles className="size-3" aria-hidden />
                  Chuẩn hoá câu hỏi theo mục lục
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter để gửi, Shift+Enter để xuống dòng
              </p>
            </div>
          </div>
        </div>
      </div>

      {activeSource && (
        <div className="hidden w-[420px] shrink-0 lg:block">
          <SourcePanel source={activeSource} onClose={() => setActiveSource(null)} />
        </div>
      )}
    </div>
  );
}

function TurnBlock({
  turn,
  activeSourcePath,
  onPickSource,
}: {
  turn: ChatTurn;
  activeSourcePath?: string;
  onPickSource: (source: SearchResult) => void;
}) {
  return (
    <article className="space-y-3">
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-lg rounded-br-sm bg-secondary px-3.5 py-2.5 text-sm">
          {turn.question}
        </p>
      </div>

      {turn.status === "pending" && (
        <div className="space-y-2" aria-busy="true" aria-label="Đang tìm kiếm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Search className="size-3 animate-pulse" aria-hidden />
            Đang tìm trong tài liệu...
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )}

      {turn.status === "error" && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm"
        >
          <p className="font-medium text-destructive">Không tìm được</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{turn.error}</p>
        </div>
      )}

      {turn.status === "done" && (
        <div className="space-y-3">
          {turn.rewrittenQuery && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="mt-0.5 size-3 shrink-0" aria-hidden />
              <span>
                Đã tìm theo thuật ngữ trong tài liệu:{" "}
                <span className="text-foreground">{turn.rewrittenQuery}</span>
              </span>
            </p>
          )}

          <div className="whitespace-pre-wrap text-sm leading-relaxed">{turn.answer}</div>

          {turn.sources.length > 0 && (
            <ul className="space-y-1.5" aria-label="Mục nguồn">
              {turn.sources.map((source, i) => (
                <li key={source.image_path || i}>
                  <button
                    type="button"
                    onClick={() => onPickSource(source)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-md border px-3 py-2 text-left transition-colors",
                      "hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      source.image_path === activeSourcePath && "border-primary/40 bg-primary/5",
                    )}
                    aria-current={source.image_path === activeSourcePath}
                  >
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm bg-muted font-mono text-[10px] tabular">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">
                        {source.section_title || "(không có tiêu đề)"}
                      </span>
                      {source.ancestors.length > 0 && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {source.ancestors.join(" › ")}
                        </span>
                      )}
                    </span>
                    {source.section_pages.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="shrink-0 font-mono text-[10px] tabular"
                      >
                        {source.section_pages[0]}
                      </Badge>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

const SAMPLE_QUESTIONS = [
  "Mục nào quy định về tải trọng thiết kế?",
  "Hệ số an toàn lấy theo bảng nào?",
  "Công thức tính ứng suất uốn ở đâu?",
];

function EmptyState({
  collection,
  onPick,
}: {
  collection: string;
  onPick: (question: string) => void;
}) {
  return (
    <div className="py-12 text-center" role="status">
      <MessageSquare className="mx-auto size-8 text-muted-foreground" aria-hidden />
      <h3 className="mt-3 text-sm font-medium">
        Hỏi về tài liệu trong{" "}
        <span className="font-mono">{collection}</span>
      </h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
        Hệ thống đọc trực tiếp ảnh trang tài liệu, nên đọc được cả bảng, công thức và
        hình vẽ. Câu trả lời luôn kèm số trang để bạn đối chiếu với bản in.
      </p>

      <ul className="mx-auto mt-5 flex max-w-md flex-col gap-1.5">
        {SAMPLE_QUESTIONS.map((question) => (
          <li key={question}>
            <button
              type="button"
              onClick={() => onPick(question)}
              className="w-full rounded-md border px-3 py-2 text-left text-[13px] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {question}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
