import { FolderPlus, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Màn hình khi chưa có bộ tài liệu nào.
 *
 * Nói rõ thứ tự bắt buộc: thêm mô hình trước, rồi tạo bộ, rồi mới tải tài
 * liệu. Nếu chưa có mô hình thì nút tạo bộ vô nghĩa nên dẫn thẳng sang Cấu
 * hình chung.
 */
export function NoCollectionState({
  missingCapabilities,
  onCreate,
  onOpenSettings,
}: {
  /** Loại mô hình còn thiếu, từ `GET /collections`. */
  missingCapabilities: string[];
  onCreate: () => void;
  onOpenSettings: () => void;
}) {
  const needsModels = missingCapabilities.length > 0;

  const missingLabel = missingCapabilities
    .map((c) => (c === "vlm" ? "mô hình đọc ảnh" : "mô hình sửa mục lục"))
    .join(" và ");

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
          <FolderPlus className="size-6" aria-hidden />
        </div>

        <h2 className="mt-3 text-base font-semibold">Chưa có bộ tài liệu nào</h2>

        <p className="mt-1.5 text-sm text-muted-foreground">
          Tài liệu được quản lý theo bộ. Mỗi bộ chọn mô hình và tham số xử lý
          riêng, vì bộ sách scan cần cấu hình khác bộ PDF số hoá.
        </p>

        <ol className="mt-4 space-y-1.5 text-left text-sm">
          <Step index={1} done={!needsModels}>
            Thêm mô hình trong Cấu hình chung
            {needsModels && (
              <span className="text-muted-foreground"> — còn thiếu {missingLabel}</span>
            )}
          </Step>
          <Step index={2} done={false}>
            Tạo bộ tài liệu và chọn mô hình cho nó
          </Step>
          <Step index={3} done={false}>
            Tải PDF lên bộ đó
          </Step>
        </ol>

        <div className="mt-5 flex justify-center gap-2">
          {needsModels ? (
            <Button onClick={onOpenSettings}>
              <Settings className="size-4" aria-hidden />
              Mở Cấu hình chung
            </Button>
          ) : (
            <Button onClick={onCreate}>
              <FolderPlus className="size-4" aria-hidden />
              Tạo bộ tài liệu
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Step({
  index,
  done,
  children,
}: {
  index: number;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={
          done
            ? "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-medium text-white"
            : "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium text-muted-foreground"
        }
        aria-hidden
      >
        {done ? "✓" : index}
      </span>
      <span className={done ? "text-muted-foreground" : undefined}>{children}</span>
    </li>
  );
}
