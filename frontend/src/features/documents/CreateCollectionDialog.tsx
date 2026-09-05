import {
  FilePlus2,
  FolderPlus,
  Settings2,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BooleanRow,
  NumberRow,
} from "@/features/settings/SettingRow";
import {
  DEFAULT_COLLECTION_CONFIG,
  LIMITS,
  saveCollectionConfig,
  type CollectionConfig,
} from "@/features/settings/types";

interface CreateCollectionDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated?: (collectionId: string) => void;
  trigger?: React.ReactNode;
}

export function CreateCollectionDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onCreated,
  trigger,
}: CreateCollectionDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;
  const setIsOpen = isControlled ? controlledOnOpenChange! : setUncontrolledOpen;

  const [collectionId, setCollectionId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [config, setConfig] = useState<CollectionConfig>(DEFAULT_COLLECTION_CONFIG);
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    const rawId = collectionId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    if (!rawId) {
      setError("Vui lòng nhập mã định danh bộ tài liệu.");
      return;
    }

    // Lưu cấu hình xử lý cho bộ tài liệu này
    saveCollectionConfig(rawId, config);

    onCreated?.(rawId);
    setIsOpen(false);
    setCollectionId("");
    setDisplayName("");
    setShowAdvanced(false);
    setError(null);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="sm:max-w-[540px] max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b bg-card/60">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
              <FolderPlus className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold">
                Tạo Bộ Tài liệu Mới
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="col-name" className="text-xs font-medium">
              Tên hiển thị bộ tài liệu
            </Label>
            <Input
              id="col-name"
              placeholder="Ví dụ: Tiêu chuẩn Xây dựng 2024"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (!collectionId) {
                  setCollectionId(
                    e.target.value
                      .toLowerCase()
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^a-z0-9]/g, "_")
                      .replace(/_+/g, "_")
                      .slice(0, 32),
                  );
                }
              }}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="col-id" className="text-xs font-medium">
              Mã định danh (ID)
            </Label>
            <Input
              id="col-id"
              placeholder="ví dụ: tcvn_2024"
              value={collectionId}
              onChange={(e) => {
                setCollectionId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "_"));
                setError(null);
              }}
              className="h-8 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Chỉ dùng chữ cái không dấu, số, dấu gạch dưới.
            </p>
          </div>

          {/* Tuỳ biến cấu hình xử lý ban đầu */}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Settings2 className="size-3.5 text-emerald-600" />
                <span>Cấu hình tiền xử lý & cắt lát</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? "Thu gọn" : "Tuỳ chỉnh"}
              </Button>
            </div>

            {showAdvanced && (
              <div className="mt-3 space-y-3 rounded-lg border bg-muted/15 p-3.5 animate-in fade-in">
                <NumberRow
                  label="Độ phân giải render (DPI)"
                  value={config.preprocess.dpi}
                  min={LIMITS.dpi.min}
                  max={LIMITS.dpi.max}
                  step={10}
                  unit="DPI"
                  tooltip="Độ nét khi quét tài liệu thành ảnh."
                  onChange={(v: number) =>
                    setConfig((prev) => ({
                      ...prev,
                      preprocess: { ...prev.preprocess, dpi: v },
                    }))
                  }
                />

                <BooleanRow
                  label="Tự động tách đôi trang scan"
                  value={config.preprocess.vertical_split}
                  tooltip="Tách các trang scan gồm 2 trang sách thành 2 trang độc lập."
                  onChange={(v: boolean) =>
                    setConfig((prev) => ({
                      ...prev,
                      preprocess: { ...prev.preprocess, vertical_split: v },
                    }))
                  }
                />

                <NumberRow
                  label="Khoảng bù viền cắt lát (Cut Padding)"
                  value={config.chunking.cut_padding}
                  min={LIMITS.chunk_cut_padding.min}
                  max={LIMITS.chunk_cut_padding.max}
                  unit="px"
                  tooltip="Bù thêm lề ngoài cho lát cắt điều khoản để tránh sát mép chữ."
                  onChange={(v: number) =>
                    setConfig((prev) => ({
                      ...prev,
                      chunking: { ...prev.chunking, cut_padding: v },
                    }))
                  }
                />

                <NumberRow
                  label="Số mục trích dẫn tối đa (Top-K)"
                  value={config.retrieval.top_k}
                  min={LIMITS.top_k.min}
                  max={LIMITS.top_k.max}
                  tooltip="Số lượng ảnh cắt lát lấy ra khi trả lời câu hỏi."
                  onChange={(v: number) =>
                    setConfig((prev) => ({
                      ...prev,
                      retrieval: { ...prev.retrieval, top_k: v },
                    }))
                  }
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t bg-muted/15 px-6 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-8 text-xs"
          >
            Hủy
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleCreate}
            disabled={!collectionId.trim()}
            className="h-8 text-xs gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 font-medium"
          >
            <FilePlus2 className="size-3.5" />
            <span>Tạo bộ tài liệu</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
