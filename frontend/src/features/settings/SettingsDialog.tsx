import { useQuery } from "@tanstack/react-query";
import {
  Database,
  Globe,
  Server,
  Settings,
  Sparkles,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

import {
  LockedSetting,
  SettingGroup,
} from "./SettingRow";
import type { StoredSettings } from "./types";
import { VlmProviderSection } from "./VlmProviderSection";

export interface SettingsDialogProps {
  settings?: StoredSettings;
  onChange?: (settings: StoredSettings) => void;
  trigger?: React.ReactNode;
  activeCollection?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

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
  const [activeTab, setActiveTab] = useState<string>("models");

  const embedding = data?.indexing.embedding;
  const vectordb = data?.indexing.vectordb;
  const vlm = data?.models.vlm;
  const llm = data?.models.llm;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="sm:max-w-[620px] max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b bg-card/60">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
              <Settings className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold">
                Cấu hình Hệ thống Chung
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-2 border-b bg-muted/20">
            <TabsList className="h-9 w-full justify-start bg-transparent p-0 gap-1">
              <TabsTrigger
                value="models"
                className="h-8 gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-2xs rounded-t-md"
              >
                <Sparkles className="size-3.5" />
                <span>Mô hình AI</span>
              </TabsTrigger>
              <TabsTrigger
                value="vectordb"
                className="h-8 gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-2xs rounded-t-md"
              >
                <Database className="size-3.5" />
                <span>Vector DB & Embedding</span>
              </TabsTrigger>
              <TabsTrigger
                value="system"
                className="h-8 gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-2xs rounded-t-md"
              >
                <Server className="size-3.5" />
                <span>Hạ tầng & Lưu trữ</span>
              </TabsTrigger>
              <TabsTrigger
                value="interface"
                className="h-8 gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-2xs rounded-t-md"
              >
                <Globe className="size-3.5" />
                <span>Ngôn ngữ & Giao diện</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 min-h-0">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                {/* Tab 1: Mô hình AI */}
                <TabsContent value="models" className="m-0 space-y-4">
                  <SettingGroup title="Chọn nguồn model trả lời">
                    <VlmProviderSection
                      providers={data?.models.vlm_providers ?? []}
                      defaultProvider={data?.models.default_vlm_provider ?? "builtin"}
                    />
                  </SettingGroup>

                  <SettingGroup title="Chi tiết mô hình đang dùng">
                    <LockedSetting
                      label="Mô hình VLM phục vụ"
                      value={vlm?.model_name ?? "Qwen2-VL-7B-Instruct"}
                      tooltip="Mô hình thị giác ngôn ngữ nhận ảnh lát cắt để đọc điều khoản và công thức."
                    />
                    <LockedSetting
                      label="Cổng Endpoint VLM"
                      value={vlm?.endpoint ?? "http://localhost:8000/v1"}
                      mono
                    />
                    <LockedSetting
                      label="Trạng thái API Key"
                      value={vlm?.api_key_configured ? "Đã cấu hình an toàn" : "Chưa yêu cầu"}
                    />
                  </SettingGroup>

                  <SettingGroup title="Mô hình Ngôn ngữ & Nhận diện Bố cục">
                    <LockedSetting
                      label="Mô hình Trích xuất Bố cục (Layout)"
                      value={data?.document.layout.model_name ?? "PP-DocLayout_plus-L"}
                      note="Phân đoạn tiêu đề, bảng số liệu và công thức"
                    />
                    <LockedSetting
                      label="Mô hình Dò chữ (Text Detector)"
                      value={data?.document.preprocess.text_model ?? "doc-layout-v1"}
                    />
                    <LockedSetting
                      label="Mô hình LLM phụ trợ"
                      value={llm?.model_name ?? "gpt-4o-mini"}
                    />
                  </SettingGroup>
                </TabsContent>

                {/* Tab 2: Vector DB & Embedding */}
                <TabsContent value="vectordb" className="m-0 space-y-4">
                  <SettingGroup title="Cơ sở dữ liệu Vector (Milvus)">
                    <LockedSetting
                      label="Loại Vector DB"
                      value={vectordb?.type ?? "Milvus"}
                    />
                    <LockedSetting
                      label="Địa chỉ kết nối (URI)"
                      value={vectordb?.uri ?? "localhost:19530"}
                      mono
                    />
                    <LockedSetting
                      label="Collection gốc"
                      value={vectordb?.collection_name ?? "cosmo_documents"}
                      mono
                    />
                    <LockedSetting
                      label="Giới hạn tra cứu (Search Limit)"
                      value={String(vectordb?.search_limit ?? 20)}
                    />
                  </SettingGroup>

                  <SettingGroup title="Mô hình Embedding Thị giác">
                    <LockedSetting
                      label="Mô hình Embedding"
                      value={embedding?.model_name ?? "vidore/colpali-v1.2"}
                      mono
                    />
                    <LockedSetting
                      label="Thiết bị tính toán"
                      value={embedding?.device ?? "cuda"}
                    />
                    <LockedSetting
                      label="Số chiều vector (Dim)"
                      value={String(embedding?.dim ?? 128)}
                    />
                    <LockedSetting
                      label="Visual Tokens tối đa"
                      value={String(embedding?.max_num_visual_tokens ?? 1024)}
                    />
                    <LockedSetting
                      label="Chế độ gom nhóm (Batching Mode)"
                      value={embedding?.batching_mode ?? "dynamic"}
                    />
                  </SettingGroup>
                </TabsContent>

                {/* Tab 3: Hạ tầng & Lưu trữ */}
                <TabsContent value="system" className="m-0 space-y-4">
                  <SettingGroup title="Lưu trữ & Dịch vụ Nền">
                    <LockedSetting
                      label="Thư mục Metadata"
                      value={data?.metadata_dir ?? "/data/metadata"}
                      mono
                    />
                    <LockedSetting
                      label="Thư mục Dữ liệu (Data Dir)"
                      value={data?.data_dir ?? "/data"}
                      mono
                    />
                    <LockedSetting
                      label="Cổng Worker xử lý tệp"
                      value={data?.document.worker_endpoint ?? "http://localhost:8000"}
                      mono
                    />
                    <LockedSetting
                      label="Mức ghi log hệ thống"
                      value={data?.log_level ?? "INFO"}
                    />
                  </SettingGroup>
                </TabsContent>

                {/* Tab 4: Ngôn ngữ & Giao diện */}
                <TabsContent value="interface" className="m-0 space-y-4">
                  <SettingGroup title="Tuỳ chọn Giao diện">
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-xs font-semibold text-foreground">{t("language_switch")}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Ngôn ngữ áp dụng cho bảng điều khiển và hội thoại.
                        </p>
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
              </>
            )}
          </div>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="border-t bg-muted/15 px-6 py-3 flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange?.(false)}
            className="h-8 text-xs"
          >
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
