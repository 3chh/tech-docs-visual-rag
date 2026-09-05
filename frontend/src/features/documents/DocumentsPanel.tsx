import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  CheckCircle2,
  FileStack,
  Layers,
  Loader2,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState, SectionHeading, StatTile } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTableOfContents, useUploadFiles } from "@/hooks/use-api";
import type { ProcessingOverrides } from "@/features/settings/types";
import { pruneEmpty } from "@/features/settings/types";
import type { TocBook, UploadFileMeta, UploadResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

import {
  createQueuedFiles,
  FileConfigRow,
  UploadDropzone,
  type QueuedFile,
} from "./UploadQueue";

/**
 * Khu vực Tài liệu: gộp "xem đang có gì" và "thêm mới" vào một chỗ.
 *
 * Tách hai việc này thành hai tab là chia theo endpoint, không theo công việc:
 * người dùng tải lên xong muốn thấy kết quả ngay tại đây.
 */
export function DocumentsPanel({
  collection,
  overrides,
  onOpenBookInCanvas,
}: {
  collection: string;
  overrides: ProcessingOverrides;
  onOpenBookInCanvas?: (book: TocBook) => void;
}) {
  const toc = useTableOfContents(collection);
  const upload = useUploadFiles();
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [result, setResult] = useState<UploadResponse | null>(null);

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

  function addFiles(files: FileList) {
    const { accepted, rejected: bad } = createQueuedFiles(files);
    if (accepted.length) setQueue((prev) => [...prev, ...accepted]);
    setRejected(bad);
    if (accepted.length) setResult(null);
  }

  function submit() {
    if (!queue.length) return;

    // Gửi kèm override từ Cấu hình. pruneEmpty bỏ khoá rỗng để backend
    // chỉ nhận cái người dùng đổi thật, phần còn lại dùng mặc định server.
    const processing = pruneEmpty(overrides) ?? {};

    const metadata: UploadFileMeta[] = queue.map((item) => ({
      display_name: item.displayName || item.file.name,
      original_name: item.file.name,
      vertical_split: item.verticalSplit,
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
      <header>
        <h1 className="text-lg font-semibold tracking-tight">
          Tài liệu trong <span className="font-mono">{collection}</span>
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Mỗi PDF thành một cuốn. Hệ thống nhận diện bố cục, tách theo mục lục rồi
          đánh chỉ mục từng mục.
        </p>
      </header>

      {toc.isLoading ? (
        <div className="grid grid-cols-3 gap-2.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[62px]" />
          ))}
        </div>
      ) : (
        books.length > 0 && (
          <dl className="grid grid-cols-3 gap-2.5">
            <StatTile icon={BookMarked} label="Cuốn" value={totals.books} />
            <StatTile icon={Layers} label="Mục" value={totals.sections} />
            <StatTile icon={FileStack} label="Trang" value={totals.pages} />
          </dl>
        )
      )}

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

          {Object.keys(pruneEmpty(overrides) ?? {}).length > 0 && (
            <p className="text-sm text-muted-foreground">
              Đang áp cấu hình xử lý tuỳ chỉnh từ mục Cấu hình.
            </p>
          )}

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
              <p className="text-sm text-muted-foreground" role="status">
                Sách vài trăm trang có thể mất 20 phút. Đừng đóng tab.
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

      <section className="space-y-2.5">
        <SectionHeading>Đã có trong bộ</SectionHeading>

        {toc.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : books.length === 0 ? (
          <EmptyState
            variant="bordered"
            icon={FileStack}
            title="Chưa có tài liệu nào"
            description="Kéo PDF vào vùng phía trên để bắt đầu. Sau khi xử lý xong, các cuốn sẽ xuất hiện ở đây kèm mục lục đã nhận diện."
          />
        ) : (
          <ul className="divide-y rounded-md border bg-card">
            {books.map((book) => (
              <li key={book.book_index} className="flex items-center justify-between gap-3 p-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-sm bg-muted font-mono text-xs tabular font-medium">
                    {book.book_index}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium leading-snug truncate">
                      {book.title ?? `Cuốn ${book.book_index}`}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular">
                      {book.total_sections} mục · {book.total_pages} trang
                    </p>
                  </div>
                </div>

                {onOpenBookInCanvas && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs font-medium shrink-0"
                    onClick={() => onOpenBookInCanvas(book)}
                  >
                    <BookOpen className="size-3.5 text-primary" />
                    <span>Xem trong Canvas</span>
                  </Button>
                )}
              </li>
            ))}
          </ul>
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
