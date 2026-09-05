import {
  FileCode,
  FileSliders,
  Layers,
  ListTree,
  RefreshCw,
  Save,
  Sliders,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BooleanRow,
  NumberRow,
  TextRow,
} from "@/features/settings/SettingRow";
import {
  DEFAULT_COLLECTION_CONFIG,
  LIMITS,
  loadCollectionConfig,
  saveCollectionConfig,
  type CollectionConfig,
} from "@/features/settings/types";
import { useI18n } from "@/lib/i18n";

interface CollectionSettingsDialogProps {
  collection: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved?: (config: CollectionConfig) => void;
  trigger?: React.ReactNode;
}

export function CollectionSettingsDialog({
  collection,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onSaved,
  trigger,
}: CollectionSettingsDialogProps) {
  const { t } = useI18n();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;
  const setIsOpen = isControlled ? controlledOnOpenChange! : setUncontrolledOpen;

  const [activeTab, setActiveTab] = useState("preprocess");
  const [config, setConfig] = useState<CollectionConfig>(() => loadCollectionConfig(collection));
  const [savedAlert, setSavedAlert] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfig(loadCollectionConfig(collection));
      setSavedAlert(false);
    }
  }, [isOpen, collection]);

  function handleSave() {
    saveCollectionConfig(collection, config);
    onSaved?.(config);
    setSavedAlert(true);
    setTimeout(() => {
      setSavedAlert(false);
      setIsOpen(false);
    }, 700);
  }

  function handleReset() {
    setConfig(DEFAULT_COLLECTION_CONFIG);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="sm:max-w-[620px] max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b bg-card/60">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
              <FileSliders className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold">
                Cấu hình Xử lý & Tra cứu: <span className="font-mono text-emerald-600">{collection}</span>
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-2 border-b bg-muted/20">
            <TabsList className="h-9 w-full justify-start bg-transparent p-0 gap-1">
              <TabsTrigger
                value="preprocess"
                className="h-8 gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-2xs rounded-t-md"
              >
                <Sliders className="size-3.5" />
                <span>Tiền xử lý</span>
              </TabsTrigger>
              <TabsTrigger
                value="chunking"
                className="h-8 gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-2xs rounded-t-md"
              >
                <Layers className="size-3.5" />
                <span>Cắt lát</span>
              </TabsTrigger>
              <TabsTrigger
                value="ocr"
                className="h-8 gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-2xs rounded-t-md"
              >
                <FileCode className="size-3.5" />
                <span>OCR & Bố cục</span>
              </TabsTrigger>
              <TabsTrigger
                value="toc"
                className="h-8 gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-2xs rounded-t-md"
              >
                <ListTree className="size-3.5" />
                <span>Mục lục & Tra cứu</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: Tiền xử lý */}
          <TabsContent value="preprocess" className="flex-1 overflow-y-auto p-6 space-y-4 m-0">
            <NumberRow
              label="Độ phân giải render (DPI)"
              value={config.preprocess.dpi}
              min={LIMITS.dpi.min}
              max={LIMITS.dpi.max}
              step={10}
              unit="DPI"
              tooltip="Độ nét khi chuyển PDF thành ảnh. Cao hơn sẽ rõ chữ nhưng file nặng hơn."
              onChange={(v: number) =>
                setConfig((prev) => ({
                  ...prev,
                  preprocess: { ...prev.preprocess, dpi: v },
                }))
              }
            />

            <BooleanRow
              label="Tự động tách đôi trang"
              value={config.preprocess.vertical_split}
              tooltip="Tự động chia đôi giữa trang khi tài liệu là dạng scan 2 trang trên 1 tờ."
              onChange={(v: boolean) =>
                setConfig((prev) => ({
                  ...prev,
                  preprocess: { ...prev.preprocess, vertical_split: v },
                }))
              }
            />

            <NumberRow
              label="Lề bù trang quét (Padding)"
              value={config.preprocess.padding}
              min={LIMITS.padding.min}
              max={LIMITS.padding.max}
              unit="px"
              tooltip="Khoảng lề bù xung quanh trang trước khi gửi vào mô hình dò chữ."
              onChange={(v: number) =>
                setConfig((prev) => ({
                  ...prev,
                  preprocess: { ...prev.preprocess, padding: v },
                }))
              }
            />

            <NumberRow
              label="Số luồng xử lý song song"
              value={config.preprocess.thread_count}
              min={1}
              max={16}
              unit="luồng"
              tooltip="Số worker chuyển đổi trang PDF đồng thời."
              onChange={(v: number) =>
                setConfig((prev) => ({
                  ...prev,
                  preprocess: { ...prev.preprocess, thread_count: v },
                }))
              }
            />

            <BooleanRow
              label="Áp dụng viền bù khi cắt ảnh (Use Cut Padding)"
              value={config.preprocess.use_cut_padding}
              tooltip="Giữ lại phần lề nhỏ ngoài vùng trích đoạn để tránh bị cắt sát mép chữ."
              onChange={(v: boolean) =>
                setConfig((prev) => ({
                  ...prev,
                  preprocess: { ...prev.preprocess, use_cut_padding: v },
                }))
              }
            />
          </TabsContent>

          {/* Tab 2: Cắt lát (Chunking) */}
          <TabsContent value="chunking" className="flex-1 overflow-y-auto p-6 space-y-4 m-0">
            <NumberRow
              label="Khoảng bù lề viền cắt (Cut Padding)"
              value={config.chunking.cut_padding}
              min={LIMITS.chunk_cut_padding.min}
              max={LIMITS.chunk_cut_padding.max}
              unit="px"
              tooltip="Khoảng cách mở rộng viền lát cắt của từng điều khoản."
              onChange={(v: number) =>
                setConfig((prev) => ({
                  ...prev,
                  chunking: { ...prev.chunking, cut_padding: v },
                }))
              }
            />

            <NumberRow
              label="Chiều cao mục tối thiểu"
              value={config.chunking.min_section_height_px}
              min={LIMITS.min_section_height.min}
              max={LIMITS.min_section_height.max}
              unit="px"
              tooltip="Các mục có chiều cao ảnh nhỏ hơn giá trị này sẽ được gộp vào mục liền kề."
              onChange={(v: number) =>
                setConfig((prev) => ({
                  ...prev,
                  chunking: { ...prev.chunking, min_section_height_px: v },
                }))
              }
            />

            <BooleanRow
              label="Tự động loại bỏ số trang Header / Footer"
              value={config.chunking.remove_page_number}
              tooltip="Không tính vùng số trang đầu và cuối trang vào các khối cắt lát."
              onChange={(v: boolean) =>
                setConfig((prev) => ({
                  ...prev,
                  chunking: { ...prev.chunking, remove_page_number: v },
                }))
              }
            />

            <BooleanRow
              label="Giữ nguyên khối trang (Keep Chunk Pages)"
              value={config.chunking.keep_chunk_pages}
              tooltip="Không chia nhỏ ảnh lát cắt qua nhiều trang riêng biệt."
              onChange={(v: boolean) =>
                setConfig((prev) => ({
                  ...prev,
                  chunking: { ...prev.chunking, keep_chunk_pages: v },
                }))
              }
            />
          </TabsContent>

          {/* Tab 3: OCR & Bố cục */}
          <TabsContent value="ocr" className="flex-1 overflow-y-auto p-6 space-y-4 m-0">
            <NumberRow
              label="Batch size công thức toán LaTeX"
              value={config.ocr.formula_batch_size}
              min={1}
              max={32}
              tooltip="Số lượng công thức toán OCR song song mỗi lượt xử lý."
              onChange={(v: number) =>
                setConfig((prev) => ({
                  ...prev,
                  ocr: { ...prev.ocr, formula_batch_size: v },
                }))
              }
            />

            <NumberRow
              label="Batch size tiêu đề điều khoản"
              value={config.ocr.title_batch_size}
              min={1}
              max={32}
              tooltip="Số lượng tiêu đề nhận diện song song."
              onChange={(v: number) =>
                setConfig((prev) => ({
                  ...prev,
                  ocr: { ...prev.ocr, title_batch_size: v },
                }))
              }
            />

            <NumberRow
              label="Batch size bảng số & dữ liệu"
              value={config.ocr.number_batch_size}
              min={1}
              max={32}
              tooltip="Số lượng ô bảng số liệu OCR song song."
              onChange={(v: number) =>
                setConfig((prev) => ({
                  ...prev,
                  ocr: { ...prev.ocr, number_batch_size: v },
                }))
              }
            />

            <BooleanRow
              label="Chế độ nạp OCR theo nhu cầu (Lazy Load)"
              value={config.ocr.lazy_load}
              tooltip="Chỉ nhận diện OCR chi tiết khi mục được tra cứu hoặc hiển thị."
              onChange={(v: boolean) =>
                setConfig((prev) => ({
                  ...prev,
                  ocr: { ...prev.ocr, lazy_load: v },
                }))
              }
            />
          </TabsContent>

          {/* Tab 4: Mục lục & Tra cứu */}
          <TabsContent value="toc" className="flex-1 overflow-y-auto p-6 space-y-4 m-0">
            <BooleanRow
              label="Tự động chuẩn hoá câu hỏi theo Mục lục"
              value={config.toc.use_toc_rewrite}
              tooltip="Dùng thuật ngữ trong cây mục lục đã index để viết lại câu hỏi chính xác hơn."
              onChange={(v: boolean) =>
                setConfig((prev) => ({
                  ...prev,
                  toc: { ...prev.toc, use_toc_rewrite: v },
                }))
              }
            />

            <NumberRow
              label="Số mục trích dẫn tối đa (Top-K)"
              value={config.retrieval.top_k}
              min={LIMITS.top_k.min}
              max={LIMITS.top_k.max}
              tooltip="Số lượng ảnh cắt lát liên quan nhất gửi vào VLM để phân tích và trả lời."
              onChange={(v: number) =>
                setConfig((prev) => ({
                  ...prev,
                  retrieval: { ...prev.retrieval, top_k: v },
                }))
              }
            />

            <TextRow
              label="Mô hình LLM chuẩn hoá Cây mục lục"
              value={config.toc.model_name}
              tooltip="Mô hình ngôn ngữ được gọi để lọc tiêu đề giả và dựng quan hệ cha-con."
              mono
              onChange={(v: string) =>
                setConfig((prev) => ({
                  ...prev,
                  toc: { ...prev.toc, model_name: v },
                }))
              }
            />

            <NumberRow
              label="Nhiệt độ (Temperature) chuẩn hoá ToC"
              value={config.toc.temperature}
              min={LIMITS.temperature.min}
              max={LIMITS.temperature.max}
              step={0.1}
              tooltip="Giá trị thấp giúp việc dựng cây mục lục có tính ổn định cao."
              onChange={(v: number) =>
                setConfig((prev) => ({
                  ...prev,
                  toc: { ...prev.toc, temperature: v },
                }))
              }
            />

            <NumberRow
              label="Giới hạn xem trước mục lục (Preview Limit)"
              value={config.toc.preview_limit}
              min={LIMITS.toc_preview_limit.min}
              max={LIMITS.toc_preview_limit.max}
              tooltip="Số lượng mục hiển thị xem trước khi tra cứu thuật ngữ."
              onChange={(v: number) =>
                setConfig((prev) => ({
                  ...prev,
                  toc: { ...prev.toc, preview_limit: v },
                }))
              }
            />
          </TabsContent>
        </Tabs>

        {/* Footer actions */}
        <DialogFooter className="flex items-center justify-between border-t bg-muted/15 px-6 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            <RefreshCw className="size-3.5" />
            <span>{t("reset_settings")}</span>
          </Button>

          <div className="flex items-center gap-2">
            {savedAlert && (
              <span className="text-xs text-emerald-600 font-medium animate-in fade-in">
                ✓ Đã lưu cấu hình bộ tài liệu
              </span>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              className="h-8 text-xs gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 font-medium"
            >
              <Save className="size-3.5" />
              <span>{t("save_settings")}</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
