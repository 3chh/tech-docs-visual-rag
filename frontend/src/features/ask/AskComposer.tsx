import { ArrowUp, Loader2 } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const MAX_TEXTAREA_HEIGHT = 180;

/**
 * Khung nhập câu hỏi. Chỉ có ô nhập và nút gửi.
 *
 * Các tuỳ chọn (chuẩn hoá thuật ngữ, số mục lấy về) nằm trên thanh công cụ ở
 * đầu trang, không nhồi vào đây.
 */
export function AskComposer({
  value,
  onChange,
  onSubmit,
  isBusy,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isBusy: boolean;
  placeholder: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function autoGrow(element: HTMLTextAreaElement) {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }

  return (
    <div className="shrink-0 border-t bg-background">
      <div className="mx-auto w-full max-w-[48rem] px-6 py-4">
        <div className="relative flex items-center rounded-xl border bg-card shadow-xs transition-all focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25 px-3 py-1.5">
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
              "w-full resize-none border-0 bg-transparent py-1.5 pl-1 pr-3",
              "text-[15px] leading-relaxed placeholder:text-muted-foreground",
              "focus:outline-none focus-visible:ring-0",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          />
          <Button
            size="icon"
            className={cn(
              "shrink-0 size-8 self-center rounded-lg transition-colors",
              "disabled:!opacity-100 disabled:bg-muted disabled:text-muted-foreground",
            )}
            onClick={onSubmit}
            disabled={isBusy || !value.trim()}
            aria-label="Gửi câu hỏi"
          >
            {isBusy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <ArrowUp className="size-4" aria-hidden />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
