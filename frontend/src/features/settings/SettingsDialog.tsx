import { useQuery } from "@tanstack/react-query";
import { FileText, Lock, RotateCcw, Scissors, Search, Settings2, SlidersHorizontal, TriangleAlert } from "lucide-react";

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
import type { SettingsResponse } from "@/lib/types";

import {
  BoolSetting,
  LockedSetting,
  NumberSetting,
  SettingGroup,
  TextSetting,
} from "./SettingRow";
import {
  DEFAULT_SETTINGS,
  LIMITS,
  type StoredSettings,
} from "./types";

/**
 * Cấu hình chia theo danh mục với giao diện Sidebar dọc:
 * 1. Tra cứu (Retrieval & VLM) -> gửi kèm mỗi câu hỏi
 * 2. Xử lý PDF (DPI, Padding, OCR) -> gửi kèm mỗi lần upload
 * 3. Cắt mục (Chunking & ToC) -> cấu hình trích xuất ToC
 * 4. Cố định -> các tham số VRAM/Model/Database cố định
 */
export interface SettingsDialogProps {
  settings: StoredSettings;
  onChange: (settings: StoredSettings) => void;
  trigger?: React.ReactNode;
}

export function SettingsDialog({
  settings,
  onChange,
  trigger,
}: SettingsDialogProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["settings"],
    queryFn: api.settings,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const overrideCount =
    countOverrides(settings.ask, DEFAULT_SETTINGS.ask) +
    countNested(settings.processing);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="gap-1.5">
            <Settings2 className="size-4" aria-hidden />
            Cấu hình
            {overrideCount > 0 && (
              <span className="rounded-sm bg-primary/12 px-1.5 py-px font-mono text-xs text-primary tabular">
                {overrideCount}
              </span>
            )}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="flex max-h-[88dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-5 text-primary" />
            Cấu hình Hệ thống
          </DialogTitle>
          <DialogDescription>
            Tham số áp dụng cho phiên làm việc của bạn. Lưu cục bộ trên trình duyệt, không ảnh hưởng người dùng khác.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="ask" orientation="vertical" className="flex min-h-0 flex-1 flex-row gap-0 overflow-hidden">
          <TabsList className="flex w-52 shrink-0 flex-col items-stretch justify-start gap-1 rounded-none border-r bg-muted/25 p-3">
            <TabsTrigger
              value="ask"
              className="flex w-full items-center justify-start gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Search className="size-4 text-muted-foreground" />
              Tra cứu & VLM
            </TabsTrigger>
            <TabsTrigger
              value="pdf"
              className="flex w-full items-center justify-start gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <FileText className="size-4 text-muted-foreground" />
              Xử lý PDF
            </TabsTrigger>
            <TabsTrigger
              value="chunk"
              className="flex w-full items-center justify-start gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Scissors className="size-4 text-muted-foreground" />
              Cắt mục ToC
            </TabsTrigger>
            <TabsTrigger
              value="locked"
              className="flex w-full items-center justify-start gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Lock className="size-4 text-muted-foreground" />
              Tham số cố định
            </TabsTrigger>
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {isLoading && <LoadingRows />}
            {isError && <BackendOffline />}

            {data && (
              <>
                <TabsContent value="ask" className="mt-0 space-y-6 focus-visible:outline-none">
                  <AskTab data={data} settings={settings} onChange={onChange} />
                </TabsContent>

                <TabsContent value="pdf" className="mt-0 space-y-6 focus-visible:outline-none">
                  <PdfTab data={data} settings={settings} onChange={onChange} />
                </TabsContent>

                <TabsContent value="chunk" className="mt-0 space-y-6 focus-visible:outline-none">
                  <ChunkTab data={data} settings={settings} onChange={onChange} />
                </TabsContent>

                <TabsContent value="locked" className="mt-0 space-y-6 focus-visible:outline-none">
                  <LockedTab data={data} />
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>

        <DialogFooter className="shrink-0 justify-between border-t px-5 py-3 sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {overrideCount > 0
              ? `${overrideCount} tham số đã đổi khỏi mặc định`
              : "Đang dùng toàn bộ giá trị mặc định"}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={overrideCount === 0}
            onClick={() => onChange(DEFAULT_SETTINGS)}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Trả về mặc định
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Tab 1: gửi kèm mỗi câu hỏi ---------- */

function AskTab({
  data,
  settings,
  onChange,
}: {
  data: SettingsResponse;
  settings: StoredSettings;
  onChange: (s: StoredSettings) => void;
}) {
  const ask = settings.ask;
  const set = (patch: Partial<typeof ask>) =>
    onChange({ ...settings, ask: { ...ask, ...patch } });

  return (
    <>
      <SettingGroup
        title="Truy xuất"
        description="Áp dụng ngay cho câu hỏi tiếp theo, không cần khởi động lại."
      >
        <NumberSetting
          label="Số mục lấy về"
          hint="Càng nhiều càng chậm vì VLM phải đọc nhiều ảnh hơn"
          value={ask.topK}
          defaultValue={data.runtime.top_k_default}
          min={LIMITS.top_k.min}
          max={LIMITS.top_k.max}
          onChange={(v) => set({ topK: v ?? data.runtime.top_k_default })}
        />

        <BoolSetting
          label="Chuẩn hoá thuật ngữ theo mục lục"
          hint="Cho VLM đọc ảnh bìa và mục lục rồi viết lại câu hỏi bằng thuật ngữ có thật trong tài liệu. Tắt đi nhanh hơn một lượt gọi model"
          value={ask.useTocRewrite}
          defaultValue={data.runtime.use_toc_rewrite_default}
          onChange={(v) =>
            set({ useTocRewrite: v ?? data.runtime.use_toc_rewrite_default })
          }
        />

        <NumberSetting
          label="Số ảnh mục lục dùng để chuẩn hoá"
          hint="Nhiều hơn thì chuẩn hoá sát hơn nhưng tốn thêm visual token"
          value={ask.tocPreviewLimit}
          defaultValue={data.runtime.toc_preview_limit}
          min={LIMITS.toc_preview_limit.min}
          max={LIMITS.toc_preview_limit.max}
          onChange={(v) => set({ tocPreviewLimit: v })}
        />

        <NumberSetting
          label="Temperature của VLM"
          hint="0 cho câu trả lời ổn định nhất. Tài liệu kỹ thuật nên để thấp"
          value={ask.vlmTemperature}
          defaultValue={0}
          min={LIMITS.temperature.min}
          max={LIMITS.temperature.max}
          step={LIMITS.temperature.step}
          onChange={(v) => set({ vlmTemperature: v })}
        />
      </SettingGroup>
    </>
  );
}

/* ---------- Tab 2: gửi kèm mỗi lần upload ---------- */

function PdfTab({
  data,
  settings,
  onChange,
}: {
  data: SettingsResponse;
  settings: StoredSettings;
  onChange: (s: StoredSettings) => void;
}) {
  const p = settings.processing;
  const img = data.document.preprocess.pdf_to_image;
  const pre = data.document.preprocess;

  const setImg = (patch: Record<string, unknown>) =>
    onChange({
      ...settings,
      processing: {
        ...p,
        preprocess: {
          ...p.preprocess,
          pdf_to_image: { ...p.preprocess?.pdf_to_image, ...patch },
        },
      },
    });

  const setPre = (patch: Record<string, unknown>) =>
    onChange({
      ...settings,
      processing: { ...p, preprocess: { ...p.preprocess, ...patch } },
    });

  const setLayout = (patch: Record<string, unknown>) =>
    onChange({ ...settings, processing: { ...p, layout: { ...p.layout, ...patch } } });

  const setOcr = (patch: Record<string, unknown>) =>
    onChange({ ...settings, processing: { ...p, ocr: { ...p.ocr, ...patch } } });

  return (
    <>
      <SettingGroup
        title="PDF sang ảnh"
        description="Áp dụng cho lần tải tài liệu tiếp theo. Tài liệu đã index không bị ảnh hưởng."
      >
        <NumberSetting
          label="DPI mục tiêu"
          hint="DPI thực tế tính động theo khổ trang: anchor / (rộng × cao) × dpi"
          value={p.preprocess?.pdf_to_image?.dpi}
          defaultValue={img.dpi}
          min={LIMITS.dpi.min}
          max={LIMITS.dpi.max}
          onChange={(v) => setImg({ dpi: v })}
        />
        <NumberSetting
          label="DPI tối thiểu"
          hint="Sàn để trang khổ lớn không bị render quá nhỏ"
          value={p.preprocess?.pdf_to_image?.min_dpi}
          defaultValue={img.min_dpi}
          min={LIMITS.min_dpi.min}
          max={LIMITS.min_dpi.max}
          onChange={(v) => setImg({ min_dpi: v })}
        />
        <NumberSetting
          label="Số pixel chuẩn hoá"
          hint="Mốc để mọi khổ sách ra ảnh có cùng lượng pixel, nhờ đó ngân sách visual token ổn định"
          value={p.preprocess?.pdf_to_image?.anchor_size}
          defaultValue={img.anchor_size}
          min={LIMITS.anchor_size.min}
          max={LIMITS.anchor_size.max}
          step={10_000}
          onChange={(v) => setImg({ anchor_size: v })}
        />
        <NumberSetting
          label="Số luồng render"
          value={p.preprocess?.pdf_to_image?.thread_count}
          defaultValue={img.thread_count}
          min={LIMITS.thread_count.min}
          max={LIMITS.thread_count.max}
          onChange={(v) => setImg({ thread_count: v })}
        />
      </SettingGroup>

      <SettingGroup title="Cắt lề">
        <BoolSetting
          label="Bật cắt lề"
          hint="Bỏ lề trắng là bỏ visual token vô nghĩa"
          value={p.preprocess?.use_cut_padding}
          defaultValue={pre.use_cut_padding}
          onChange={(v) => setPre({ use_cut_padding: v })}
        />
        <NumberSetting
          label="Lề chừa lại"
          hint="Chừa quanh vùng chữ sau khi dò text"
          value={p.preprocess?.padding}
          defaultValue={pre.padding}
          min={LIMITS.padding.min}
          max={LIMITS.padding.max}
          unit="px"
          onChange={(v) => setPre({ padding: v })}
        />
        <NumberSetting
          label="Batch dò chữ"
          value={p.preprocess?.batch_size}
          defaultValue={pre.batch_size}
          min={LIMITS.preprocess_batch_size.min}
          max={LIMITS.preprocess_batch_size.max}
          onChange={(v) => setPre({ batch_size: v })}
        />
      </SettingGroup>

      <SettingGroup title="Nhận diện bố cục và OCR">
        <NumberSetting
          label="Batch nhận diện bố cục"
          hint="Lớn hơn thì nhanh hơn nhưng tốn VRAM hơn"
          value={p.layout?.batch_size}
          defaultValue={data.document.layout.batch_size}
          min={LIMITS.layout_batch_size.min}
          max={LIMITS.layout_batch_size.max}
          onChange={(v) => setLayout({ batch_size: v })}
        />
        <NumberSetting
          label="Batch OCR tiêu đề"
          value={p.ocr?.title_batch_size}
          defaultValue={data.document.ocr.title_batch_size}
          min={LIMITS.ocr_batch_size.min}
          max={LIMITS.ocr_batch_size.max}
          onChange={(v) => setOcr({ title_batch_size: v })}
        />
        <NumberSetting
          label="Batch OCR số trang"
          value={p.ocr?.number_batch_size}
          defaultValue={data.document.ocr.number_batch_size}
          min={LIMITS.ocr_batch_size.min}
          max={LIMITS.ocr_batch_size.max}
          onChange={(v) => setOcr({ number_batch_size: v })}
        />
        <NumberSetting
          label="Batch OCR công thức"
          value={p.ocr?.formula_batch_size}
          defaultValue={data.document.ocr.formula_batch_size}
          min={LIMITS.ocr_batch_size.min}
          max={LIMITS.ocr_batch_size.max}
          onChange={(v) => setOcr({ formula_batch_size: v })}
        />
      </SettingGroup>
    </>
  );
}

/* ---------- Tab 3: cắt mục ---------- */

function ChunkTab({
  data,
  settings,
  onChange,
}: {
  data: SettingsResponse;
  settings: StoredSettings;
  onChange: (s: StoredSettings) => void;
}) {
  const p = settings.processing;
  const chunk = data.document.chunking;
  const toc = data.document.toc_validator;

  const setChunk = (patch: Record<string, unknown>) =>
    onChange({ ...settings, processing: { ...p, chunking: { ...p.chunking, ...patch } } });

  const setToc = (patch: Record<string, unknown>) =>
    onChange({
      ...settings,
      processing: { ...p, toc_validator: { ...p.toc_validator, ...patch } },
    });

  return (
    <>
      <SettingGroup
        title="Cắt tài liệu thành mục"
        description="Quyết định một mục gồm những gì. Đây là tham số ảnh hưởng chất lượng truy xuất nhiều nhất."
      >
        <NumberSetting
          label="Lề cắt số trang"
          hint="Cắt bỏ chân trang trước khi ghép ảnh-mục, để số trang không chen giữa mạch văn"
          value={p.chunking?.cut_padding}
          defaultValue={chunk.cut_padding}
          min={LIMITS.chunk_cut_padding.min}
          max={LIMITS.chunk_cut_padding.max}
          unit="px"
          onChange={(v) => setChunk({ cut_padding: v })}
        />
        <NumberSetting
          label="Chiều cao mục tối thiểu"
          hint="Mục thấp hơn ngưỡng coi như chỉ có tiêu đề, gộp vào mục trước. Tăng lên nếu thấy nhiều mục rỗng"
          value={p.chunking?.min_section_height_px}
          defaultValue={chunk.min_section_height_px}
          min={LIMITS.min_section_height.min}
          max={LIMITS.min_section_height.max}
          unit="px"
          onChange={(v) => setChunk({ min_section_height_px: v })}
        />
      </SettingGroup>

      <SettingGroup
        title="LLM sửa cây mục lục"
        description="Layout model biết đây là tiêu đề nhưng không biết 5.4.2 là con của 5.4. LLM lọc tiêu đề giả và dựng quan hệ cha-con."
      >
        <TextSetting
          label="Model"
          hint="Chỉ là lệnh gọi API nên đổi được không cần khởi động lại"
          value={p.toc_validator?.model_name}
          defaultValue={toc.model_name}
          mono
          onChange={(v) => setToc({ model_name: v })}
        />
        <NumberSetting
          label="Temperature"
          hint="Thấp cho cây mục lục ổn định"
          value={p.toc_validator?.temperature}
          defaultValue={toc.temperature}
          min={LIMITS.temperature.min}
          max={LIMITS.temperature.max}
          step={LIMITS.temperature.step}
          onChange={(v) => setToc({ temperature: v })}
        />
      </SettingGroup>
    </>
  );
}

/* ---------- Tab 4: không đổi nóng được ---------- */

function LockedTab({ data }: { data: SettingsResponse }) {
  const e = data.indexing.embedding;
  const v = data.indexing.vectordb;

  return (
    <>
      <div className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/[0.04] px-3 py-2.5">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Những tham số này không đổi nóng được. Sửa trong <code>.env</code> rồi khởi
          động lại service. Riêng nhóm embedding, đổi xong{" "}
          <strong className="text-foreground">phải index lại toàn bộ tài liệu</strong>{" "}
          vì vector cũ tính theo tham số cũ, không so được với vector mới.
        </p>
      </div>

      <SettingGroup title="Embedding">
        <LockedSetting
          label="Loại retriever"
          value={e.type}
          reason="Model đã nạp vào VRAM lúc khởi động"
          envVar="EMBEDDING_TYPE"
        />
        <LockedSetting
          label="Model"
          value={e.model_name}
          mono
          reason="Model đã nạp vào VRAM lúc khởi động"
          envVar="EMBEDDING_MODEL_NAME"
        />
        <LockedSetting
          label="Thiết bị"
          value={e.device}
          reason="Model đã nạp trên thiết bị này"
          envVar="EMBEDDING_DEVICE"
        />
        <LockedSetting
          label="Số chiều vector"
          value={e.dim}
          reason="Collection trong vector DB đã tạo theo số chiều này"
          envVar="EMBEDDING_DIM"
        />
        <LockedSetting
          label="Visual token tối đa"
          value={e.max_num_visual_tokens.toLocaleString("vi-VN")}
          reason="Vector đã index tính theo giá trị này. Đổi thì phải index lại toàn bộ"
          envVar="EMBEDDING_MAX_NUM_VISUAL_TOKENS"
        />
        <LockedSetting
          label="Chiều rộng tối thiểu"
          value={e.min_width ? `${e.min_width} px` : "không đặt"}
          reason="Quyết định độ nét chữ khi resize ảnh-mục. Vector đã index theo giá trị này"
          envVar="EMBEDDING_MIN_WIDTH"
        />
        <LockedSetting
          label="Vector mỗi ảnh-mục"
          value={e.doc_dim.toLocaleString("vi-VN")}
          reason={`Tính ra: ${e.max_num_visual_tokens} visual token + ${e.prefix_num_tokens} prefix`}
        />
        <LockedSetting
          label="Chế độ batching"
          value={e.batching_mode}
          reason="Đọc lúc khởi tạo embedding manager"
          envVar="EMBEDDING_BATCHING_MODE"
        />
        <LockedSetting
          label="Ngân sách token mỗi batch"
          value={e.max_token.toLocaleString("vi-VN")}
          reason="Sort ảnh theo số token rồi gộp batch theo ngân sách để giảm padding"
          envVar="EMBEDDING_MAX_TOKEN"
        />
      </SettingGroup>

      <SettingGroup title="Vector database">
        <LockedSetting
          label="Loại"
          value={v.type}
          reason="Client đã kết nối theo loại này"
          envVar="VECTORDB_TYPE"
        />
        <LockedSetting
          label="URI"
          value={v.uri}
          mono
          reason="Client đã kết nối tới địa chỉ này"
          envVar="VECTORDB_URI"
        />
        <LockedSetting
          label="Collection"
          value={v.collection_name}
          mono
          reason="Schema collection đã tạo theo cấu hình hiện tại"
          envVar="VECTORDB_COLLECTION_NAME"
        />
        <LockedSetting
          label="Giới hạn tìm kiếm"
          value={v.search_limit.toLocaleString("vi-VN")}
          reason="Đọc lúc khởi tạo client"
          envVar="VECTORDB_SEARCH_LIMIT"
        />
      </SettingGroup>

      <SettingGroup title="Model nhận diện">
        <LockedSetting
          label="Model nhận diện bố cục"
          value={data.document.layout.model_name}
          mono
          reason="Model đã nạp vào VRAM lúc worker khởi động"
        />
        <LockedSetting
          label="Model dò chữ"
          value={data.document.preprocess.text_model}
          mono
          reason="Model đã nạp vào VRAM lúc worker khởi động"
        />
      </SettingGroup>

      <SettingGroup title="VLM và LLM">
        <LockedSetting
          label="VLM model"
          value={data.models.vlm.model_name}
          mono
          reason="Đổi được nhưng phải khớp với model vLLM đang serve"
          envVar="VLM_MODEL_NAME"
        />
        <LockedSetting
          label="VLM endpoint"
          value={data.models.vlm.endpoint}
          mono
          reason="Client đã tạo theo endpoint này"
          envVar="VLM_ENDPOINT"
        />
        <LockedSetting
          label="VLM API key"
          value={data.models.vlm.api_key_configured ? "đã cấu hình" : "chưa có"}
          reason="Secret không bao giờ trả ra khỏi server"
          envVar="OPENAI_API_KEY"
        />
      </SettingGroup>

      <SettingGroup title="Lưu trữ">
        <LockedSetting
          label="Thư mục metadata"
          value={data.metadata_dir}
          mono
          reason="Worker và backend phải trỏ chung một volume"
          envVar="METADATA_DIR"
        />
        <LockedSetting
          label="Mức log"
          value={data.log_level}
          reason="Đọc lúc khởi động service"
          envVar="LOG_LEVEL"
        />
      </SettingGroup>
    </>
  );
}

/* ---------- Phụ trợ ---------- */

function countOverrides<T extends object>(current: T, defaults: T): number {
  let count = 0;
  for (const key of Object.keys(current) as (keyof T)[]) {
    const value = current[key];
    if (value === undefined) continue;
    if (defaults[key] === undefined || value !== defaults[key]) count += 1;
  }
  return count;
}

function countNested(obj: object): number {
  let count = 0;
  for (const value of Object.values(obj)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      count += countNested(value as object);
      continue;
    }
    count += 1;
  }
  return count;
}

function LoadingRows() {
  return (
    <div className="space-y-2" aria-busy="true">
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
    </div>
  );
}

function BackendOffline() {
  return (
    <div className="rounded-md border border-dashed px-4 py-10 text-center" role="status">
      <Lock className="mx-auto size-5 text-muted-foreground/70" aria-hidden />
      <p className="mt-3 text-[15px] font-medium">Chưa đọc được cấu hình</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Giá trị mặc định lấy từ server nên cần backend chạy. Bạn vẫn đổi được tham số
        nhưng sẽ không thấy giá trị gốc để so.
      </p>
    </div>
  );
}
