import { Check, KeyRound, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useConnections,
  useCreateConnection,
  useDeleteConnection,
  useUpdateConnection,
} from "@/hooks/use-api";
import type {
  Capability,
  ModelConnection,
  ProviderKind,
} from "@/lib/types";

import { EncryptionWarning } from "./ApiKeyField";

const PROVIDER_LABELS: Record<ProviderKind, string> = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  vllm: "vLLM tự host",
  custom: "Tuỳ chỉnh (tương thích OpenAI)",
};

const CAPABILITY_LABELS: Record<Capability, string> = {
  vlm: "Đọc ảnh, trả lời",
  llm: "Sửa cây mục lục",
};

interface FormState {
  name: string;
  provider: ProviderKind;
  endpoint: string;
  modelName: string;
  capabilities: Capability[];
  apiKey: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  provider: "openai",
  endpoint: "",
  modelName: "",
  capabilities: ["vlm", "llm"],
  apiKey: "",
};

/**
 * Quản lý kết nối mô hình — phần chính của Cấu hình chung.
 *
 * Đây là cấu hình *chung* vì key và endpoint giống nhau bất kể đang làm việc
 * với bộ tài liệu nào. Việc chọn dùng kết nối nào cho một bộ cụ thể thì thuộc
 * cấu hình của bộ đó.
 */
export function ConnectionsSection() {
  const { data, isLoading } = useConnections();
  const create = useCreateConnection();
  const update = useUpdateConnection();
  const remove = useDeleteConnection();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const connections = data?.connections ?? [];
  const defaultEndpoints = data?.default_endpoints ?? {};
  const providersWithoutKey = data?.providers_without_key ?? [];

  const hasVlm = connections.some((c) => c.capabilities.includes("vlm"));
  const hasLlm = connections.some((c) => c.capabilities.includes("llm"));

  const pendingError =
    create.error ?? update.error ?? remove.error ?? null;

  function closeForms() {
    setIsAdding(false);
    setEditingId(null);
    create.reset();
    update.reset();
  }

  if (isLoading) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Đang tải danh sách kết nối…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <EncryptionWarning enabled={data?.encryption_enabled ?? true} />

      {(!hasVlm || !hasLlm) && (
        <div
          className="rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2"
          role="status"
        >
          <p className="text-sm">
            Cần ít nhất một mô hình cho mỗi việc mới tạo được bộ tài liệu.
            {!hasVlm && " Còn thiếu mô hình đọc ảnh."}
            {!hasLlm && " Còn thiếu mô hình sửa mục lục."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Một mô hình đa phương thức như GPT-4o hay Gemini Flash làm được cả hai
            — tích cả hai ô khi thêm.
          </p>
        </div>
      )}

      {pendingError && (
        <div
          className="rounded-md border border-destructive/25 bg-destructive/[0.04] px-3 py-2"
          role="alert"
        >
          <p className="text-sm">{pendingError.message}</p>
        </div>
      )}

      {connections.length === 0 && !isAdding && (
        <div className="rounded-md border border-dashed px-4 py-8 text-center">
          <KeyRound
            className="mx-auto size-8 text-muted-foreground/60"
            aria-hidden
          />
          <p className="mt-2 text-sm font-medium">Chưa có kết nối mô hình nào</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Thêm một kết nối để bắt đầu. Chưa có mô hình thì không tạo được bộ tài
            liệu và không xử lý được PDF.
          </p>
          <Button className="mt-4" onClick={() => setIsAdding(true)}>
            <Plus className="size-4" aria-hidden />
            Thêm kết nối
          </Button>
        </div>
      )}

      {connections.length > 0 && (
        <ul className="divide-y rounded-md border">
          {connections.map((connection) =>
            editingId === connection.id ? (
              <li key={connection.id} className="p-3">
                <ConnectionForm
                  title={`Sửa "${connection.name}"`}
                  initial={{
                    name: connection.name,
                    provider: connection.provider as ProviderKind,
                    endpoint: connection.endpoint,
                    modelName: connection.model_name,
                    capabilities: connection.capabilities as Capability[],
                    apiKey: "",
                  }}
                  lockProvider
                  hasExistingKey={connection.has_key}
                  needsKey={!providersWithoutKey.includes(connection.provider)}
                  defaultEndpoints={defaultEndpoints}
                  isSaving={update.isPending}
                  onCancel={closeForms}
                  onSubmit={(form) => {
                    update.mutate(
                      {
                        id: connection.id,
                        input: {
                          name: form.name,
                          model_name: form.modelName,
                          endpoint: form.endpoint || undefined,
                          capabilities: form.capabilities,
                          // Bỏ trống thì giữ key cũ — server hiểu như vậy.
                          api_key: form.apiKey || undefined,
                        },
                      },
                      { onSuccess: closeForms },
                    );
                  }}
                />
              </li>
            ) : (
              <li key={connection.id}>
                <ConnectionRow
                  connection={connection}
                  isDeleting={remove.isPending}
                  onEdit={() => {
                    closeForms();
                    setEditingId(connection.id);
                  }}
                  onDelete={() => remove.mutate(connection.id)}
                />
              </li>
            ),
          )}
        </ul>
      )}

      {isAdding ? (
        <div className="rounded-md border p-3">
          <ConnectionForm
            title="Thêm kết nối mô hình"
            initial={EMPTY_FORM}
            needsKey={!providersWithoutKey.includes(EMPTY_FORM.provider)}
            defaultEndpoints={defaultEndpoints}
            providersWithoutKey={providersWithoutKey}
            isSaving={create.isPending}
            onCancel={closeForms}
            onSubmit={(form) => {
              create.mutate(
                {
                  name: form.name,
                  provider: form.provider,
                  model_name: form.modelName,
                  capabilities: form.capabilities,
                  endpoint: form.endpoint || undefined,
                  api_key: form.apiKey || undefined,
                },
                { onSuccess: closeForms },
              );
            }}
          />
        </div>
      ) : (
        connections.length > 0 && (
          <Button variant="outline" onClick={() => setIsAdding(true)}>
            <Plus className="size-4" aria-hidden />
            Thêm kết nối
          </Button>
        )
      )}
    </div>
  );
}

