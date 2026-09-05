import { ChevronDown, ChevronRight, ListTree, RefreshCw, Sigma } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState, PageBadge, StatTile } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SourceView } from "@/features/source";
import { useTableOfContents } from "@/hooks/use-api";
import { api } from "@/lib/api";
import type { SearchResult, TocBook, TocSection } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTER_THRESHOLD = 20;

export function OutlinePanel({ collection }: { collection: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useTableOfContents(collection);
  const [openBooks, setOpenBooks] = useState<Set<number>>(new Set([0]));
  const [filter, setFilter] = useState("");
  const [activeSource, setActiveSource] = useState<SearchResult | null>(null);
  const [loadingTitle, setLoadingTitle] = useState<string | null>(null);

  const books = data?.books ?? [];
  const totals = useMemo(
    () => ({
      books: books.length,
      sections: books.reduce((sum, b) => sum + b.total_sections, 0),
      pages: books.reduce((sum, b) => sum + b.total_pages, 0),
    }),
    [books],
  );

  const totalSectionCount = books.reduce((sum, b) => sum + (b.sections?.length ?? 0), 0);
  const showFilter = totalSectionCount > FILTER_THRESHOLD;

  function toggleBook(index: number) {
    setOpenBooks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function openSection(section: TocSection) {
    if (!section.title || section.title === "noname") return;

    setLoadingTitle(section.title);
    try {
      const response = await api.searchBySectionTitle({
        sectionTitle: section.title,
        collection,
        limit: 1,
        includeBase64: true,
      });
      setActiveSource(response.results[0] ?? null);
    } catch {
      setActiveSource(null);
    } finally {
      setLoadingTitle(null);
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[52rem] space-y-5 px-6 py-6">
          <header className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-base font-semibold tracking-tight">Mục lục</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Cây mục do hệ thống nhận diện từ bố cục trang, sau đó LLM sửa lại phân cấp.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} aria-hidden />
              Tải lại
            </Button>
          </header>

          {isLoading && <OutlineSkeleton />}

          {isError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/[0.04] px-3 py-2.5 text-[13px]"
            >
              <p className="font-medium text-destructive">Không đọc được mục lục</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Kiểm tra backend đã chạy chưa.
              </p>
            </div>
          )}

          {!isLoading && !isError && books.length === 0 && (
            <EmptyState
              variant="bordered"
              icon={ListTree}
              title="Chưa có mục lục"
              description="Mục lục được sinh tự động sau khi đánh chỉ mục tài liệu đầu tiên. Sang khu vực Tài liệu để tải PDF lên."
            />
          )}

          {books.length > 0 && (
            <>
              <dl className="grid grid-cols-3 gap-2.5">
                <StatTile label="Cuốn" value={totals.books} />
                <StatTile label="Mục" value={totals.sections} />
                <StatTile label="Trang" value={totals.pages} />
              </dl>

              {showFilter && (
                <div>
                  <label htmlFor="outline-filter" className="sr-only">
                    Lọc theo tên mục
                  </label>
                  <Input
                    id="outline-filter"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Lọc theo tên mục..."
                    className="h-8"
                  />
                </div>
              )}

              <ul className="space-y-2.5">
                {books.map((book) => (
                  <li key={book.book_index}>
                    <BookGroup
                      book={book}
                      isOpen={openBooks.has(book.book_index)}
                      filter={filter}
                      loadingTitle={loadingTitle}
                      activeTitle={activeSource?.section_title}
                      onToggle={() => toggleBook(book.book_index)}
                      onPickSection={openSection}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <SourceView source={activeSource} onClose={() => setActiveSource(null)} />
    </div>
  );
}

function BookGroup({
  book,
  isOpen,
  filter,
  loadingTitle,
  activeTitle,
  onToggle,
  onPickSection,
}: {
  book: TocBook;
  isOpen: boolean;
  filter: string;
  loadingTitle: string | null;
  activeTitle?: string;
  onToggle: () => void;
  onPickSection: (section: TocSection) => void;
}) {
  const sections = book.sections ?? [];
  const query = filter.trim().toLowerCase();
  const visible = query
    ? sections.filter((s) => s.title.toLowerCase().includes(query))
    : sections;

  // Đang lọc mà cuốn này không còn mục nào thì ẩn hẳn cuốn.
  if (query && visible.length === 0) return null;

  const expanded = isOpen || Boolean(query);

  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
      >
        {expanded ? (
          <ChevronDown className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-sm bg-muted font-mono text-[10px] tabular">
          {book.book_index}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium leading-snug">
            {book.title ?? `Cuốn ${book.book_index}`}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground tabular">
            {book.total_sections} mục · {book.total_pages} trang
          </span>
        </span>
      </button>

      {expanded && visible.length > 0 && (
        <ol className="border-t">
          {visible.map((section, i) => (
            <li key={`${section.title}-${i}`}>
              <SectionRow
                section={section}
                isActive={section.title === activeTitle}
                isLoading={section.title === loadingTitle}
                onPick={() => onPickSection(section)}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SectionRow({
  section,
  isActive,
  isLoading,
  onPick,
}: {
  section: TocSection;
  isActive: boolean;
  isLoading: boolean;
  onPick: () => void;
}) {
  const depth = section.ancestor_titles?.length ?? 0;
  const isPlaceholder = section.title === "noname";

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={isPlaceholder}
      aria-current={isActive ? "true" : undefined}
      className={cn(
        "flex w-full items-baseline gap-2.5 border-b px-3 py-1.5 text-left last:border-b-0",
        "transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
        isPlaceholder
          ? "cursor-default text-muted-foreground"
          : "hover:bg-accent",
        isActive && "bg-primary/[0.05]",
      )}
      // Thụt lề theo độ sâu thật của mục trong cây, tối đa 3 bậc.
      style={{ paddingLeft: `${0.75 + Math.min(depth, 3) * 1.15}rem` }}
    >
      <span className="min-w-0 flex-1 truncate text-[13px]" title={section.title}>
        {isPlaceholder ? "Bìa và mục lục" : section.title}
      </span>

      {isLoading && (
        <span className="shrink-0 text-[11px] text-muted-foreground">đang mở...</span>
      )}

      {typeof section.formulas === "number" && section.formulas > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground tabular">
          <Sigma className="size-3" aria-hidden />
          {section.formulas}
        </span>
      )}

      {section.page_range && <PageBadge page={section.page_range} className="shrink-0" />}
    </button>
  );
}

function OutlineSkeleton() {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Đang tải mục lục">
      <div className="grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[62px]" />
        ))}
      </div>
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
    </div>
  );
}
