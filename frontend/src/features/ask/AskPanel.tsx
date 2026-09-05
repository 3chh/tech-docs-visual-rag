import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/common";
import { api } from "@/lib/api";
import type { AskTurn, SearchResult } from "@/lib/types";
import { SourceView } from "@/features/source";

import { AnswerBlock } from "./AnswerBlock";
import { AskComposer, type AskOptions } from "./AskComposer";
import { AskToolbar } from "./AskToolbar";

const SAMPLE_QUESTIONS = [
  "Mục nào quy định về tải trọng thiết kế?",
  "Hệ số an toàn lấy theo bảng nào?",
  "Công thức tính ứng suất uốn ở mục nào?",
];

export function AskPanel({ collection }: { collection: string }) {
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [options, setOptions] = useState<AskOptions>({ topK: 5, useTocRewrite: true });
  const [activeSource, setActiveSource] = useState<SearchResult | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Đổi bộ tài liệu thì hội thoại cũ không còn ngữ cảnh.
  useEffect(() => {
    setTurns([]);
    setActiveSource(null);
  }, [collection]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const ask = useCallback(async () => {
    const question = draft.trim();
    if (!question || isBusy) return;

    const id = crypto.randomUUID();
    setTurns((prev) => [
      ...prev,
      { id, question, answer: "", sources: [], status: "pending" },
    ]);
    setDraft("");
    setIsBusy(true);

    try {
      const response = await api.ask({
        query: question,
        collection,
        topK: options.topK,
        useTocRewrite: options.useTocRewrite,
      });

      setTurns((prev) =>
        prev.map((turn) =>
          turn.id === id
            ? {
                ...turn,
                status: "done" as const,
                answer: response.answer,
                sources: response.sources,
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
                status: "error" as const,
                error: error instanceof Error ? error.message : "Lỗi không xác định",
              }
            : turn,
        ),
      );
    } finally {
      setIsBusy(false);
    }
  }, [collection, draft, isBusy, options]);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <AskToolbar options={options} onChange={setOptions} disabled={isBusy} />

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[46rem] space-y-7 px-6 py-6">
            {turns.length === 0 ? (
              <EmptyState
                icon={Search}
                title={`Tra cứu trong ${collection}`}
                description="Hệ thống đọc trực tiếp ảnh trang tài liệu nên hiểu được cả bảng, công thức và hình vẽ. Câu trả lời luôn kèm số trang in để bạn đối chiếu với bản cứng."
                action={
                  <ul className="w-full max-w-md space-y-1">
                    {SAMPLE_QUESTIONS.map((question) => (
                      <li key={question}>
                        <button
                          type="button"
                          onClick={() => setDraft(question)}
                          className="w-full rounded-md border bg-card px-3 py-2 text-left text-[15px] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
                        >
                          {question}
                        </button>
                      </li>
                    ))}
                  </ul>
                }
              />
            ) : (
              turns.map((turn) => (
                <AnswerBlock
                  key={turn.id}
                  turn={turn}
                  activeSourcePath={activeSource?.image_path}
                  onPickSource={setActiveSource}
                />
              ))
            )}
          </div>
        </div>

        <AskComposer
          value={draft}
          onChange={setDraft}
          onSubmit={() => void ask()}
          isBusy={isBusy}
          placeholder="Hỏi về nội dung tài liệu..."
        />
      </div>

      <SourceView source={activeSource} onClose={() => setActiveSource(null)} />
    </div>
  );
}
