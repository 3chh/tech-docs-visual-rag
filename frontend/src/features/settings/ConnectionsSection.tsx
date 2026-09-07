import { Check, KeyRound, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { useI18n } from "@/lib/i18n";
import type {
  Capability,
  ModelConnection,
  ProviderKind,
} from "@/lib/types";

import { EncryptionWarning } from "./ApiKeyField";

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
 * Quản lý kết nối mô hình — chuẩn hoá song ngữ hoàn chỉnh.
 */
export function ConnectionsSection() {
  const { t, language } = useI18n();
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

  const getProviderLabel = (p: ProviderKind) => {
    if (p === "openai") return "OpenAI";
    if (p === "gemini") return "Google Gemini";
    if (p === "vllm") return `vLLM (${t("conn_self_hosted_badge")})`;
    return language === "vi" ? "Tuỳ chỉnh (OpenAI-compatible)" : "Custom (OpenAI-compatible)";
  };

  const getCapabilityLabel = (c: Capability) => {
    return c === "vlm" ? t("conn_cap_vlm") : t("conn_cap_llm");
  };

  if (isLoading) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {language === "vi" ? "Đang tải danh sách kết nối…" : "Loading connections…"}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <EncryptionWarning enabled={data?.encryption_enabled ?? true} />

      {(!hasVlm || !hasLlm) && (
        <div
          className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-xs"
          role="status"
        >
          <p className="font-medium text-amber-800 dark:text-amber-300">
            {language === "vi"
              ? "Cần cấu hình tối thiểu một kết nối cho mỗi tác vụ để tạo bộ tài liệu:"
              : "At least one connection is required for each capability:"}
            {!hasVlm && (language === "vi" ? " Còn thiếu mô hình đọc ảnh (VLM)." : " Missing Vision model (VLM).")}
            {!hasLlm && (language === "vi" ? " Còn thiếu mô hình sửa mục lục (LLM)." : " Missing Outline model (LLM).")}
          </p>
          <p className="mt-1 text-muted-foreground">
            {language === "vi"
              ? "Mô hình đa phương thức như GPT-4o, Gemini Flash hoặc InternVL3-8B có thể đảm nhiệm cả 2 việc."
              : "Multimodal models such as GPT-4o, Gemini Flash, or InternVL3-8B can serve both purposes."}
          </p>
        </div>
      )}

      {pendingError && (
        <div
          className="rounded-lg border border-destructive/25 bg-destructive/[0.04] p-3 text-xs text-destructive"
          role="alert"
        >
          <p>{pendingError.message}</p>
        </div>
      )}

      {connections.length === 0 && !isAdding && (
        <div className="rounded-xl border border-dashed p-8 text-center bg-muted/10">
          <KeyRound
            className="mx-auto size-8 text-muted-foreground/60"
            aria-hidden
          />
          <p className="mt-2 text-sm font-semibold">{t("conn_empty_title")}</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
            {t("conn_empty_desc")}
          </p>
          <Button
            size="sm"
            className="mt-4 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="size-3.5" aria-hidden />
            <span>{t("conn_add_btn")}</span>
          </Button>
        </div>
      )}

      {connections.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card shadow-2xs overflow-hidden">
          {connections.map((connection) =>
            editingId === connection.id ? (
              <li key={connection.id} className="p-4 bg-muted/20">
                <ConnectionForm
                  title={`${language === "vi" ? "Chỉnh sửa" : "Edit"} "${connection.name}"`}
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
                  getProviderLabel={getProviderLabel}
                  getCapabilityLabel={getCapabilityLabel}
                  onSubmit={(form) => {
                    update.mutate(
                      {
                        id: connection.id,
                        input: {
                          name: form.name,
                          model_name: form.modelName,
                          endpoint: form.endpoint || undefined,
                          capabilities: form.capabilities,
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
                  getProviderLabel={getProviderLabel}
                  getCapabilityLabel={getCapabilityLabel}
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
        <div className="rounded-xl border p-4 bg-muted/15 shadow-2xs">
          <ConnectionForm
            title={t("conn_add_btn")}
            initial={EMPTY_FORM}
            needsKey={!providersWithoutKey.includes(EMPTY_FORM.provider)}
            defaultEndpoints={defaultEndpoints}
            providersWithoutKey={providersWithoutKey}
            isSaving={create.isPending}
            onCancel={closeForms}
            getProviderLabel={getProviderLabel}
            getCapabilityLabel={getCapabilityLabel}
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
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="size-3.5" aria-hidden />
            <span>{t("conn_add_btn")}</span>
          </Button>
        )
      )}
    </div>
  );
}

function ConnectionRow({
  connection,
  isDeleting,
  getProviderLabel,
  getCapabilityLabel,
  onEdit,
  onDelete,
}: {
  connection: ModelConnection;
  isDeleting: boolean;
  getProviderLabel: (p: ProviderKind) => string;
  getCapabilityLabel: (c: Capability) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t, language } = useI18n();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{connection.name}</span>
          {connection.capabilities.map((capability) => (
            <Badge
              key={capability}
              variant="secondary"
              className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium"
            >
              {getCapabilityLabel(capability as Capability)}
            </Badge>
          ))}
        </div>

        <p className="mt-1 truncate text-xs text-muted-foreground">
          <span className="font-medium text-foreground/90">{getProviderLabel(connection.provider as ProviderKind)}</span>
          {" · "}
          <span className="font-mono text-emerald-600 dark:text-emerald-400">{connection.model_name}</span>
        </p>
        <p className="truncate font-mono text-[11px] text-muted-foreground/80">
          {connection.endpoint}
        </p>

        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          {connection.has_key ? connection.masked_key : (language === "vi" ? "không cần khóa API" : "no API key required")}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {confirming ? (
          <>
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs px-2.5"
              disabled={isDeleting}
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
            >
              {isDeleting ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-3" aria-hidden />
              )}
              <span>{language === "vi" ? "Xác nhận xóa" : "Confirm Delete"}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setConfirming(false)}
            >
              {t("conn_cancel_btn")}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs px-2.5"
              onClick={onEdit}
            >
              <Pencil className="size-3 text-muted-foreground" aria-hidden />
              <span>{language === "vi" ? "Sửa" : "Edit"}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
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
  getProviderLabel,
  getCapabilityLabel,
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
  getProviderLabel: (p: ProviderKind) => string;
  getCapabilityLabel: (c: Capability) => string;
  onCancel: () => void;
  onSubmit: (form: FormState) => void;
}) {
  const { t, language } = useI18n();
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
    <div className="space-y-3.5">
      <p className="text-xs font-bold uppercase tracking-wider text-foreground">{title}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="cn-name" className="text-xs font-medium">
            {t("conn_name_label")}
          </Label>
          <Input
            id="cn-name"
            autoFocus
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder={language === "vi" ? "Ví dụ: GPT-4o của team" : "e.g. Team GPT-4o"}
            className="h-8 text-xs"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="cn-provider" className="text-xs font-medium">
            {t("conn_provider_label")}
          </Label>
          <Select
            value={form.provider}
            onValueChange={(value) => setProvider(value as ProviderKind)}
            disabled={lockProvider}
          >
            <SelectTrigger id="cn-provider" className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["openai", "gemini", "vllm", "custom"] as ProviderKind[]).map((provider) => (
                <SelectItem key={provider} value={provider} className="text-xs">
                  {getProviderLabel(provider)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="cn-endpoint" className="text-xs font-medium">
            {t("conn_endpoint_label")}
          </Label>
          <Input
            id="cn-endpoint"
            value={form.endpoint}
            onChange={(e) => setForm((p) => ({ ...p, endpoint: e.target.value }))}
            placeholder="https://api.openai.com/v1"
            className="h-8 font-mono text-xs"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="cn-model" className="text-xs font-medium">
            {t("conn_model_label")}
          </Label>
          <Input
            id="cn-model"
            value={form.modelName}
            onChange={(e) => setForm((p) => ({ ...p, modelName: e.target.value }))}
            placeholder="gpt-4o"
            className="h-8 font-mono text-xs"
          />
        </div>
      </div>

      <fieldset className="space-y-1.5 border-t pt-2">
        <legend className="text-xs font-medium text-foreground">{t("conn_capabilities_label")}</legend>
        <div className="flex flex-wrap gap-4 pt-1">
          {(["vlm", "llm"] as Capability[]).map((capability) => (
            <label
              key={capability}
              className="flex items-center gap-2 text-xs cursor-pointer select-none"
              htmlFor={`cap-${capability}`}
            >
              <Checkbox
                id={`cap-${capability}`}
                checked={form.capabilities.includes(capability)}
                onCheckedChange={() => toggleCapability(capability)}
              />
              <span>{getCapabilityLabel(capability)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {(needsKey || form.apiKey) && (
        <div className="space-y-1 border-t pt-2">
          <Label htmlFor="cn-key" className="text-xs font-medium">
            {t("conn_key_label")}
            {hasExistingKey && ` (${t("conn_key_placeholder_edit")})`}
          </Label>
          <Input
            id="cn-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={form.apiKey}
            onChange={(e) => setForm((p) => ({ ...p, apiKey: e.target.value }))}
            placeholder={hasExistingKey ? "••••••••" : t("conn_key_placeholder_new")}
            className="h-8 font-mono text-xs"
          />
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t">
        <Button
          size="sm"
          className="h-7.5 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3"
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
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <Check className="size-3" aria-hidden />
          )}
          <span>{t("conn_save_btn")}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7.5 text-xs px-3"
          onClick={onCancel}
          disabled={isSaving}
        >
          <span>{t("conn_cancel_btn")}</span>
        </Button>
      </div>
    </div>
  );
}
