import { BookMarked, FileStack, Layers, Sigma } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIndexedSections, useTableOfContents } from "@/hooks/use-api";
import type { SearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

import { SourcePanel } from "../chat/SourcePanel";

/** Tổng quan bộ tài liệu: các cuốn đã index và trang bìa của từng cuốn. */
export function LibraryPanel({ collection }: { collection: string }) {
  const toc = useTableOfContents(collection);
  const sections = useIndexedSections(collection);
  const [preview, setPreview] = useState<SearchResult | null>(null);

  const books = toc.data?.books ?? [];
  const totalSections = books.reduce((sum, book) => sum + book.total_sections, 0);
  const totalPages = books.reduce((sum, book) => sum + book.total_pages, 0);

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
          <header>
            <h2 className="text-lg font-semibold tracking-tight">Thư viện</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Các cuốn đã đánh chỉ mục trong bộ{" "}
              <span className="font-mono text-foreground">{collection}</span>.
            </p>
          </header>

          {toc.isLoading ? (
            <StatsSkeleton />
          ) : books.length > 0 ? (
            <dl className="grid grid-cols-3 gap-3">
              <Stat icon={BookMarked} label="Cuốn" value={books.length} />
              <Stat icon={Layers} label="Mục" value={totalSections} />
              <Stat icon={FileStack} label="Trang" value={totalPages} />
            </dl>
          ) : null}

          {toc.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : books.length === 0 ? (
            <EmptyLibrary />
          ) : (
            <section className="space-y-2" aria-label="Danh sách cuốn">
              <ul className="divide-y rounded-lg border">
                {books.map((book) => (
                  <li key={book.book_index} className="flex items-start gap-3 p-3.5">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs tabular">
                      {book.book_index}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">
                        {book.title ?? `Cuốn ${book.book_index}`}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground tabular">
                        {book.total_sections} mục · {book.total_pages} trang
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Ảnh bìa và mục lục của từng cuốn, lấy từ mục "noname" */}
          {sections.data && sections.data.length > 0 && (
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">Trang bìa và mục lục</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Phần đầu mỗi cuốn. Hệ thống dùng chính những trang này để chuẩn hoá
                  thuật ngữ trong câu hỏi.
                </p>
              </div>

              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {sections.data.map((section, i) => (
                  <li key={section.image_path || i}>
                    <button
                      type="button"
                      onClick={() => setPreview(section)}
                      className={cn(
                        "group block w-full overflow-hidden rounded-md border transition-colors",
                        "hover:border-primary/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        section.image_path === preview?.image_path && "border-primary/50",
                      )}
                      aria-label={`Xem trang bìa cuốn ${i}`}
                    >
                      {section.image_base64 ? (
                        <img
                          src={section.image_base64}
                          alt={`Trang bìa và mục lục cuốn ${i}`}
                          className="aspect-[3/4] w-full bg-white object-cover object-top"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex aspect-[3/4] w-full items-center justify-center bg-muted">
                          <FileStack className="size-5 text-muted-foreground" aria-hidden />
                        </div>
                      )}
                      <div className="border-t px-2 py-1.5 text-left">
                        <p className="truncate text-xs text-muted-foreground">
                          {typeof section.metadata?.file_name === "string"
                            ? section.metadata.file_name
                            : `Cuốn ${i}`}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {preview && (
        <div className="hidden w-[420px] shrink-0 lg:block">
          <SourcePanel source={preview} onClose={() => setPreview(null)} />
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Layers;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border p-3.5">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 font-mono text-xl tabular">{value}</dd>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[74px] w-full" />
      ))}
    </div>
  );
}

function EmptyLibrary() {
  return (
    <div className="rounded-lg border border-dashed px-6 py-12 text-center" role="status">
      <FileStack className="mx-auto size-7 text-muted-foreground" aria-hidden />
      <h3 className="mt-3 text-sm font-medium">Chưa có tài liệu nào</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Sang tab Tải lên để thêm PDF. Sau khi xử lý xong, các cuốn sẽ xuất hiện ở đây
        kèm mục lục đã nhận diện.
      </p>
    </div>
  );
}

/** Cây mục lục của toàn bộ collection. */
export function OutlinePanel({ collection }: { collection: string }) {
  const { data, isLoading, isError, refetch } = useTableOfContents(collection);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));

  function toggle(bookIndex: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(bookIndex)) next.delete(bookIndex);
      else next.add(bookIndex);
      return next;
    });
  }

  const books = data?.books ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Mục lục</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cây mục do hệ thống nhận diện từ bố cục trang, sau đó được LLM sửa lại phân
            cấp.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Tải lại
        </Button>
      </header>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {isError && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">Không đọc được mục lục</p>
        </div>
      )}

      {!isLoading && books.length === 0 && (
        <div className="rounded-lg border border-dashed px-6 py-12 text-center" role="status">
          <Layers className="mx-auto size-7 text-muted-foreground" aria-hidden />
          <h3 className="mt-3 text-sm font-medium">Chưa có mục lục</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Mục lục được sinh tự động sau khi index xong tài liệu đầu tiên.
          </p>
        </div>
      )}

      {books.map((book) => {
        const isOpen = expanded.has(book.book_index);
        const sections = book.sections ?? [];

        return (
          <section key={book.book_index} className="rounded-lg border">
            <button
              type="button"
              onClick={() => toggle(book.book_index)}
              aria-expanded={isOpen}
              className="flex w-full items-start gap-3 p-3.5 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs tabular">
                {book.book_index}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium leading-snug">
                  {book.title ?? `Cuốn ${book.book_index}`}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground tabular">
                  {book.total_sections} mục · {book.total_pages} trang
                </span>
              </span>
            </button>

            {isOpen && sections.length > 0 && (
              <ol className="divide-y border-t">
                {sections.map((section, i) => (
                  <li
                    key={i}
                    className="flex items-baseline gap-3 px-3.5 py-2 pl-12 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {section.title || "(không có tiêu đề)"}
                    </span>
                    {section.page_range && (
                      <Badge variant="secondary" className="shrink-0 font-mono text-[10px] tabular">
                        {section.page_range}
                      </Badge>
                    )}
                    {typeof section.formulas === "number" && section.formulas > 0 && (
                      <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground tabular">
                        <Sigma className="size-3" aria-hidden />
                        {section.formulas}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
