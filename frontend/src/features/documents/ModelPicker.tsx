import { AlertTriangle, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConnections } from "@/hooks/use-api";
import type { ModelConnection } from "@/lib/types";

/**
 * Chọn mô hình cho một bộ tài liệu.
 *
 * Đây là phần **bắt buộc**: bộ chưa chọn mô hình thì backend chặn upload
 * (409) và chặn tra cứu (400). Danh sách lấy từ Cấu hình chung, nên nếu trống
 * thì việc cần làm là sang đó thêm kết nối, không phải sửa gì ở đây.
 */
export function ModelPicker({
  vlmId,
  llmId,
  onVlmChange,
  onLlmChange,
  onOpenGeneralSettings,
}: {
  vlmId: string;
  llmId: string;
  onVlmChange: (id: string) => void;
  onLlmChange: (id: string) => void;
  onOpenGeneralSettings?: () => void;
}) {
  const { data, isLoading } = useConnections();

  const connections = data?.connections ?? [];
  const vlmOptions = connections.filter((c) => c.capabilities.includes("vlm"));
  const llmOptions = connections.filter((c) => c.capabilities.includes("llm"));

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Đang tải danh sách mô hình…</p>
    );
  }

  if (vlmOptions.length === 0 || llmOptions.length === 0) {
    const missing: string[] = [];
    if (vlmOptions.length === 0) missing.push("mô hình đọc ảnh");
    if (llmOptions.length === 0) missing.push("mô hình sửa mục lục");

    return (
      <div
        className="rounded-md border border-amber-500/30 bg-amber-500/[0.06] p-3"
        role="alert"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-amber-600"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">
              Chưa có {missing.join(" và ")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Bộ tài liệu phải chọn mô hình trước khi thêm được tài liệu. Vào Cấu
              hình chung thêm kết nối rồi quay lại đây.
            </p>
            {onOpenGeneralSettings && (
              <Button
                size="sm"
                className="mt-2.5"
                onClick={onOpenGeneralSettings}
              >
                <Settings className="size-3.5" aria-hidden />
                Mở Cấu hình chung
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ConnectionSelect
        id="pick-vlm"
        label="Mô hình đọc ảnh và trả lời"
        hint="Đọc trực tiếp ảnh-mục để soạn câu trả lời."
        options={vlmOptions}
        value={vlmId}
        onChange={onVlmChange}
      />
      <ConnectionSelect
        id="pick-llm"
        label="Mô hình sửa cây mục lục"
        hint="Chỉ dùng lúc phân tích tài liệu, có thể chọn model rẻ hơn."
        options={llmOptions}
        value={llmId}
        onChange={onLlmChange}
      />
    </div>
  );
}

function ConnectionSelect({
  id,
  label,
  hint,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  options: ModelConnection[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-8 text-sm">
          <SelectValue placeholder="Chọn mô hình" />
        </SelectTrigger>
        <SelectContent>
          {options.map((connection) => (
            <SelectItem key={connection.id} value={connection.id}>
              {connection.name}
              <span className="ml-1.5 text-muted-foreground">
                {connection.model_name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
