import { AlertTriangle, Check, FileSliders, Loader2, Lock } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollectionConfig, useUpdateCollection } from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import type { CollectionEmbedding, CollectionOut } from "@/lib/types";

import {
  countOverrides,
  EMPTY_DRAFT,
  type CollectionDraft,
} from "./collection-config";
import { CollectionConfigFields } from "./CollectionConfigFields";
import { ModelPicker } from "./ModelPicker";

/**
 * Sửa cấu hình của một bộ tài liệu đã tạo.
 *
 * Lưu qua `PUT /collections/{name}` nên cả team thấy cùng cấu hình và backend
 * áp được lúc index. Trước đây phần này ghi vào localStorage, nghĩa là server
 * không bao giờ biết và cấu hình mất khi đổi máy.
 */
export function CollectionSettingsDialog({
  collection,
  open,
  onOpenChange,
  onSaved,
  onOpenGeneralSettings,
}: {
  collection: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (config: CollectionOut) => void;
  onOpenGeneralSettings?: () => void;
}) {
  const { data: config, isLoading } = useCollectionConfig(open ? collection : undefined);
  const update = useUpdateCollection();

  const [draft, setDraft] = useState<CollectionDraft>(EMPTY_DRAFT);
  const [description, setDescription] = useState("");
  const [vlmId, setVlmId] = useState("");
  const [llmId, setLlmId] = useState("");

  // Nạp lại từ server mỗi lần mở hoặc đổi bộ: server là nguồn sự thật.
  useEffect(() => {
    if (!config) return;
    // embedding không vào draft: nó đóng băng, chỉ hiển thị.
    setDraft({ processing: config.processing, ask: config.ask, embedding: {} });
    setDescription(config.description);
    setVlmId(config.vlm_connection_id);
    setLlmId(config.llm_connection_id);
    update.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.name, config?.updated_at, open]);

  const error = update.error instanceof ApiError ? update.error : null;
  const overrideCount = countOverrides(draft);

  function submit() {
    update.mutate(
      {
        name: collection,
        input: {
          description,
          vlm_connection_id: vlmId || undefined,
          llm_connection_id: llmId || undefined,
          processing: draft.processing,
          ask: draft.ask,
        },
      },
      {
        onSuccess: (saved) => {
          onSaved?.(saved);
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <DialogHeader className="border-b bg-card/60 px-6 pt-5 pb-3 text-left">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
              <FileSliders className="size-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold">
                Cấu hình bộ tài liệu
              </DialogTitle>
              <DialogDescription className="truncate font-mono text-sm">
                {collection}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {isLoading ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !config ? (
            <div
              className="rounded-md border border-amber-500/30 bg-amber-500/[0.06] p-3"
              role="alert"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0 text-amber-600"
                  aria-hidden
                />
                <p className="text-sm">
                  Bộ <span className="font-mono">{collection}</span> chưa được cấu
                  hình trên server. Tạo lại bộ này để chọn mô hình cho nó — chưa
                  có cấu hình thì không thêm được tài liệu.
                </p>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div
                  className="rounded-md border border-destructive/30 bg-destructive/[0.06] p-3"
                  role="alert"
                >
                  <p className="text-sm">{error.message}</p>
                </div>
              )}

              {!config.is_ready && config.blocked_reason && (
                <div
                  className="rounded-md border border-destructive/30 bg-destructive/[0.06] p-3"
                  role="alert"
                >
                  <p className="text-sm">{config.blocked_reason}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Chọn lại mô hình bên dưới rồi lưu.
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="col-desc" className="text-sm">
                  Tên hiển thị
                </Label>
                <Input
                  id="col-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tiêu chuẩn Xây dựng 2024"
                  className="h-8 text-sm"
                />
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
                      onOpenChange(false);
                      onOpenGeneralSettings();
                    })
                  }
                />
              </div>

              <div className="border-t pt-4">
                <FrozenEmbedding embedding={config.embedding} />
              </div>

              <div className="border-t pt-4">
                <p className="mb-2 text-sm font-medium">
                  Tham số xử lý
                  {overrideCount > 0 && (
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      ({overrideCount} đã đổi)
                    </span>
                  )}
                </p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Tham số áp cho tài liệu thêm vào <em>từ giờ</em>. Tài liệu đã
                  index vẫn giữ tham số lúc index — muốn đổi thì index lại.
                </p>
                <CollectionConfigFields draft={draft} onChange={setDraft} />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="border-t bg-muted/15 px-6 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={!config || update.isPending}
          >
            {update.isPending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Check className="size-3.5" aria-hidden />
            )}
            Lưu cấu hình
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/**
 * Cấu hình embedding của bộ — chỉ đọc.
 *
 * Không phải "chưa làm nút sửa": vector của bộ này được tạo bằng đúng những
 * tham số này, đổi chúng là mọi vector cũ không so được với vector mới. Muốn
 * tham số khác thì tạo bộ mới và index lại.
 */
function FrozenEmbedding({ embedding }: { embedding: CollectionEmbedding }) {
  const rows: [string, string][] = [
    ["Loại", embedding.type ?? "—"],
    ["Model", embedding.model_name ?? "—"],
    [
      "Token thị giác mỗi trang",
      embedding.max_num_visual_tokens != null
        ? String(embedding.max_num_visual_tokens)
        : "—",
    ],
  ];

  if (embedding.min_width != null) {
    rows.push(["Chiều rộng tối thiểu", `${embedding.min_width} px`]);
  }

  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-sm font-medium">
        <Lock className="size-3.5 text-muted-foreground" aria-hidden />
        Embedding
      </p>
      <p className="mb-2.5 text-xs text-muted-foreground">
        Vector của bộ này được tạo bằng đúng các tham số dưới đây, nên chúng
        không sửa được. Cần tham số khác thì tạo bộ mới rồi index lại.
      </p>

      <dl className="divide-y rounded-md border bg-muted/20 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-3 px-3 py-2">
            <dt className="shrink-0 text-muted-foreground">{label}</dt>
            <dd className="min-w-0 flex-1 truncate text-right font-mono text-xs">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
