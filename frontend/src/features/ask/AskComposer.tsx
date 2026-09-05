import { ArrowUp, Loader2, Wand2 } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const TOP_K_OPTIONS = [3, 5, 8, 12];
const MAX_TEXTAREA_HEIGHT = 160;

export interface AskOptions {
  topK: number;
  useTocRewrite: boolean;
}

export function AskComposer({
  value,
  onChange,
  onSubmit,
  options,
  onOptionsChange,
  isBusy,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  options: AskOptions;
  onOptionsChange: (options: AskOptions) => void;
  isBusy: boolean;
  placeholder: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function autoGrow(element: HTMLTextAreaElement) {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }

  return (
    <div className="border-t bg-background">
      <div className="mx-auto w-full max-w-[46rem] space-y-2 px-6 py-3.5">
        <div className="relative">
          <Label htmlFor="ask-input" className="sr-only">
            Câu hỏi về tài liệu
          </Label>
          <textarea
            ref={textareaRef}
            id="ask-input"
            rows={1}
            value={value}
            disabled={isBusy}
            placeholder={placeholder}
            onChange={(e) => {
              onChange(e.target.value);
              autoGrow(e.target);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            className={cn(
              "w-full resize-none rounded-md border bg-card py-2.5 pl-3 pr-10",
              "text-[13px] leading-relaxed placeholder:text-muted-foreground",
              "focus-visible:border-ring focus-visible:outline-none",
              "focus-visible:ring-[3px] focus-visible:ring-ring/25",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          />
          <Button
            size="icon"
            className="absolute bottom-1.5 right-1.5 size-7"
            onClick={onSubmit}
            disabled={isBusy || !value.trim()}
            aria-label="Gửi câu hỏi"
          >
            {isBusy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <ArrowUp className="size-3.5" aria-hidden />
            )}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <Switch
              id="toc-rewrite"
              checked={options.useTocRewrite}
              disabled={isBusy}
              onCheckedChange={(checked) =>
                onOptionsChange({ ...options, useTocRewrite: checked })
              }
            />
            <Label
              htmlFor="toc-rewrite"
              className="flex cursor-pointer items-center gap-1 text-xs font-normal text-muted-foreground"
            >
              <Wand2 className="size-3" aria-hidden />
              Chuẩn hoá thuật ngữ theo mục lục
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="top-k" className="text-xs font-normal text-muted-foreground">
              Số mục lấy về
            </Label>
            <Select
              value={String(options.topK)}
              disabled={isBusy}
              onValueChange={(next) =>
                onOptionsChange({ ...options, topK: Number(next) })
              }
            >
              <SelectTrigger
                id="top-k"
                size="sm"
                className="h-7 w-[4.5rem] font-mono text-xs tabular"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOP_K_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)} className="font-mono tabular">
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Enter để gửi, Shift+Enter để xuống dòng. Một lượt tra cứu có thể mất vài phút.
        </p>
      </div>
    </div>
  );
}
