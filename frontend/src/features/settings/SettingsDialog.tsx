import { useQuery } from "@tanstack/react-query";
import { Info, Lock, Settings2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AskOptions } from "@/features/ask/AskComposer";
import { api } from "@/lib/api";

const TOP_K_OPTIONS = [3, 5, 8, 12, 16, 20];

/**
 * Cấu hình hệ thống, chia theo *ai đổi được và khi nào*:
 *
 * - Tra cứu  : UI đổi ngay, gửi kèm mỗi câu hỏi
 * - Xử lý PDF: đổi qua biến môi trường, cần khởi động lại worker
 * - Chỉ mục  : embedding và vector DB, cần khởi động lại backend
 * - Model    : VLM và LLM
 *
 * Ba nhóm sau chỉ đọc vì model đã nạp vào VRAM theo tham số cũ; đổi nóng sẽ
 * làm vector đã index không so được với vector mới.
 */
export function SettingsDialog({
  options,
  onOptionsChange,
}: {
  options: AskOptions;
  onOptionsChange: (options: AskOptions) => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["settings"],
    queryFn: api.settings,
    staleTime: 5 * 60_000,
    retry: false,
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Settings2 className="size-4" aria-hidden />
          Cấu hình
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Cấu hình</DialogTitle>
          <DialogDescription>
            Tham số tra cứu đổi được ngay. Tham số xử lý và chỉ mục đọc từ biến môi
            trường, đổi cần khởi động lại service.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="runtime" className="min-h-0 gap-0">
          <TabsList className="mx-5 mt-4 w-auto">
            <TabsTrigger value="runtime">Tra cứu</TabsTrigger>
            <TabsTrigger value="document">Xử lý PDF</TabsTrigger>
            <TabsTrigger value="indexing">Chỉ mục</TabsTrigger>
            <TabsTrigger value="models">Model</TabsTrigger>
          </TabsList>

          <div className="max-h-[55dvh] overflow-y-auto px-5 py-4">
            <TabsContent value="runtime" className="mt-0">
              <RuntimeTab options={options} onChange={onOptionsChange} data={data} />
            </TabsContent>

            <TabsContent value="document" className="mt-0 space-y-5">
              {isLoading && <LoadingRows />}
              {isError && <BackendOffline />}
              {data && <DocumentTab data={data} />}
            </TabsContent>

            <TabsContent value="indexing" className="mt-0 space-y-5">
              {isLoading && <LoadingRows />}
              {isError && <BackendOffline />}
              {data && <IndexingTab data={data} />}
            </TabsContent>

            <TabsContent value="models" className="mt-0 space-y-5">
              {isLoading && <LoadingRows />}
              {isError && <BackendOffline />}
              {data && <ModelsTab data={data} />}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Nhóm 1: đổi được ngay ---------- */

function RuntimeTab({
  options,
  onChange,
  data,
}: {
  options: AskOptions;
  onChange: (options: AskOptions) => void;
  data?: import("@/lib/types").SettingsResponse;
}) {
  const max = data?.runtime.top_k_max ?? 20;
  const allowed = TOP_K_OPTIONS.filter((n) => n <= max);

  return (
    <div className="space-y-5">
      <Group title="Truy xuất">
        <Row
          label="Số mục lấy về"
          hint="Càng nhiều càng chậm vì VLM phải đọc nhiều ảnh hơn"
          control={
            <Select
              value={String(options.topK)}
              onValueChange={(next) => onChange({ ...options, topK: Number(next) })}
            >
              <SelectTrigger size="sm" className="w-24 font-mono tabular">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowed.map((n) => (
                  <SelectItem key={n} value={String(n)} className="font-mono tabular">
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        <Row
          label="Chuẩn hoá thuật ngữ theo mục lục"
          hint="Cho VLM đọc ảnh bìa và mục lục rồi viết lại câu hỏi bằng thuật ngữ có thật trong tài liệu. Tắt đi sẽ nhanh hơn một lượt gọi model"
          control={
            <Switch
              checked={options.useTocRewrite}
              onCheckedChange={(checked) =>
                onChange({ ...options, useTocRewrite: checked })
              }
            />
          }
        />

        {data && (
          <ReadOnlyRow
            label="Số ảnh mục lục dùng để chuẩn hoá"
            value={data.runtime.toc_preview_limit}
            envVar="—"
          />
        )}
      </Group>
    </div>
  );
}

/* ---------- Nhóm 2: xử lý PDF ---------- */

function DocumentTab({ data }: { data: import("@/lib/types").SettingsResponse }) {
  const d = data.document;
  const p = d.preprocess;
  const img = p.pdf_to_image;

  return (
    <>
      <ReadOnlyNote />

      <Group title="PDF sang ảnh">
        <ReadOnlyRow
          label="DPI mục tiêu"
          value={img.dpi}
          hint="DPI thực tế tính động theo khổ trang để mọi sách ra ảnh có cùng lượng pixel"
          envVar="—"
        />
        <ReadOnlyRow label="DPI tối thiểu" value={img.min_dpi} envVar="—" />
        <ReadOnlyRow
          label="Số pixel chuẩn hoá"
          value={img.anchor_size.toLocaleString("vi-VN")}
          hint="Mốc để tính DPI động: anchor / (rộng × cao) × dpi"
          envVar="—"
        />
        <ReadOnlyRow label="Số luồng render" value={img.thread_count} envVar="—" />
        <ReadOnlyRow
          label="Tách đôi trang (mặc định)"
          value={img.vertical_split}
          hint="Đổi được cho từng file lúc tải lên"
          envVar="—"
        />
      </Group>

      <Group title="Cắt lề">
        <ReadOnlyRow label="Bật cắt lề" value={p.use_cut_padding} envVar="—" />
        <ReadOnlyRow
          label="Lề chừa lại"
          value={`${p.padding} px`}
          hint="Bỏ lề trắng là bỏ visual token vô nghĩa"
          envVar="—"
        />
        <ReadOnlyRow
          label="Cắt cứng [trên, dưới, trái, phải]"
          value={`[${p.cut_params.join(", ")}]`}
          envVar="—"
        />
        <ReadOnlyRow label="Model dò chữ" value={p.text_model} mono envVar="—" />
        <ReadOnlyRow label="Batch size" value={p.batch_size} envVar="—" />
      </Group>

      <Group title="Nhận diện bố cục">
        <ReadOnlyRow label="Model" value={d.layout.model_name} mono envVar="—" />
        <ReadOnlyRow label="Batch size" value={d.layout.batch_size} envVar="—" />
      </Group>

      <Group title="OCR">
        <ReadOnlyRow label="Batch tiêu đề" value={d.ocr.title_batch_size} envVar="—" />
        <ReadOnlyRow label="Batch số trang" value={d.ocr.number_batch_size} envVar="—" />
        <ReadOnlyRow label="Batch công thức" value={d.ocr.formula_batch_size} envVar="—" />
        <ReadOnlyRow label="Nạp model trễ" value={d.ocr.lazy_load} envVar="—" />
      </Group>

      <Group title="Cắt mục (chunking)">
        <ReadOnlyRow
          label="Lề cắt số trang"
          value={`${d.chunking.cut_padding} px`}
          hint="Cắt bỏ chân trang trước khi ghép ảnh-mục"
          envVar="—"
        />
        <ReadOnlyRow
          label="Bỏ số trang khỏi ảnh ghép"
          value={d.chunking.remove_page_number}
          envVar="—"
        />
        <ReadOnlyRow
          label="Giữ ảnh từng trang gốc"
          value={d.chunking.keep_chunk_pages}
          hint="Dùng để đối chiếu với bản in"
          envVar="—"
        />
        <ReadOnlyRow
          label="Chiều cao mục tối thiểu"
          value={`${d.chunking.min_section_height_px} px`}
          hint="Mục thấp hơn ngưỡng coi như chỉ có tiêu đề, gộp vào mục trước"
          envVar="—"
        />
      </Group>

      <Group title="LLM sửa cây mục lục">
        <ReadOnlyRow label="Nhà cung cấp" value={d.toc_validator.type} envVar="TOC_VALIDATOR_TYPE" />
        <ReadOnlyRow
          label="Model"
          value={d.toc_validator.model_name}
          mono
          envVar="TOC_VALIDATOR_MODEL_NAME"
        />
        <ReadOnlyRow
          label="Endpoint"
          value={d.toc_validator.endpoint}
          mono
          envVar="TOC_VALIDATOR_ENDPOINT"
        />
        <ReadOnlyRow
          label="Temperature"
          value={d.toc_validator.temperature}
          envVar="TOC_VALIDATOR_TEMPERATURE"
        />
        <ReadOnlyRow
          label="API key"
          value={d.toc_validator.api_key_configured ? "đã cấu hình" : "chưa có"}
          envVar="GEMINI_API_KEY"
        />
      </Group>

      <Group title="Worker">
        <ReadOnlyRow
          label="Endpoint"
          value={d.worker_endpoint}
          mono
          envVar="PDF_WORKER_ENDPOINT"
        />
      </Group>
    </>
  );
}

/* ---------- Nhóm 3: chỉ mục ---------- */

function IndexingTab({ data }: { data: import("@/lib/types").SettingsResponse }) {
  const e = data.indexing.embedding;
  const v = data.indexing.vectordb;

  return (
    <>
      <ReadOnlyNote warning="Đổi tham số embedding làm vector đã index không so được với vector mới. Phải index lại toàn bộ." />

      <Group title="Embedding">
        <ReadOnlyRow label="Loại" value={e.type} envVar="EMBEDDING_TYPE" />
        <ReadOnlyRow label="Model" value={e.model_name} mono envVar="EMBEDDING_MODEL_NAME" />
        <ReadOnlyRow label="Thiết bị" value={e.device} envVar="EMBEDDING_DEVICE" />
        <ReadOnlyRow label="Số chiều vector" value={e.dim} envVar="EMBEDDING_DIM" />
        <ReadOnlyRow
          label="Visual token tối đa"
          value={e.max_num_visual_tokens.toLocaleString("vi-VN")}
          hint="Giảm xuống 4096 nếu thiếu VRAM, đánh đổi là chữ nhỏ khó đọc hơn"
          envVar="EMBEDDING_MAX_NUM_VISUAL_TOKENS"
        />
        <ReadOnlyRow
          label="Chiều rộng tối thiểu"
          value={e.min_width ? `${e.min_width} px` : "không đặt"}
          hint="Ghim chiều rộng trước rồi để chiều cao tự do, nhờ đó ảnh-mục cao vẫn đọc được chữ"
          envVar="EMBEDDING_MIN_WIDTH"
        />
        <ReadOnlyRow
          label="Vector mỗi ảnh-mục"
          value={e.doc_dim.toLocaleString("vi-VN")}
          hint={`${e.max_num_visual_tokens} visual token + ${e.prefix_num_tokens} prefix`}
          envVar="—"
        />
        <ReadOnlyRow label="Chế độ batching" value={e.batching_mode} envVar="EMBEDDING_BATCHING_MODE" />
        <ReadOnlyRow
          label="Ngân sách token mỗi batch"
          value={e.max_token.toLocaleString("vi-VN")}
          hint="Sort ảnh theo số token rồi gộp batch theo ngân sách để giảm padding"
          envVar="EMBEDDING_MAX_TOKEN"
        />
        <ReadOnlyRow label="Batch size" value={e.batch_size} envVar="EMBEDDING_BATCH_SIZE" />
      </Group>

      <Group title="Vector database">
        <ReadOnlyRow label="Loại" value={v.type} envVar="VECTORDB_TYPE" />
        <ReadOnlyRow label="URI" value={v.uri} mono envVar="VECTORDB_URI" />
        <ReadOnlyRow label="Cổng gRPC" value={v.grpc_port} envVar="VECTORDB_GRPC_PORT" />
        <ReadOnlyRow label="Database" value={v.database_name} mono envVar="VECTORDB_DATABASE_NAME" />
        <ReadOnlyRow
          label="Collection"
          value={v.collection_name}
          mono
          envVar="VECTORDB_COLLECTION_NAME"
        />
        <ReadOnlyRow
          label="Giới hạn tìm kiếm"
          value={v.search_limit.toLocaleString("vi-VN")}
          envVar="VECTORDB_SEARCH_LIMIT"
        />
        <ReadOnlyRow
          label="Batch ghi"
          value={v.upsert_batch_size.toLocaleString("vi-VN")}
          envVar="—"
        />
      </Group>

      <Group title="Lưu trữ">
        <ReadOnlyRow label="Thư mục dữ liệu" value={data.data_dir} mono envVar="DATA_DIR" />
        <ReadOnlyRow label="Thư mục metadata" value={data.metadata_dir} mono envVar="METADATA_DIR" />
        <ReadOnlyRow label="Mức log" value={data.log_level} envVar="LOG_LEVEL" />
      </Group>
    </>
  );
}

/* ---------- Nhóm 4: model ---------- */

function ModelsTab({ data }: { data: import("@/lib/types").SettingsResponse }) {
  return (
    <>
      <ReadOnlyNote />

      <Group title="VLM đọc ảnh và trả lời">
        <ReadOnlyRow label="Nhà cung cấp" value={data.models.vlm.type} envVar="VLM_TYPE" />
        <ReadOnlyRow label="Model" value={data.models.vlm.model_name} mono envVar="VLM_MODEL_NAME" />
        <ReadOnlyRow label="Endpoint" value={data.models.vlm.endpoint} mono envVar="VLM_ENDPOINT" />
        <ReadOnlyRow
          label="API key"
          value={data.models.vlm.api_key_configured ? "đã cấu hình" : "chưa có"}
          envVar="OPENAI_API_KEY"
        />
      </Group>

      <Group title="LLM cho tác vụ text">
        <ReadOnlyRow label="Nhà cung cấp" value={data.models.llm.type} envVar="LLM_TYPE" />
        <ReadOnlyRow label="Model" value={data.models.llm.model_name} mono envVar="LLM_MODEL_NAME" />
        <ReadOnlyRow label="Endpoint" value={data.models.llm.endpoint} mono envVar="LLM_ENDPOINT" />
      </Group>
    </>
  );
}

/* ---------- Khối dựng ---------- */

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-0">
      <h3 className="border-b pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="divide-y">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  control,
}: {
  label: string;
  hint?: string;
  control: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <Label className="text-[15px] font-normal">{label}</Label>
        {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}

function ReadOnlyRow({
  label,
  value,
  hint,
  mono,
  envVar,
}: {
  label: string;
  value: string | number | boolean;
  hint?: string;
  mono?: boolean;
  envVar?: string;
}) {
  const display =
    typeof value === "boolean" ? (value ? "bật" : "tắt") : String(value);

  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[15px]">{label}</p>
        {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
        {envVar && envVar !== "—" && (
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{envVar}</p>
        )}
      </div>
      <span
        className={`shrink-0 rounded-sm bg-muted px-2 py-0.5 text-sm ${
          mono ? "font-mono" : "tabular"
        }`}
        title={display}
      >
        {display}
      </span>
    </div>
  );
}

function ReadOnlyNote({ warning }: { warning?: string }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-md border px-3 py-2.5 ${
        warning
          ? "border-destructive/25 bg-destructive/[0.04]"
          : "border-border bg-muted/40"
      }`}
    >
      {warning ? (
        <Info className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      ) : (
        <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <p className="text-sm text-muted-foreground">
        {warning ??
          "Nhóm này chỉ đọc. Đổi qua biến môi trường trong .env rồi khởi động lại service."}
      </p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2" aria-busy="true">
      <Skeleton className="h-10" />
      <Skeleton className="h-10" />
      <Skeleton className="h-10" />
    </div>
  );
}

function BackendOffline() {
  return (
    <div className="rounded-md border border-dashed px-4 py-8 text-center" role="status">
      <p className="text-[15px] font-medium">Chưa đọc được cấu hình</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Backend chưa chạy. Các tham số này lấy từ server.
      </p>
    </div>
  );
}
