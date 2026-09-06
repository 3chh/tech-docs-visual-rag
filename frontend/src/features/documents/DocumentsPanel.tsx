import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileSliders,
  FileStack,
  Layers,
  ListTree,
  Loader2,
  Search,
  Sigma,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState, PageBadge, SectionHeading, StatTile } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTableOfContents, useUploadFiles } from "@/hooks/use-api";
import {
  configToProcessingOverrides,
  loadCollectionConfig,
  pruneEmpty,
  type CollectionConfig,
} from "@/features/settings/types";
import { useI18n } from "@/lib/i18n";
import type { TocBook, TocSection, UploadFileMeta, UploadResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

import { CollectionSettingsDialog } from "./CollectionSettingsDialog";
import { CreateCollectionDialog } from "./CreateCollectionDialog";
import {
  createQueuedFiles,
  FileConfigRow,
  UploadDropzone,
  type QueuedFile,
} from "./UploadQueue";

export function DocumentsPanel({
  collection,
  onCollectionChange,
  onOpenBookInCanvas,
  onOpenSectionInCanvas,
}: {
  collection: string;
  onCollectionChange?: (col: string) => void;
  onOpenBookInCanvas?: (book: TocBook) => void;
  onOpenSectionInCanvas?: (section: TocSection, book: TocBook) => void;
}) {
  const toc = useTableOfContents(collection);
  const upload = useUploadFiles();
  const { t } = useI18n();

  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [result, setResult] = useState<UploadResponse | null>(null);

  // Quản lý xem mục lục của từng tài liệu
  const [expandedBooks, setExpandedBooks] = useState<Set<number>>(new Set([0]));
  const [bookFilters, setBookFilters] = useState<Record<number, string>>({});

  // Cấu hình bộ tài liệu
  const [collectionConfig, setCollectionConfig] = useState<CollectionConfig>(() =>
    loadCollectionConfig(collection),
  );
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const books = toc.data?.books ?? [];
  const totals = useMemo(
    () => ({
      books: books.length,
      sections: books.reduce((sum, b) => sum + b.total_sections, 0),
      pages: books.reduce((sum, b) => sum + b.total_pages, 0),
    }),
    [books],
  );

  const isBusy = upload.isPending;

  function toggleBookOutline(bookIndex: number) {
    setExpandedBooks((prev) => {
      const next = new Set(prev);
      if (next.has(bookIndex)) next.delete(bookIndex);
      else next.add(bookIndex);
      return next;
    });
  }

  function addFiles(files: FileList) {
    const { accepted, rejected: bad } = createQueuedFiles(files);
    if (accepted.length) setQueue((prev) => [...prev, ...accepted]);
    setRejected(bad);
    if (accepted.length) setResult(null);
  }

  function submit() {
    if (!queue.length) return;

    const processing = pruneEmpty(configToProcessingOverrides(collectionConfig)) ?? {};

    const metadata: UploadFileMeta[] = queue.map((item) => ({
      display_name: item.displayName || item.file.name,
      original_name: item.file.name,
      vertical_split: item.verticalSplit ?? collectionConfig.preprocess.vertical_split,
      max_pages: item.maxPages,
      ...processing,
    }));

    upload.mutate(
      { files: queue.map((item) => item.file), collection, metadata },
      {
        onSuccess: (data) => {
          setResult(data);
          if (data.success) setQueue([]);
        },
      },
    );
  }

  return (
    <div className="mx-auto w-full max-w-[55rem] space-y-6 px-6 py-6">
      {/* Header với nút Cấu hình bộ tài liệu và Tạo bộ tài liệu mới */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight text-foreground">
              {t("documents_title")}
            </h1>
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              {collection}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totals.books} cuốn · {totals.pages} trang · {totals.sections} điều khoản
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Nút Cấu hình bộ tài liệu hiện tại */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsConfigOpen(true)}
            className="h-8 gap-1.5 text-xs text-foreground hover:bg-muted font-medium"
          >
            <FileSliders className="size-3.5 text-emerald-600" />
            <span>Cấu hình bộ tài liệu</span>
          </Button>

          {/* Nút Tạo bộ tài liệu mới */}
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="h-8 gap-1.5 text-xs bg-emerald-600 text-white hover:bg-emerald-700 font-medium"
          >
            <FilePlus2 className="size-3.5" />
            <span>Tạo bộ mới</span>
          </Button>
        </div>
      </header>

      {/* Dialog Cấu hình bộ tài liệu */}
      <CollectionSettingsDialog
        collection={collection}
        open={isConfigOpen}
        onOpenChange={setIsConfigOpen}
        onSaved={(newCfg) => setCollectionConfig(newCfg)}
      />

      {/* Dialog Tạo bộ tài liệu mới */}
      <CreateCollectionDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={(newColId) => onCollectionChange?.(newColId)}
      />

      {/* Thống kê tài liệu */}
      {toc.isLoading ? (
        <div className="grid grid-cols-3 gap-2.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[62px]" />
          ))}
        </div>
      ) : (
        books.length > 0 && (
          <dl className="grid grid-cols-3 gap-2.5">
            <StatTile icon={BookMarked} label="Cuốn tài liệu" value={totals.books} />
            <StatTile icon={Layers} label="Mục điều khoản" value={totals.sections} />
            <StatTile icon={FileStack} label="Tổng số trang" value={totals.pages} />
          </dl>
        )
      )}

      {/* Dropzone tải lên */}
      <UploadDropzone disabled={isBusy} onFiles={addFiles} />

      {rejected.length > 0 && (
        <ul className="space-y-0.5" role="alert">
          {rejected.map((message) => (
            <li key={message} className="text-sm text-destructive">
              {message}
            </li>
          ))}
        </ul>
      )}

      {/* Hàng đợi file tải lên */}
      {queue.length > 0 && (
        <section className="space-y-2.5">
          <SectionHeading
            action={
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-sm"
                onClick={() => setQueue([])}
                disabled={isBusy}
              >
                Bỏ tất cả
              </Button>
            }
          >
            Chờ xử lý ({queue.length})
          </SectionHeading>

          <div className="divide-y rounded-md border bg-card">
            {queue.map((item) => (
              <FileConfigRow
                key={item.id}
                item={item}
                disabled={isBusy}
                onChange={(patch) =>
                  setQueue((prev) =>
                    prev.map((q) => (q.id === item.id ? { ...q, ...patch } : q)),
                  )
                }
                onRemove={() => setQueue((prev) => prev.filter((q) => q.id !== item.id))}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={submit} disabled={isBusy}>
              {isBusy ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Đang xử lý
                </>
              ) : (
                <>
                  <Upload aria-hidden />
                  Bắt đầu xử lý
                </>
              )}
            </Button>
            {isBusy && (
              <p className="text-xs text-muted-foreground animate-pulse" role="status">
                Đang xử lý tài liệu...
              </p>
            )}
          </div>
        </section>
      )}

      {upload.isError && (
        <Callout variant="error" title="Không gửi được yêu cầu">
          {upload.error instanceof Error ? upload.error.message : "Lỗi không xác định"}
        </Callout>
      )}

      {result && <ResultSummary result={result} />}

      {/* Danh sách Tài liệu kèm Mục lục Tích hợp cho từng cuốn */}
      <section className="space-y-3">
        <SectionHeading>{t("in_collection")}</SectionHeading>

        {toc.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : books.length === 0 ? (
          <EmptyState
            variant="bordered"
            icon={FileStack}
            title="Chưa có tài liệu nào"
            description="Tải lên tệp PDF để bắt đầu tra cứu và xem mục lục."
          />
        ) : (
          <div className="space-y-3">
            {books.map((book) => {
              const isExpanded = expandedBooks.has(book.book_index);
              const filterText = bookFilters[book.book_index] || "";
              const sections = (book.sections ?? []).filter((s) =>
                filterText ? s.title?.toLowerCase().includes(filterText.toLowerCase()) : true,
              );

              return (
                <div
                  key={book.book_index}
                  className="rounded-lg border bg-card overflow-hidden shadow-2xs transition-all"
                >
                  {/* Tiêu đề cuốn sách */}
                  <div className="flex items-center justify-between gap-3 p-3.5 bg-muted/10 hover:bg-muted/20 transition-colors">
                    <button
                      type="button"
                      onClick={() => toggleBookOutline(book.book_index)}
                      className="flex items-start gap-2.5 min-w-0 flex-1 text-left"
                    >
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm bg-muted font-mono text-xs tabular font-semibold text-foreground">
                        {book.book_index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {book.title ?? `Tài liệu ${book.book_index + 1}`}
                          </p>
                          {isExpanded ? (
                            <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground tabular">
                          {book.total_sections} {t("total_sections")} · {book.total_pages} {t("total_pages")}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Nút Xem mục lục */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-8 gap-1.5 text-xs font-medium",
                          isExpanded && "bg-muted text-emerald-700 dark:text-emerald-300",
                        )}
                        onClick={() => toggleBookOutline(book.book_index)}
                      >
                        <ListTree className="size-3.5 text-emerald-600" />
                        <span>Mục lục ({book.sections?.length ?? 0})</span>
                      </Button>

                      {/* Nút Đọc trên Canvas */}
                      {onOpenBookInCanvas && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs font-medium"
                          onClick={() => onOpenBookInCanvas(book)}
                        >
                          <BookOpen className="size-3.5 text-emerald-600" />
                          <span>{t("open_in_canvas")}</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Cây Mục lục được tích hợp trực tiếp cho cuốn sách này */}
                  {isExpanded && (
                    <div className="border-t bg-card p-4 space-y-3">
                      {/* Ô tìm kiếm mục lục trong cuốn */}
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1 max-w-sm">
                          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Lọc mục lục..."
                            value={filterText}
                            onChange={(e) =>
                              setBookFilters((prev) => ({
                                ...prev,
                                [book.book_index]: e.target.value,
                              }))
                            }
                            className="h-8 pl-8 text-xs"
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {sections.length} mục
                        </span>
                      </div>

                      {/* Danh sách các điều khoản mục lục */}
                      {sections.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-3 text-center">
                          {filterText ? "Không tìm thấy điều khoản phù hợp." : "Chưa có mục lục."}
                        </p>
                      ) : (
                        <div className="divide-y rounded-md border bg-muted/5 max-h-72 overflow-y-auto">
                          {sections.map((sec, sIdx) => {
                            const isTitle = sec.title && sec.title !== "noname";
                            return (
                              <div
                                key={sIdx}
                                className="flex items-center justify-between gap-3 px-3 py-2 text-xs hover:bg-muted/30 transition-colors"
                              >
                                <div className="min-w-0 flex-1 flex items-center gap-2">
                                  <span className="font-mono text-[10px] text-muted-foreground w-6 text-right shrink-0">
                                    {sIdx + 1}.
                                  </span>
                                  <span
                                    className={cn(
                                      "truncate",
                                      isTitle ? "font-medium text-foreground" : "text-muted-foreground italic",
                                    )}
                                  >
                                    {sec.title || "Mục chưa đặt tên"}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                                  {sec.formulas !== undefined && sec.formulas > 0 && (
                                    <span className="flex items-center gap-0.5 text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                      <Sigma className="size-3" />
                                      <span>{sec.formulas}</span>
                                    </span>
                                  )}

                                  {sec.page_range && (
                                    <PageBadge page={sec.page_range} className="text-[10px] py-0 shrink-0" />
                                  )}

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[11px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => {
                                      if (onOpenSectionInCanvas) {
                                        onOpenSectionInCanvas(sec, book);
                                      } else if (onOpenBookInCanvas) {
                                        onOpenBookInCanvas(book);
                                      }
                                    }}
                                  >
                                    Xem
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function ResultSummary({ result }: { result: UploadResponse }) {
  const entries = Object.entries(result.file_pages);

  return (
    <Callout
      variant={result.success ? "success" : "error"}
      title={result.success ? "Đã xử lý xong" : "Xử lý thất bại"}
    >
      <p>{result.message}</p>

      {entries.length > 0 && (
        <ul className="mt-2 space-y-0.5 border-t pt-2">
          {entries.map(([name, pages]) => (
            <li key={name} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-mono">{name}</span>
              <span className="shrink-0 tabular">{pages} mục</span>
            </li>
          ))}
        </ul>
      )}

      {result.errors.length > 0 && (
        <ul className="mt-2 space-y-0.5 border-t pt-2">
          {result.errors.map((error, i) => (
            <li key={i} className="text-sm text-destructive">
              {error}
            </li>
          ))}
        </ul>
      )}
    </Callout>
  );
}

function Callout({
  variant,
  title,
  children,
}: {
  variant: "success" | "error";
  title: string;
  children: React.ReactNode;
}) {
  const Icon = variant === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <div
      role="status"
      className={cn(
        "rounded-md border px-3 py-2.5",
        variant === "success"
          ? "border-primary/25 bg-primary/[0.04]"
          : "border-destructive/30 bg-destructive/[0.04]",
      )}
    >
      <div className="flex items-start gap-2">
        <Icon
          className={cn(
            "mt-0.5 size-4 shrink-0",
            variant === "success" ? "text-primary" : "text-destructive",
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium">{title}</p>
          <div className="mt-0.5 text-sm text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}
