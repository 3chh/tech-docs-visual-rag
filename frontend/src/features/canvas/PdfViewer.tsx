import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Cấu hình Worker cho pdfjs-dist
if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

interface PdfViewerProps {
  pdfUrl?: string;
  initialPage?: number;
  zoom?: number; // % ví dụ 100
  onPageChange?: (page: number, totalPages: number) => void;
  className?: string;
}

export function PdfViewer({
  pdfUrl = "/sample_document.pdf",
  initialPage = 1,
  zoom = 100,
  onPageChange,
  className,
}: PdfViewerProps) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jumpPageInput, setJumpPageInput] = useState(String(initialPage));

  // Tải tài liệu PDF thật từ URL
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });

    loadingTask.promise
      .then((doc) => {
        if (isCancelled) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(Math.min(initialPage, doc.numPages));
        setJumpPageInput(String(Math.min(initialPage, doc.numPages)));
        setIsLoading(false);
        onPageChange?.(Math.min(initialPage, doc.numPages), doc.numPages);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error("PDF load error:", err);
        setError(err instanceof Error ? err.message : "Không nạp được tệp PDF");
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
      loadingTask.destroy();
    };
  }, [pdfUrl]);

  // Cập nhật trang khi initialPage đổi từ ngoài
  useEffect(() => {
    if (initialPage >= 1 && initialPage <= totalPages && initialPage !== currentPage) {
      setCurrentPage(initialPage);
      setJumpPageInput(String(initialPage));
    }
  }, [initialPage, totalPages]);

  // Render trang PDF lên canvas HTML5
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let isCancelled = false;

    // Hủy render task cũ nếu đang vẽ dở
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // ignore cancel error
      }
    }

    pdfDoc.getPage(currentPage).then((page: any) => {
      if (isCancelled || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;

      // Tính tỉ lệ phóng to kèm hỗ trợ màn hình Retina (DPR)
      const scale = (zoom / 100) * 1.5;
      const viewport = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const task = page.render(renderContext);
      renderTaskRef.current = task;

      task.promise
        .then(() => {
          renderTaskRef.current = null;
        })
        .catch((err: any) => {
          if (err?.name !== "RenderingCancelledException") {
            console.error("Page render error:", err);
          }
        });
    });

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDoc, currentPage, zoom]);

  function handlePrev() {
    if (currentPage > 1) {
      const p = currentPage - 1;
      setCurrentPage(p);
      setJumpPageInput(String(p));
      onPageChange?.(p, totalPages);
    }
  }

  function handleNext() {
    if (currentPage < totalPages) {
      const p = currentPage + 1;
      setCurrentPage(p);
      setJumpPageInput(String(p));
      onPageChange?.(p, totalPages);
    }
  }

  function handleJump() {
    const val = parseInt(jumpPageInput, 10);
    if (!Number.isNaN(val) && val >= 1 && val <= totalPages) {
      setCurrentPage(val);
      onPageChange?.(val, totalPages);
    } else {
      setJumpPageInput(String(currentPage));
    }
  }

  return (
    <div className={cn("flex flex-col h-full min-h-0 bg-muted/10", className)}>
      {/* PDF Controls Header Bar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b bg-card/70 px-4 py-1.5 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
          <FileText className="size-3.5 text-emerald-600" />
          <span className="font-mono text-[11px] truncate max-w-[200px]">
            {pdfUrl.split("/").pop()}
          </span>
        </div>

        {/* Page navigation controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded"
            onClick={handlePrev}
            disabled={currentPage <= 1 || isLoading}
            title={t("prev_page")}
          >
            <ChevronLeft className="size-4" />
          </Button>

          <div className="flex items-center gap-1 font-mono text-[11px]">
            <span>{t("page_counter")}</span>
            <Input
              value={jumpPageInput}
              onChange={(e) => setJumpPageInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJump()}
              onBlur={handleJump}
              className="h-6 w-11 px-1 text-center font-mono text-xs tabular"
              disabled={isLoading}
            />
            <span className="text-muted-foreground">/ {totalPages}</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded"
            onClick={handleNext}
            disabled={currentPage >= totalPages || isLoading}
            title={t("next_page")}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Main Canvas Scroll Area */}
      <div className="flex-1 min-h-0 overflow-auto p-4 flex flex-col items-center justify-start">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <Loader2 className="size-6 animate-spin text-emerald-600" />
            <p className="text-xs text-muted-foreground">Đang tải và dựng file PDF thật...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-destructive max-w-sm text-center">
            <AlertCircle className="size-6" />
            <p className="text-xs font-semibold">Không thể nạp tệp PDF</p>
            <p className="text-[11px] text-muted-foreground">{error}</p>
          </div>
        )}

        {!isLoading && !error && (
          <div className="rounded-md border bg-card shadow-md overflow-hidden transition-transform duration-100">
            <canvas ref={canvasRef} className="block select-none" />
          </div>
        )}
      </div>
    </div>
  );
}
