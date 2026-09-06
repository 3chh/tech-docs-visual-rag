import { FilePlus2, FolderPlus, Loader2, Settings2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateCollection } from "@/hooks/use-api";
import { ApiError, ERR_NO_MODELS } from "@/lib/api";

import {
  countOverrides,
  EMPTY_DRAFT,
  slugify,
  type CollectionDraft,
} from "./collection-config";
import { CollectionConfigFields } from "./CollectionConfigFields";
import { ModelPicker } from "./ModelPicker";

interface CreateCollectionDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated?: (collectionId: string) => void;
  /** Mở Cấu hình chung khi chưa có mô hình nào. */
  onOpenGeneralSettings?: () => void;
  trigger?: React.ReactNode;
}

/**
 * Tạo bộ tài liệu mới.
 *
 * Cấu hình lưu trên server qua `POST /collections`, không phải localStorage:
 * backend cần nó để áp lúc index, và cả team phải thấy cùng một cấu hình.
 */
export function CreateCollectionDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onCreated,
  onOpenGeneralSettings,
  trigger,
}: CreateCollectionDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;
  const setIsOpen = isControlled ? controlledOnOpenChange! : setUncontrolledOpen;

  const [displayName, setDisplayName] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [idTouched, setIdTouched] = useState(false);
  const [vlmId, setVlmId] = useState("");
  const [llmId, setLlmId] = useState("");
  const [draft, setDraft] = useState<CollectionDraft>(EMPTY_DRAFT);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const create = useCreateCollection();

  const overrideCount = countOverrides(draft);
  const canSubmit = Boolean(collectionId.trim() && vlmId && llmId);

  const error = create.error instanceof ApiError ? create.error : null;
  const needsModels = error?.code === ERR_NO_MODELS;

  function reset() {
    setDisplayName("");
    setCollectionId("");
    setIdTouched(false);
    setVlmId("");
    setLlmId("");
    setDraft(EMPTY_DRAFT);
    setShowAdvanced(false);
    create.reset();
  }

  function submit() {
    if (!canSubmit) return;

    create.mutate(
      {
        name: collectionId.trim(),
        vlm_connection_id: vlmId,
        llm_connection_id: llmId,
        description: displayName.trim(),
        processing: draft.processing,
        ask: draft.ask,
      },
      {
        onSuccess: (config) => {
          onCreated?.(config.name);
          setIsOpen(false);
          reset();
        },
      },
    );
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next);
        if (!next) reset();
      }}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <DialogHeader className="border-b bg-card/60 px-6 pt-5 pb-3 text-left">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
              <FolderPlus className="size-4" aria-hidden />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Tạo bộ tài liệu mới
              </DialogTitle>
              <DialogDescription className="text-sm">
                Chọn mô hình trước, rồi mới thêm được tài liệu vào bộ.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {error && (
            <div
              className="rounded-md border border-destructive/30 bg-destructive/[0.06] p-3"
              role="alert"
            >
              <p className="text-sm">{error.message}</p>
              {needsModels && onOpenGeneralSettings && (
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenGeneralSettings();
                  }}
                >
                  <Settings2 className="size-3.5" aria-hidden />
                  Mở Cấu hình chung
                </Button>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="col-name" className="text-sm">
              Tên bộ tài liệu
            </Label>
            <Input
              id="col-name"
              autoFocus
              placeholder="Tiêu chuẩn Xây dựng 2024"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (!idTouched) setCollectionId(slugify(e.target.value));
              }}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="col-id" className="text-sm">
              Mã định danh
            </Label>
            <Input
              id="col-id"
              value={collectionId}
              onChange={(e) => {
                setIdTouched(true);
                setCollectionId(e.target.value);
                create.reset();
              }}
              className="h-8 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Dùng làm tên thư mục và tên collection trong vector DB, nên chỉ chữ
              không dấu, số, gạch ngang và gạch dưới. Không đổi được sau khi tạo.
            </p>
          </div>

          <div className="border-t pt-4">
            <ModelPicker
              vlmId={vlmId}
              llmId={llmId}
              onVlmChange={setVlmId}
              onLlmChange={setLlmId}
              onOpenGeneralSettings={
                onOpenGeneralSettings &&
                (() => {
                  setIsOpen(false);
                  onOpenGeneralSettings();
                })
              }
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Settings2 className="size-3.5 text-emerald-600" aria-hidden />
                Tham số xử lý
                {overrideCount > 0 && (
                  <span className="text-muted-foreground">
                    ({overrideCount} đã đổi)
                  </span>
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? "Thu gọn" : "Tuỳ chỉnh"}
              </Button>
            </div>

            {showAdvanced ? (
              <div className="mt-3">
                <CollectionConfigFields draft={draft} onChange={setDraft} />
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Để nguyên thì dùng mặc định của server. Sửa được sau khi tạo.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="border-t bg-muted/15 px-6 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(false)}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={!canSubmit || create.isPending}
          >
            {create.isPending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <FilePlus2 className="size-3.5" aria-hidden />
            )}
            Tạo bộ tài liệu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
