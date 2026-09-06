import { Check, KeyRound, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Nhập API key cho một provider.
 *
 * Key gốc chỉ đi một chiều lên server. Sau khi lưu, giao diện chỉ nhận lại
 * bản che (`sk-proj-••••4f2a`) và không có cách nào xem lại key đầy đủ.
 * Muốn đổi thì nhập lại từ đầu.
 */
export function ApiKeyField({
  providerLabel,
  maskedKey,
  keySource,
  canDelete,
  needsEndpoint,
  currentModel,
  currentEndpoint,
  isSaving,
  onSave,
  onDelete,
}: {
  providerLabel: string;
  maskedKey: string | null;
  keySource: string;
  canDelete: boolean;
  needsEndpoint?: boolean;
  currentModel?: string | null;
  currentEndpoint?: string | null;
  isSaving: boolean;
  onSave: (payload: {
    apiKey: string;
    modelName?: string;
    endpoint?: string;
  }) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState(currentModel ?? "");
  const [endpoint, setEndpoint] = useState(currentEndpoint ?? "");

  const hasKey = Boolean(maskedKey);
  const canSubmit =
    apiKey.trim().length >= 8 && (!needsEndpoint || endpoint.trim().length > 0);

  function cancel() {
    setIsEditing(false);
    setApiKey("");
  }

  function submit() {
    if (!canSubmit) return;
    onSave({
      apiKey: apiKey.trim(),
      modelName: modelName.trim() || undefined,
      endpoint: endpoint.trim() || undefined,
    });
    setIsEditing(false);
    setApiKey("");
  }

  if (!isEditing) {
    return (
      <div className="flex items-start justify-between gap-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <KeyRound className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="text-sm">API key</span>
            {hasKey && keySource === "env" && (
              <span className="rounded-sm bg-muted px-1.5 py-px text-xs text-muted-foreground">
                từ .env
              </span>
            )}
          </div>

          {hasKey ? (
            <p className="mt-1 font-mono text-sm text-muted-foreground">{maskedKey}</p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Chưa có key</p>
          )}

          {keySource === "env" && hasKey && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Key này đến từ biến môi trường. Nhập key mới ở đây sẽ đè lên nó.
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-1">
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Pencil className="size-3.5" aria-hidden />
            {hasKey ? "Đổi" : "Nhập"}
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onDelete}
              aria-label={`Xoá key của ${providerLabel}`}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 py-3">
      <div className="space-y-1">
        <Label htmlFor={`key-${providerLabel}`} className="text-sm">
          API key cho {providerLabel}
        </Label>
        <Input
          id={`key-${providerLabel}`}
          type="password"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") cancel();
          }}
          placeholder="Dán key vào đây"
          className="h-8 font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Key gửi lên server rồi mã hoá lưu lại. Sau khi lưu chỉ xem được vài ký tự
          cuối, không xem lại được toàn bộ.
        </p>
      </div>

      {needsEndpoint && (
        <div className="space-y-1">
          <Label htmlFor={`endpoint-${providerLabel}`} className="text-sm">
            Endpoint
          </Label>
          <Input
            id={`endpoint-${providerLabel}`}
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https://vlm.noi-bo/v1"
            className="h-8 font-mono text-sm"
          />
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor={`model-${providerLabel}`} className="text-sm">
          Model {!needsEndpoint && "(để trống thì dùng mặc định)"}
        </Label>
        <Input
          id={`model-${providerLabel}`}
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          placeholder={currentModel ?? "gpt-4o"}
          className="h-8 font-mono text-sm"
        />
      </div>

      <div className="flex gap-1.5">
        <Button size="sm" onClick={submit} disabled={!canSubmit || isSaving}>
          {isSaving ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Check className="size-3.5" aria-hidden />
          )}
          Lưu
        </Button>
        <Button variant="ghost" size="sm" onClick={cancel} disabled={isSaving}>
          <X className="size-3.5" aria-hidden />
          Huỷ
        </Button>
      </div>
    </div>
  );
}

/** Cảnh báo khi server chưa bật mã hoá at-rest. */
export function EncryptionWarning({ enabled }: { enabled: boolean }) {
  if (enabled) return null;

  return (
    <div
      className={cn(
        "rounded-md border border-destructive/25 bg-destructive/[0.04] px-3 py-2",
      )}
      role="alert"
    >
      <p className="text-sm text-muted-foreground">
        Chưa đặt <code className="font-mono">CREDENTIALS_SECRET</code> nên key lưu
        dạng thô trên đĩa. Đặt biến đó trong <code className="font-mono">.env</code>{" "}
        rồi khởi động lại backend để bật mã hoá.
      </p>
    </div>
  );
}