function ConnectionRow({
  connection,
  isDeleting,
  onEdit,
  onDelete,
}: {
  connection: ModelConnection;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-start justify-between gap-3 px-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium">{connection.name}</span>
          {connection.capabilities.map((capability) => (
            <Badge key={capability} variant="secondary" className="text-xs">
              {CAPABILITY_LABELS[capability as Capability] ?? capability}
            </Badge>
          ))}
        </div>

        <p className="mt-1 truncate text-sm text-muted-foreground">
          {PROVIDER_LABELS[connection.provider as ProviderKind] ??
            connection.provider}
          {" · "}
          <span className="font-mono">{connection.model_name}</span>
        </p>
        <p className="truncate font-mono text-xs text-muted-foreground/80">
          {connection.endpoint}
        </p>

        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {connection.has_key ? connection.masked_key : "không cần key"}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {confirming ? (
          <>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
            >
              {isDeleting ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-3.5" aria-hidden />
              )}
              Xoá
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
            >
              Huỷ
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="size-3.5" aria-hidden />
              Sửa
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setConfirming(true)}
              aria-label={`Xoá kết nối ${connection.name}`}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ConnectionForm({
  title,
  initial,
  lockProvider,
  hasExistingKey,
  needsKey,
  defaultEndpoints,
  providersWithoutKey = [],
  isSaving,
  onCancel,
  onSubmit,
}: {
  title: string;
  initial: FormState;
  lockProvider?: boolean;
  hasExistingKey?: boolean;
  needsKey: boolean;
  defaultEndpoints: Record<string, string>;
  providersWithoutKey?: string[];
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (form: FormState) => void;
}) {
  const [form, setForm] = useState<FormState>(() => ({
    ...initial,
    endpoint: initial.endpoint || defaultEndpoints[initial.provider] || "",
  }));

  const keyRequired =
    !providersWithoutKey.includes(form.provider) && needsKey && !hasExistingKey;

  const canSubmit =
    form.name.trim().length > 0 &&
    form.modelName.trim().length > 0 &&
    form.endpoint.trim().length > 0 &&
    form.capabilities.length > 0 &&
    (!keyRequired || form.apiKey.trim().length >= 8);

  function setProvider(provider: ProviderKind) {
    // Đổi nhà cung cấp thì gợi ý lại endpoint, trừ khi người dùng đã tự sửa.
    setForm((prev) => ({
      ...prev,
      provider,
      endpoint:
        prev.endpoint === defaultEndpoints[prev.provider] || !prev.endpoint
          ? (defaultEndpoints[provider] ?? "")
          : prev.endpoint,
    }));
  }

  function toggleCapability(capability: Capability) {
    setForm((prev) => ({
      ...prev,
      capabilities: prev.capabilities.includes(capability)
        ? prev.capabilities.filter((c) => c !== capability)
        : [...prev.capabilities, capability],
    }));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{title}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="cn-name" className="text-sm">
            Tên gọi
          </Label>
          <Input
            id="cn-name"
            autoFocus
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="GPT-4o của team"
            className="h-8 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Tên bạn sẽ thấy khi chọn mô hình cho bộ tài liệu.
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="cn-provider" className="text-sm">
            Nhà cung cấp
          </Label>
          <Select
            value={form.provider}
            onValueChange={(value) => setProvider(value as ProviderKind)}
            disabled={lockProvider}
          >
            <SelectTrigger id="cn-provider" className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PROVIDER_LABELS) as ProviderKind[]).map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {PROVIDER_LABELS[provider]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {lockProvider && (
            <p className="text-xs text-muted-foreground">
              Đổi nhà cung cấp thì tạo kết nối mới thay vì sửa.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="cn-endpoint" className="text-sm">
            Endpoint
          </Label>
          <Input
            id="cn-endpoint"
            value={form.endpoint}
            onChange={(e) => setForm((p) => ({ ...p, endpoint: e.target.value }))}
            placeholder="https://api.openai.com/v1"
            className="h-8 font-mono text-sm"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="cn-model" className="text-sm">
            Tên model
          </Label>
          <Input
            id="cn-model"
            value={form.modelName}
            onChange={(e) => setForm((p) => ({ ...p, modelName: e.target.value }))}
            placeholder="gpt-4o"
            className="h-8 font-mono text-sm"
          />
        </div>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm">Dùng được cho việc gì</legend>
        {(Object.keys(CAPABILITY_LABELS) as Capability[]).map((capability) => (
          <label
            key={capability}
            className="flex items-center gap-2 text-sm"
            htmlFor={`cap-${capability}`}
          >
            <Checkbox
              id={`cap-${capability}`}
              checked={form.capabilities.includes(capability)}
              onCheckedChange={() => toggleCapability(capability)}
            />
            {CAPABILITY_LABELS[capability]}
          </label>
        ))}
        {form.capabilities.length === 0 && (
          <p className="text-xs text-destructive">Chọn ít nhất một việc.</p>
        )}
      </fieldset>

      {(needsKey || form.apiKey) && (
        <div className="space-y-1">
          <Label htmlFor="cn-key" className="text-sm">
            API key
            {hasExistingKey && " (bỏ trống để giữ key hiện tại)"}
          </Label>
          <Input
            id="cn-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={form.apiKey}
            onChange={(e) => setForm((p) => ({ ...p, apiKey: e.target.value }))}
            placeholder={hasExistingKey ? "••••••••" : "Dán key vào đây"}
            className="h-8 font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Key gửi lên server rồi mã hoá lưu lại. Sau khi lưu chỉ xem được vài ký
            tự cuối, không xem lại được toàn bộ.
          </p>
        </div>
      )}

      <div className="flex gap-1.5">
        <Button
          size="sm"
          onClick={() =>
            onSubmit({
              ...form,
              name: form.name.trim(),
              modelName: form.modelName.trim(),
              endpoint: form.endpoint.trim(),
              apiKey: form.apiKey.trim(),
            })
          }
          disabled={!canSubmit || isSaving}
        >
          {isSaving ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Check className="size-3.5" aria-hidden />
          )}
          Lưu
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
          <X className="size-3.5" aria-hidden />
          Huỷ
        </Button>
      </div>
    </div>
  );
}
