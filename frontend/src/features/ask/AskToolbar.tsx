import { Wand2 } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import type { AskOptions } from "./AskComposer";

const TOP_K_OPTIONS = [3, 5, 8, 12];

/**
 * Tuỳ chọn tra cứu, đặt trên đầu khu vực.
 *
 * Đây là thứ người dùng đặt một lần rồi ít đổi, nên không nhồi vào khung nhập
 * câu hỏi ở dưới.
 */
export function AskToolbar({
  options,
  onChange,
  disabled,
}: {
  options: AskOptions;
  onChange: (options: AskOptions) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b bg-muted/40 px-6 py-2.5">
      <div className="flex items-center gap-2">
        <Switch
          id="toc-rewrite"
          checked={options.useTocRewrite}
          disabled={disabled}
          onCheckedChange={(checked) => onChange({ ...options, useTocRewrite: checked })}
        />
        <Label
          htmlFor="toc-rewrite"
          className="flex cursor-pointer items-center gap-1.5 text-[15px] font-normal"
        >
          <Wand2 className="size-4 text-muted-foreground" aria-hidden />
          Chuẩn hoá thuật ngữ theo mục lục
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="top-k" className="text-[15px] font-normal">
          Số mục lấy về
        </Label>
        <Select
          value={String(options.topK)}
          disabled={disabled}
          onValueChange={(next) => onChange({ ...options, topK: Number(next) })}
        >
          <SelectTrigger
            id="top-k"
            size="sm"
            className="h-8 w-[4.75rem] bg-card font-mono text-[15px] tabular"
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
  );
}
