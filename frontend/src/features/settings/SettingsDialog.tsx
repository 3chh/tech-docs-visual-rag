import { useQuery } from "@tanstack/react-query";
import {
  Database,
  Globe,
  Info,
  Server,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { ConnectionsSection } from "./ConnectionsSection";
import { LockedSetting, SettingGroup } from "./SettingRow";
import type { StoredSettings } from "./types";

export interface SettingsDialogProps {
  settings?: StoredSettings;
  onChange?: (settings: StoredSettings) => void;
  trigger?: React.ReactNode;
  activeCollection?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type SettingsTabId = "general" | "models" | "vectordb" | "system";

export function SettingsDialog({
  trigger,
  open,
  onOpenChange,
}: SettingsDialogProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: api.settings,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const { t, language, setLanguage } = useI18n();
  const [activeTab, setActiveTab] = useState<SettingsTabId>("general");

  const embedding = data?.indexing.embedding;
  const vectordb = data?.indexing.vectordb;

  // Cấu hình các mục điều hướng sidebar bên trái (Tham khảo thiết kế WeKnora)
  const navGroups: {
    groupLabel: string;
    items: {
      id: SettingsTabId;
      label: string;
      desc: string;
      icon: typeof Settings;
    }[];
  }[] = [
    {
      groupLabel: t("settings_group_general"),
      items: [
        {
          id: "general",
          label: t("settings_tab_general"),
          desc: t("settings_tab_general_desc"),
          icon: Globe,
        },
        {
          id: "models",
          label: t("settings_tab_models"),
          desc: t("settings_tab_models_desc"),
          icon: Sparkles,
        },
      ],
    },
    {
      groupLabel: t("settings_group_infrastructure"),
      items: [
        {
          id: "vectordb",
          label: t("settings_tab_vectordb"),
          desc: t("settings_tab_vectordb_desc"),
          icon: Database,
        },
        {
          id: "system",
          label: t("settings_tab_storage"),
          desc: t("settings_tab_storage_desc"),
          icon: Server,
        },
      ],
    },
  ];

  // Lấy thông tin tiêu đề và mô tả của tab đang chọn
  const activeItem = navGroups
    .flatMap((g) => g.items)
    .find((i) => i.id === activeTab) ?? navGroups[0].items[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="sm:max-w-[860px] w-[95vw] h-[580px] max-h-[90vh] p-0 flex flex-row overflow-hidden rounded-xl shadow-2xl border bg-background">
        {/* ============================================================ */}
        {/* 1. LEFT SIDEBAR NAVIGATION (WeKnora Pattern)                 */}
        {/* ============================================================ */}
        <aside className="w-56 sm:w-60 shrink-0 border-r border-border/80 bg-muted/25 flex flex-col justify-between select-none">
          <div className="p-3.5 space-y-4">
            {/* Sidebar Header */}
            <div className="flex items-center gap-2.5 px-1 py-1">
              <div className="flex size-7 items-center justify-center rounded-md bg-emerald-600 text-white shadow-xs">
                <Settings className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xs font-bold tracking-tight text-foreground truncate">
                  {t("settings_modal_title")}
                </h2>
                <p className="text-[10px] text-muted-foreground truncate font-mono">
                  Cosmo ChatPDF
                </p>
              </div>
            </div>

            {/* Navigation Groups */}
            <nav className="space-y-4">
              {navGroups.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1">
                  <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    {group.groupLabel}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveTab(item.id)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-all duration-150 text-left font-medium",
                            isActive
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold border-l-3 border-emerald-600 shadow-2xs"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                          )}
                        >
                          <Icon
                            className={cn(
                              "size-4 shrink-0",
                              isActive
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground/80",
                            )}
                          />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          {/* Sidebar Footer Info */}
          <div className="p-3 border-t border-border/60 bg-muted/30 text-[10px] text-muted-foreground font-mono">
            <span>Stack: v0.9.2 · Blackwell Ready</span>
          </div>
        </aside>

        {/* ============================================================ */}
        {/* 2. RIGHT CONTENT AREA                                        */}
        {/* ============================================================ */}
        <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
          {/* Content Header */}
          <div className="flex items-center justify-between border-b px-6 py-4 bg-card/40 shrink-0">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                {activeItem.label}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeItem.desc}
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="size-7.5 rounded-md text-muted-foreground hover:text-foreground"
              onClick={() => onOpenChange?.(false)}
              title={t("settings_close_btn")}
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Content Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 min-h-0">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ) : (
              <>
                {/* ---------------------------------------------------- */}
                {/* TAB 1: Cài đặt chung & Ngôn ngữ (General & Language) */}
                {/* ---------------------------------------------------- */}
                {activeTab === "general" && (
                  <div className="space-y-6">
                    <SettingGroup title={t("settings_group_general")}>
                      {/* Ngôn ngữ giao diện */}
                      <div className="flex items-center justify-between py-3 border-b">
                        <div className="pr-4">
                          <p className="text-xs font-semibold text-foreground">
                            {t("settings_language_label")}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t("settings_language_desc")}
                          </p>
                        </div>
                        <div className="flex items-center rounded-lg bg-muted/60 p-1 border border-border/70 text-xs shadow-2xs shrink-0">
                          <button
                            type="button"
                            onClick={() => setLanguage("vi")}
                            className={cn(
                              "rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer select-none",
                              language === "vi"
                                ? "bg-emerald-600 text-white font-semibold shadow-xs"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            Tiếng Việt (VI)
                          </button>
                          <button
                            type="button"
                            onClick={() => setLanguage("en")}
                            className={cn(
                              "rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer select-none",
                              language === "en"
                                ? "bg-emerald-600 text-white font-semibold shadow-xs"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            English (EN)
                          </button>
                        </div>
                      </div>
                    </SettingGroup>

                    {/* Runtime Information */}
                    <SettingGroup title={t("settings_runtime_info")}>
                      <LockedSetting
                        label={t("settings_version_label")}
                        value="1.0.0 (Tech-Docs Visual RAG)"
                        mono
                      />
                      <LockedSetting
                        label={t("settings_environment_label")}
                        value="Docker Compose (Profiles: app, worker, vllm)"
                        mono
                      />
                      <LockedSetting
                        label={t("settings_compute_device")}
                        value="NVIDIA RTX 5090 (32GB VRAM · sm_120)"
                        mono
                      />
                    </SettingGroup>
                  </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* TAB 2: Mô hình AI & Kết nối (Model Connections)       */}
                {/* ---------------------------------------------------- */}
                {activeTab === "models" && (
                  <div className="space-y-4">
                    <ConnectionsSection />
                  </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* TAB 3: Vector DB & Embedding                         */}
                {/* ---------------------------------------------------- */}
                {activeTab === "vectordb" && (
                  <div className="space-y-6">
                    <SettingGroup title="Qdrant Vector Database">
                      <LockedSetting
                        label={t("settings_qdrant_host")}
                        value={vectordb?.uri ?? "http://qdrant:6333"}
                        mono
                      />
                      <LockedSetting
                        label={t("settings_qdrant_collection")}
                        value={vectordb?.collection_name ?? "context"}
                        mono
                      />
                      <LockedSetting
                        label={t("settings_search_limit")}
                        value={String(vectordb?.search_limit ?? 20)}
                      />
                    </SettingGroup>

                    <SettingGroup title="Visual Embedding Engine (ColQwen)">
                      <LockedSetting
                        label={t("settings_embed_model")}
                        value={embedding?.model_name ?? "tsystems/colqwen2.5-3b-multilingual-v1.0"}
                        mono
                      />
                      <LockedSetting
                        label={t("settings_compute_device")}
                        value={embedding?.device ?? "cuda"}
                        mono
                      />
                      <LockedSetting
                        label={t("settings_vector_dim")}
                        value={String(embedding?.dim ?? 128)}
                      />
                      <LockedSetting
                        label={t("settings_max_visual_tokens")}
                        value={String(embedding?.max_num_visual_tokens ?? 8192)}
                      />
                      <LockedSetting
                        label={t("settings_batching_mode")}
                        value={embedding?.batching_mode ?? "dynamic"}
                      />
                    </SettingGroup>
                  </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* TAB 4: Hạ tầng & Lưu trữ (Storage & Services)         */}
                {/* ---------------------------------------------------- */}
                {activeTab === "system" && (
                  <div className="space-y-6">
                    <SettingGroup title={t("settings_tab_storage")}>
                      <LockedSetting
                        label={t("settings_metadata_dir")}
                        value={data?.metadata_dir ?? "/data/metadata"}
                        mono
                      />
                      <LockedSetting
                        label={t("settings_data_dir")}
                        value={data?.data_dir ?? "/data"}
                        mono
                      />
                      <LockedSetting
                        label={t("settings_worker_endpoint")}
                        value={data?.document.worker_endpoint ?? "http://worker:8001/upload_pdf/"}
                        mono
                      />
                      <LockedSetting
                        label={t("settings_log_level")}
                        value={data?.log_level ?? "INFO"}
                        mono
                      />
                    </SettingGroup>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Content Footer */}
          <div className="border-t bg-muted/15 px-6 py-2.5 flex items-center justify-between shrink-0">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Info className="size-3 text-emerald-600" />
              <span>{t("settings_immutable_notice")}</span>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange?.(false)}
              className="h-7.5 px-3 text-xs"
            >
              {t("settings_close_btn")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
