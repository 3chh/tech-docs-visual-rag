import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Cloud, Cpu } from "lucide-react";
import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { CredentialStatus, VlmProviderOut } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ApiKeyField, EncryptionWarning } from "./ApiKeyField";
import { loadSettings, saveSettings } from "./types";

/**
 * Chọn model đọc ảnh và trả lời, kèm nhập API key cho từng nhà cung cấp.
 *
 * Key gốc chỉ đi một chiều lên server. Server mã hoá lưu lại và chỉ trả về bản
 * che, nên sau khi lưu không ai xem lại được key đầy đủ, kể cả người đã nhập.
 */
export function VlmProviderSection({
  providers,
  defaultProvider,
}: {
  providers: VlmProviderOut[];
  defaultProvider: string;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | undefined>(
    () => loadSettings().ask.vlmProvider,
  );

  const { data: credentialData, isLoading } = useQuery({
    queryKey: ["credentials"],
    queryFn: api.credentials,
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: (vars: {
      providerId: string;
      apiKey: string;
      modelName?: string;
      endpoint?: string;
    }) =>
      api.saveCredential(vars.providerId, {
        apiKey: vars.apiKey,
        modelName: vars.modelName,
        endpoint: vars.endpoint,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["credentials"] });
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (providerId: string) => api.deleteCredential(providerId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["credentials"] });
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  function pick(id: string) {
    const next = id === defaultProvider ? undefined : id;
    setSelected(next);
    const current = loadSettings();
    saveSettings({ ...current, ask: { ...current.ask, vlmProvider: next } });
  }

  if (isLoading) {
    return (
      <div className="space-y-2 py-3" aria-busy="true">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  const credentialById = new Map<string, CredentialStatus>(
    (credentialData?.credentials ?? []).map((c) => [c.provider_id, c]),
  );
  const activeId = selected ?? defaultProvider;

  return (
    <div className="space-y-3 py-2">
      <p className="text-sm text-muted-foreground">
        Tự host thì tài liệu không rời khỏi máy nhưng tốn GPU. Dùng API ngoài thì
        không cần GPU cho khâu này, đổi lại ảnh-mục được gửi lên nhà cung cấp.
      </p>

      <EncryptionWarning enabled={credentialData?.encryption_enabled ?? true} />

      <ul className="space-y-2">
        {providers.map((provider) => {
          const credential = credentialById.get(provider.id);
          const isActive = provider.id === activeId;
          const canSelect = provider.is_configured;

          return (
            <li
              key={provider.id}
              className={cn(
                "rounded-md border transition-colors",
                isActive ? "border-primary/50 bg-primary/[0.04]" : "bg-card",
              )}
            >
              <button
                type="button"
                onClick={() => canSelect && pick(provider.id)}
                disabled={!canSelect}
                aria-pressed={isActive}
                className={cn(
                  "flex w-full items-start gap-2.5 px-3 py-2.5 text-left",
                  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
                  !canSelect && "cursor-not-allowed",
                )}
              >
                {provider.needs_gpu ? (
                  <Cpu
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                ) : (
                  <Cloud
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                )}

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">{provider.label}</span>
                    {provider.id === defaultProvider && (
                      <span className="rounded-sm bg-muted px-1.5 py-px text-xs text-muted-foreground">
                        mặc định
                      </span>
                    )}
                    {provider.needs_gpu && (
                      <span className="rounded-sm bg-muted px-1.5 py-px text-xs text-muted-foreground">
                        cần GPU
                      </span>
                    )}
                  </span>
                  {provider.model_name && (
                    <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
                      {provider.model_name}
                    </span>
                  )}
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {provider.description}
                  </span>
                </span>

                {isActive && (
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                )}
              </button>

              {/* builtin dùng vLLM tự host nên không cần key. */}
              {provider.id !== "builtin" && (
                <div className="border-t px-3">
                  <ApiKeyField
                    providerLabel={provider.label}
                    maskedKey={credential?.masked_key ?? null}
                    keySource={credential?.key_source ?? "env"}
                    canDelete={credential?.can_delete ?? false}
                    needsEndpoint={provider.id === "custom"}
                    currentModel={credential?.model_name ?? provider.model_name}
                    currentEndpoint={credential?.endpoint ?? provider.endpoint}
                    isSaving={
                      saveMutation.isPending &&
                      saveMutation.variables?.providerId === provider.id
                    }
                    onSave={(payload) =>
                      saveMutation.mutate({ providerId: provider.id, ...payload })
                    }
                    onDelete={() => deleteMutation.mutate(provider.id)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {saveMutation.isError && (
        <p className="text-sm text-destructive" role="alert">
          Không lưu được key:{" "}
          {saveMutation.error instanceof Error
            ? saveMutation.error.message
            : "lỗi không xác định"}
        </p>
      )}
    </div>
  );
}
