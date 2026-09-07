import { Columns, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { DocumentCanvas } from "@/features/canvas";
import type { AskPreferences } from "@/features/settings/types";
import { api } from "@/lib/api";
import type { AskTurn, SearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

import { AnswerBlock } from "./AnswerBlock";
import { AskComposer } from "./AskComposer";

interface AskPanelProps {
  collection: string;
  options: AskPreferences;
  turns?: AskTurn[];
  onUpdateTurns?: (updater: AskTurn[] | ((prev: AskTurn[]) => AskTurn[])) => void;
  activeSource?: SearchResult | null;
  onSelectSource?: (source: SearchResult | null) => void;
}

export function AskPanel({
  collection,
  options,
  turns: controlledTurns,
  onUpdateTurns,
  activeSource: controlledActiveSource,
  onSelectSource: controlledOnSelectSource,
}: AskPanelProps) {
  // Internal state fallback if not controlled from parent
  const [internalTurns, setInternalTurns] = useState<AskTurn[]>([]);
  const [internalActiveSource, setInternalActiveSource] = useState<SearchResult | null>(null);

  const { t } = useI18n();
  const turns = controlledTurns ?? internalTurns;
  const setTurns = useCallback(
    (updater: AskTurn[] | ((prev: AskTurn[]) => AskTurn[])) => {
      if (onUpdateTurns) {
        onUpdateTurns(updater);
      } else {
        setInternalTurns(updater);
      }
    },
    [onUpdateTurns],
  );

  const activeSource =
    controlledActiveSource !== undefined ? controlledActiveSource : internalActiveSource;
  const setActiveSource = useCallback(
    (source: SearchResult | null) => {
      if (controlledOnSelectSource) {
        controlledOnSelectSource(source);
      } else {
        setInternalActiveSource(source);
      }
    },
    [controlledOnSelectSource],
  );

  const [draft, setDraft] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isCanvasOpen, setIsCanvasOpen] = useState(true);
  const [isCanvasExpanded, setIsCanvasExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
        tocPreviewLimit: options.tocPreviewLimit,
        vlmTemperature: options.vlmTemperature,
        systemPrompt: options.systemPrompt,
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

      if (response.sources.length > 0) {
        setActiveSource(response.sources[0]);
        setIsCanvasOpen(true);
      }
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
  }, [collection, draft, isBusy, options, setActiveSource, setTurns]);

  function handlePickSource(source: SearchResult) {
    setActiveSource(source);
    setIsCanvasOpen(true);
  }

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-background">
      {/* LEFT PANE: Chat Conversation & Composer */}
      <div
        className={cn(
          "flex min-w-0 flex-col h-full transition-all duration-200 ease-in-out",
          isCanvasOpen && !isCanvasExpanded
            ? "w-full md:w-1/2 lg:w-[48%] border-r border-border"
            : isCanvasExpanded
            ? "hidden"
            : "w-full",
        )}
      >
        {/* Chat Header / Action Bar */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b bg-muted/20 px-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{t("empty_chat_title")}</span>
          </div>

          {!isCanvasOpen && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCanvasOpen(true)}
              className="h-7 gap-1.5 text-xs text-emerald-600 font-medium"
            >
              <Columns className="size-3.5" />
              <span>{t("open_canvas_btn")}</span>
            </Button>
          )}
        </div>

        {/* Message Thread */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[46rem] space-y-8 px-5 py-6">
            {turns.length === 0 ? (
              <EmptyState
                icon={Search}
                title={t("empty_chat_title")}
                description={t("empty_chat_desc")}
                action={
                  <ul className="w-full max-w-md space-y-2 mt-4">
                    {[t("sample_q1"), t("sample_q2"), t("sample_q3")].map((question) => (
                      <li key={question}>
                        <button
                          type="button"
                          onClick={() => setDraft(question)}
                          className="w-full rounded-lg border bg-card px-3.5 py-2.5 text-left text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-accent hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="flex items-center gap-2">
                            <Sparkles className="size-3 text-primary shrink-0" />
                            <span>{question}</span>
                          </span>
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
                  onPickSource={handlePickSource}
                />
              ))
            )}
          </div>
        </div>

        {/* Composer Footer */}
        <AskComposer
          value={draft}
          onChange={setDraft}
          onSubmit={() => void ask()}
          isBusy={isBusy}
          placeholder={t("ask_placeholder")}
        />
      </div>

      {/* RIGHT PANE: Document Canvas Workspace */}
      {isCanvasOpen && (
        <div
          className={cn(
            "min-h-0 flex-col h-full bg-background transition-all duration-200 ease-in-out",
            isCanvasExpanded ? "w-full flex" : "w-full md:w-1/2 lg:w-[52%] flex",
          )}
        >
          <DocumentCanvas
            source={activeSource}
            collection={collection}
            onClose={() => {
              setIsCanvasOpen(false);
              setIsCanvasExpanded(false);
            }}
            onSelectSource={setActiveSource}
            isExpanded={isCanvasExpanded}
            onToggleExpand={() => setIsCanvasExpanded((v) => !v)}
          />
        </div>
      )}
    </div>
  );
}
