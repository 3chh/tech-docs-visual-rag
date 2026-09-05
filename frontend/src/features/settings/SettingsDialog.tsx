import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Globe,
  Lock,
  RotateCcw,
  Scissors,
  Search,
  Settings2,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

import {
  BoolSetting,
  LockedSetting,
  NumberSetting,
  SettingGroup,
} from "./SettingRow";
import {
  DEFAULT_SETTINGS,
  LIMITS,
  type AskOverrides,
  type StoredSettings,
} from "./types";

export interface SettingsDialogProps {
  settings: StoredSettings;
  onChange: (settings: StoredSettings) => void;
  trigger?: React.ReactNode;
  activeCollection?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({
  settings,
  onChange,
  trigger,
  activeCollection = "default",
  open,
  onOpenChange,
}: SettingsDialogProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["settings"],
    queryFn: api.settings,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const { t, language, setLanguage } = useI18n();
  const [scope, setScope] = useState<"collection" | "system">("collection");
  const [activeTab, setActiveTab] = useState<string>("ask");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const overrideCount =
    countAskOverrides(settings.ask, DEFAULT_SETTINGS.ask) +
    countNested(settings.processing as Record<string, unknown>);

  function resetAll() {
    onChange(DEFAULT_SETTINGS);
  }

  function handleSave() {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
            <Settings2 className="size-4" aria-hidden />
            <span>{t("settings_title")}</span>
            {overrideCount > 0 && (
              <span className="rounded-sm bg-emerald-500/15 px-1.5 py-px font-mono text-[10px] text-emerald-600 font-bold tabular">
                {overrideCount}
              </span>
            )}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="flex max-h-[88dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        {/* Dialog Header */}
        <DialogHeader className="shrink-0 border-b px-6 py-3.5 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-4.5 text-emerald-600" />
              <DialogTitle className="text-sm font-semibold">
                {t("settings_title")}
              </DialogTitle>
            </div>

            {/* Scope Switcher: Cấu hình Bộ tài liệu vs Cấu hình Hệ thống */}
            <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 text-xs mr-6">
              <button
                type="button"
                onClick={() => {
                  setScope("collection");
                  setActiveTab("ask");
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  scope === "collection"
                    ? "bg-background text-emerald-700 dark:text-emerald-300 shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("collection_settings_tab")} ({activeCollection})
              </button>
              <button
                type="button"
                onClick={() => {
                  setScope("system");
                  setActiveTab("fixed");
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  scope === "system"
                    ? "bg-background text-emerald-700 dark:text-emerald-300 shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("system_settings_tab")}
              </button>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            {scope === "collection"
              ? `Các tham số áp dụng riêng cho lượt tra cứu và xử lý tệp trong bộ [${activeCollection}].`
              : "Các tham số hạ tầng máy chủ, mô hình AI đọc ảnh và tuỳ chọn hiển thị chung."}
          </DialogDescription>
        </DialogHeader>

        {/* Dialog Body with Vertical Sidebar Tabs */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            orientation="vertical"
            className="flex flex-1 min-h-0"
          >
            {/* Left Vertical Tabs List */}
            <TabsList className="w-52 shrink-0 flex-col items-stretch justify-start rounded-none border-r bg-muted/15 p-2 space-y-1 h-auto min-h-0">
              {scope === "collection" ? (
                <>
                  <TabsTrigger
                    value="ask"
                    className="justify-start gap-2.5 py-2 px-3 text-xs data-[state=active]:bg-background data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300 data-[state=active]:font-semibold data-[state=active]:shadow-2xs"
                  >
                    <Search className="size-3.5 text-emerald-600" />
                    <span>{t("runtime_tab")}</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="processing"
                    className="justify-start gap-2.5 py-2 px-3 text-xs data-[state=active]:bg-background data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300 data-[state=active]:font-semibold data-[state=active]:shadow-2xs"
                  >
                    <FileText className="size-3.5 text-emerald-600" />
                    <span>{t("processing_tab")}</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="chunking"
                    className="justify-start gap-2.5 py-2 px-3 text-xs data-[state=active]:bg-background data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300 data-[state=active]:font-semibold data-[state=active]:shadow-2xs"
                  >
                    <Scissors className="size-3.5 text-emerald-600" />
                    <span>Cắt lát & Biên lề</span>
                  </TabsTrigger>
                </>
              ) : (
                <>
                  <TabsTrigger
                    value="fixed"
                    className="justify-start gap-2.5 py-2 px-3 text-xs data-[state=active]:bg-background data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300 data-[state=active]:font-semibold data-[state=active]:shadow-2xs"
                  >
                    <Lock className="size-3.5 text-emerald-600" />
                    <span>{t("fixed_tab")}</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="appearance"
                    className="justify-start gap-2.5 py-2 px-3 text-xs data-[state=active]:bg-background data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300 data-[state=active]:font-semibold data-[state=active]:shadow-2xs"
                  >
                    <Globe className="size-3.5 text-emerald-600" />
                    <span>{t("general_tab")} & {t("language_name")}</span>
                  </TabsTrigger>
                </>
              )}
            </TabsList>

            {/* Right Tab Contents */}
            <div className="flex-1 min-w-0 overflow-y-auto p-6">
              {isLoading && (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-3/4" />
                  <Skeleton className="h-10 w-4/5" />
                </div>
              )}

              {isError && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive flex items-center gap-2">
                  <TriangleAlert className="size-4" />
                  <span>Không kết nối được backend để tải thông tin tham số mặc định.</span>
                </div>
              )}

              {/* 1. Tra cứu & VLM */}
              <TabsContent value="ask" className="m-0 space-y-4">
                <SettingGroup title="Tham số Tìm kiếm & Đọc ảnh VLM">
                  <NumberSetting
                    label={t("top_k_title")}
                    hint={t("top_k_plain_desc")}
                    tooltip={t("top_k_tooltip")}
                    value={settings.ask.topK}
                    defaultValue={data?.runtime.top_k_default ?? DEFAULT_SETTINGS.ask.topK}
                    min={data?.runtime.top_k_min ?? LIMITS.top_k.min}
                    max={data?.runtime.top_k_max ?? LIMITS.top_k.max}
                    onChange={(topK) =>
                      onChange({
                        ...settings,
                        ask: { ...settings.ask, topK: topK ?? DEFAULT_SETTINGS.ask.topK },
                      })
                    }
                  />

                  <BoolSetting
                    label={t("toc_rewrite_title")}
                    hint={t("toc_rewrite_plain_desc")}
                    tooltip={t("toc_rewrite_tooltip")}
                    value={settings.ask.useTocRewrite}
                    defaultValue={data?.runtime.use_toc_rewrite_default ?? DEFAULT_SETTINGS.ask.useTocRewrite}
                    onChange={(useTocRewrite) =>
                      onChange({
                        ...settings,
                        ask: { ...settings.ask, useTocRewrite: useTocRewrite ?? true },
                      })
                    }
                  />

                  <NumberSetting
                    label={t("vlm_temp_title")}
                    hint={t("vlm_temp_plain_desc")}
                    tooltip={t("vlm_temp_tooltip")}
                    value={settings.ask.vlmTemperature}
                    defaultValue={DEFAULT_SETTINGS.ask.vlmTemperature ?? 0}
                    min={LIMITS.temperature.min}
                    max={LIMITS.temperature.max}
                    step={0.1}
                    onChange={(vlmTemperature) =>
                      onChange({ ...settings, ask: { ...settings.ask, vlmTemperature } })
                    }
                  />
                </SettingGroup>
              </TabsContent>

              {/* 2. Xử lý PDF */}
              <TabsContent value="processing" className="m-0 space-y-4">
                <SettingGroup title="Chuyển đổi & Nhận diện tệp PDF">
                  <NumberSetting
                    label={t("dpi_title")}
                    hint={t("dpi_plain_desc")}
                    tooltip={t("dpi_tooltip")}
                    value={settings.processing.preprocess?.pdf_to_image?.dpi}
                    defaultValue={data?.document.preprocess.pdf_to_image.dpi ?? 300}
                    min={LIMITS.dpi.min}
                    max={LIMITS.dpi.max}
                    step={25}
                    unit="DPI"
                    onChange={(dpi) =>
                      onChange({
                        ...settings,
                        processing: {
                          ...settings.processing,
                          preprocess: {
                            ...settings.processing.preprocess,
                            pdf_to_image: {
                              ...settings.processing.preprocess?.pdf_to_image,
                              dpi,
                            },
                          },
                        },
                      })
                    }
                  />

                  <BoolSetting
                    label={t("split_title")}
                    hint={t("split_plain_desc")}
                    tooltip={t("split_tooltip")}
                    value={settings.processing.preprocess?.pdf_to_image?.vertical_split}
                    defaultValue={data?.document.preprocess.pdf_to_image.vertical_split ?? true}
                    onChange={(vertical_split) =>
                      onChange({
                        ...settings,
                        processing: {
                          ...settings.processing,
                          preprocess: {
                            ...settings.processing.preprocess,
                            pdf_to_image: {
                              ...settings.processing.preprocess?.pdf_to_image,
                              vertical_split,
                            },
                          },
                        },
                      })
                    }
                  />
                </SettingGroup>
              </TabsContent>

              {/* 3. Cắt mục ToC */}
              <TabsContent value="chunking" className="m-0 space-y-4">
                <SettingGroup title="Cắt lát theo phân cấp Mục lục">
                  <NumberSetting
                    label={t("padding_title")}
                    hint={t("padding_plain_desc")}
                    tooltip={t("padding_tooltip")}
                    value={settings.processing.chunking?.cut_padding}
                    defaultValue={data?.document.chunking.cut_padding ?? 60}
                    min={LIMITS.chunk_cut_padding.min}
                    max={LIMITS.chunk_cut_padding.max}
                    unit="px"
                    onChange={(cut_padding) =>
                      onChange({
                        ...settings,
                        processing: {
                          ...settings.processing,
                          chunking: {
                            ...settings.processing.chunking,
                            cut_padding,
                          },
                        },
                      })
                    }
                  />
                </SettingGroup>
              </TabsContent>

              {/* 4. Cố định & Hạ tầng */}
              <TabsContent value="fixed" className="m-0 space-y-4">
                <SettingGroup title="Mô hình AI & Dịch vụ">
                  <LockedSetting
                    label="Mô hình Đọc ảnh (VLM)"
                    value={data?.models.vlm.model_name ?? "Qwen2-VL-7B-Instruct"}
                    note="Phục vụ tại cổng GPU /v1"
                    tooltip="Mô hình đọc và suy luận trực tiếp trên ảnh chụp trang tài liệu kỹ thuật."
                  />
                  <LockedSetting
                    label="Mô hình Trích xuất Bố cục (Layout)"
                    value={data?.document.layout.model_name ?? "PP-DocLayout_plus-L"}
                    note="Phân đoạn tiêu đề, đoạn văn, bảng và công thức toán"
                  />
                  <LockedSetting
                    label="Cơ sở dữ liệu Vector (Milvus)"
                    value={data?.indexing.vectordb.uri ?? "localhost:19530"}
                    note="Lưu trữ embedding các trang tài liệu"
                  />
                </SettingGroup>
              </TabsContent>

              {/* 5. Giao diện & Ngôn ngữ */}
              <TabsContent value="appearance" className="m-0 space-y-4">
                <SettingGroup title="Ngôn ngữ & Hiển thị">
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground">{t("language_switch")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Chọn ngôn ngữ hiển thị toàn bộ giao diện.</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant={language === "vi" ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs font-medium"
                        onClick={() => setLanguage("vi")}
                      >
                        Tiếng Việt
                      </Button>
                      <Button
                        variant={language === "en" ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs font-medium"
                        onClick={() => setLanguage("en")}
                      >
                        English
                      </Button>
                    </div>
                  </div>
                </SettingGroup>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Dialog Footer */}
        <DialogFooter className="shrink-0 border-t bg-card px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            {overrideCount > 0 ? (
              <span className="text-emerald-600 font-medium">
                Đang áp dụng {overrideCount} tham số tuỳ chỉnh.
              </span>
            ) : (
              <span className="text-muted-foreground">Đang dùng toàn bộ giá trị chuẩn của hệ thống.</span>
            )}
            {saveSuccess && (
              <span className="text-emerald-600 font-bold animate-fade-in">✓ Đã lưu cài đặt!</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetAll}
              disabled={overrideCount === 0}
              className="gap-1.5 text-xs"
            >
              <RotateCcw className="size-3.5" />
              <span>{t("reset_settings")}</span>
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
            >
              <span>{t("save_settings")}</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function countAskOverrides(current: AskOverrides, defaults: AskOverrides) {
  let count = 0;
  if (current.topK !== undefined && current.topK !== defaults.topK) count++;
  if (current.useTocRewrite !== undefined && current.useTocRewrite !== defaults.useTocRewrite) count++;
  if (current.vlmTemperature !== undefined && current.vlmTemperature !== defaults.vlmTemperature) count++;
  return count;
}

function countNested(obj: Record<string, unknown>) {
  let count = 0;
  for (const value of Object.values(obj)) {
    if (value !== undefined) count += 1;
  }
  return count;
}
