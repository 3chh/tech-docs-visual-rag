import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useUploadFiles } from "@/hooks/use-api";
import type { UploadFileMeta, UploadResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

interface QueuedFile {
  id: string;
  file: File;
  displayName: string;
  verticalSplit: boolean;
  maxPages: number | null;
}

const MAX_FILE_MB = 500;

export function UploadPanel({ collection }: { collection: string }) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadFiles();

  function addFiles(files: FileList | File[]) {
    const accepted: QueuedFile[] = [];
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith(".pdf")) continue;
      if (file.size > MAX_FILE_MB * 1024 * 1024) continue;
      accepted.push({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        displayName: file.name.replace(/\.pdf$/i, ""),
        verticalSplit: false,
        maxPages: null,
      });
    }
    if (accepted.length) {
      setQueue((prev) => [...prev, ...accepted]);
      setResult(null);
    }
  }

  function updateItem(id: string, patch: Partial<QueuedFile>) {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string) {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }

  function submit() {
    if (!queue.length) return;
    const metadata: UploadFileMeta[] = queue.map((item) => ({
      display_name: item.displayName || item.file.name,
      original_name: item.file.name,
      vertical_split: item.verticalSplit,
      max_pages: item.maxPages,
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

  const isBusy = upload.isPending;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h2 className="text-lg font-semibold tracking-tight">Tải tài liệu lên</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mỗi file PDF trở thành một cuốn trong bộ{" "}
          <span className="font-mono text-foreground">{collection}</span>. Hệ thống nhận
          diện bố cục, tách theo mục lục rồi đánh chỉ mục từng mục.
        </p>
      </header>

      <DropZone
        isDragging={isDragging}
        disabled={isBusy}
        onDragStateChange={setIsDragging}
        onFiles={addFiles}
        onBrowse={() => inputRef.current?.click()}
      />

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {queue.length > 0 && (
        <section className="space-y-3" aria-label="Danh sách file chờ xử lý">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-medium">
              {queue.length} file chờ xử lý
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setQueue([])}
              disabled={isBusy}
            >
              Bỏ tất cả
            </Button>
          </div>

          <ul className="divide-y rounded-lg border">
            {queue.map((item) => (
              <QueueRow
                key={item.id}
                item={item}
                disabled={isBusy}
                onChange={(patch) => updateItem(item.id, patch)}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </ul>

          <div className="flex items-center gap-3">
            <Button onClick={submit} disabled={isBusy}>
              {isBusy ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Đang xử lý...
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
    </div>
  );
}

function DropZone({
  isDragging,
  disabled,
  onDragStateChange,
  onFiles,
  onBrowse,
}: {
  isDragging: boolean;
  disabled: boolean;
  onDragStateChange: (dragging: boolean) => void;
  onFiles: (files: FileList) => void;
  onBrowse: () => void;
}) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) onDragStateChange(true);
      }}
      onDragLeave={() => onDragStateChange(false)}
      onDrop={(e) => {
        e.preventDefault();
        onDragStateChange(false);
        if (!disabled && e.dataTransfer.files) onFiles(e.dataTransfer.files);
      }}
      className={cn(
        "rounded-lg border border-dashed transition-colors",
        isDragging ? "border-primary bg-primary/5" : "border-border",
        disabled && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={onBrowse}
        disabled={disabled}
        className="flex w-full flex-col items-center gap-2 px-6 py-10 text-center"
      >
        <FileText className="size-7 text-muted-foreground" aria-hidden />
        <span className="text-sm font-medium">
          Kéo file PDF vào đây, hoặc bấm để chọn
        </span>
        <span className="text-xs text-muted-foreground">
          Chỉ nhận PDF, tối đa {MAX_FILE_MB}MB mỗi file
        </span>
      </button>
    </div>
  );
}

function QueueRow({
  item,
  disabled,
  onChange,
  onRemove,
}: {
  item: QueuedFile;
  disabled: boolean;
  onChange: (patch: Partial<QueuedFile>) => void;
  onRemove: () => void;
}) {
  const sizeMb = (item.file.size / 1024 / 1024).toFixed(1);

  return (
    <li className="p-3.5">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate font-mono text-[13px]" title={item.file.name}>
              {item.file.name}
            </p>
            <span className="shrink-0 text-xs text-muted-foreground tabular">
              {sizeMb} MB
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <div className="space-y-1.5">
              <Label htmlFor={`name-${item.id}`} className="text-xs">
                Tên hiển thị
              </Label>
              <Input
                id={`name-${item.id}`}
                value={item.displayName}
                disabled={disabled}
                onChange={(e) => onChange({ displayName: e.target.value })}
                className="h-8"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`pages-${item.id}`} className="text-xs">
                Giới hạn trang
              </Label>
              <Input
                id={`pages-${item.id}`}
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="Toàn bộ"
                disabled={disabled}
                value={item.maxPages ?? ""}
                onChange={(e) =>
                  onChange({ maxPages: e.target.value ? Number(e.target.value) : null })
                }
                className="h-8 tabular"
              />
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id={`split-${item.id}`}
              checked={item.verticalSplit}
              disabled={disabled}
              onCheckedChange={(checked) => onChange({ verticalSplit: checked === true })}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label htmlFor={`split-${item.id}`} className="text-xs font-normal">
                Tách đôi trang
              </Label>
              <p className="text-xs text-muted-foreground">
                Bật khi sách scan hai trang trên một tờ
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Bỏ ${item.file.name} khỏi danh sách`}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>
    </li>
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
        <>
          <Separator className="my-2.5" />
          <ul className="space-y-1">
            {entries.map(([name, pages]) => (
              <li key={name} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate font-mono">{name}</span>
                <span className="shrink-0 text-muted-foreground tabular">
                  {pages} mục
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground tabular">
            Tổng {result.total_pages} mục từ {result.processed_files} file
          </p>
        </>
      )}

      {result.errors.length > 0 && (
        <>
          <Separator className="my-2.5" />
          <ul className="space-y-1">
            {result.errors.map((error, i) => (
              <li key={i} className="text-xs text-destructive">
                {error}
              </li>
            ))}
          </ul>
        </>
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
        "rounded-lg border p-4 text-sm",
        variant === "success" ? "border-primary/25 bg-primary/5" : "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon
          className={cn(
            "mt-0.5 size-4 shrink-0",
            variant === "success" ? "text-primary" : "text-destructive",
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          <div className="mt-1 text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}
