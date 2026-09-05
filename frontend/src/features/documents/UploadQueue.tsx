import { FileText, Trash2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const MAX_FILE_MB = 500;

export interface QueuedFile {
  id: string;
  file: File;
  displayName: string;
  verticalSplit: boolean;
  maxPages: number | null;
}

export function createQueuedFiles(files: FileList | File[]): {
  accepted: QueuedFile[];
  rejected: string[];
} {
  const accepted: QueuedFile[] = [];
  const rejected: string[] = [];

  for (const file of Array.from(files)) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      rejected.push(`${file.name}: không phải PDF`);
      continue;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      rejected.push(`${file.name}: lớn hơn ${MAX_FILE_MB}MB`);
      continue;
    }
    accepted.push({
      id: crypto.randomUUID(),
      file,
      displayName: file.name.replace(/\.pdf$/i, ""),
      verticalSplit: false,
      maxPages: null,
    });
  }

  return { accepted, rejected };
}

export function UploadDropzone({
  disabled,
  onFiles,
}: {
  disabled: boolean;
  onFiles: (files: FileList) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (!disabled && e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-md border border-dashed transition-colors",
          isDragging ? "border-primary bg-primary/[0.04]" : "border-input bg-card/50",
          disabled && "opacity-60",
        )}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="flex w-full flex-col items-center gap-1.5 px-6 py-8 text-center focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
        >
          <Upload className="size-5 text-muted-foreground/70" aria-hidden />
          <span className="text-[13px] font-medium">
            Kéo PDF vào đây, hoặc bấm để chọn
          </span>
          <span className="text-xs text-muted-foreground">
            Chỉ nhận PDF, tối đa {MAX_FILE_MB}MB mỗi file
          </span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}

export function FileConfigRow({
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
  const nameId = useId();
  const pagesId = useId();
  const splitId = useId();
  const sizeMb = (item.file.size / 1024 / 1024).toFixed(1);

  return (
    <div className="p-3">
      <div className="flex items-start gap-2.5">
        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />

        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate font-mono text-xs" title={item.file.name}>
              {item.file.name}
            </p>
            <span className="shrink-0 text-[11px] text-muted-foreground tabular">
              {sizeMb} MB
            </span>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-[1fr_7rem]">
            <div className="space-y-1">
              <Label htmlFor={nameId} className="text-xs font-normal text-muted-foreground">
                Tên hiển thị
              </Label>
              <Input
                id={nameId}
                value={item.displayName}
                disabled={disabled}
                onChange={(e) => onChange({ displayName: e.target.value })}
                className="h-8"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor={pagesId} className="text-xs font-normal text-muted-foreground">
                Giới hạn trang
              </Label>
              <Input
                id={pagesId}
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="Toàn bộ"
                disabled={disabled}
                value={item.maxPages ?? ""}
                onChange={(e) =>
                  onChange({ maxPages: e.target.value ? Number(e.target.value) : null })
                }
                className="h-8 font-mono tabular"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id={splitId}
              checked={item.verticalSplit}
              disabled={disabled}
              onCheckedChange={(checked) => onChange({ verticalSplit: checked === true })}
            />
            <Label
              htmlFor={splitId}
              className="cursor-pointer text-xs font-normal text-muted-foreground"
            >
              Tách đôi trang (sách scan hai trang trên một tờ)
            </Label>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="-mr-1 size-7 shrink-0"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Bỏ ${item.file.name} khỏi danh sách`}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
