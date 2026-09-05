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
  zoom?: number; // % ví dụ 100 nghĩa là 100% fit width
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jumpPageInput, setJumpPageInput] = useState(String(initialPage));
  const [containerWidth, setContainerWidth] = useState(800);

  // Theo dõi chiều rộng container để tự động tính Fit-to-Width hoàn hảo
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });

    observer.observe(containerRef.current);
    if (containerRef.current.clientWidth > 0) {
      setContainerWidth(containerRef.current.clientWidth);
    }

    return () => observer.disconnect();
  }, []);

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

  // Render trang PDF lên canvas HTML5 với cơ chế Fit-to-Width chính xác
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

      // 1. Đo kích thước gốc không scale của trang PDF
      const unscaledViewport = page.getViewport({ scale: 1.0 });

      // 2. Tính tỷ lệ để trang PDF vừa khít 100% bề rộng container (Fit to Width)
      const horizontalPadding = 36; // Lề trái phải
      const availableWidth = Math.max(containerWidth - horizontalPadding, 320);
      const fitWidthScale = availableWidth / unscaledViewport.width;

      // 3. Tỷ lệ thực tế: 100% zoom tương ứng với đúng 100% Fit trang vào khung nhìn
      const effectiveScale = fitWidthScale * (zoom / 100);

      const viewport = page.getViewport({ scale: effectiveScale });
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
  }, [pdfDoc, currentPage, zoom, containerWidth]);

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
    const p = parseInt(jumpPageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setCurrentPage(p);
      onPageChange?.(p, totalPages);
    } else {
      setJumpPageInput(String(currentPage));
    }
  }

  return (
    <div className={cn("flex flex-col h-full min-h-0 bg-muted/10", className)}>
      {/* PDF Controls Header Bar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b bg-card/70 px-4 py-1.5 text-xs select-none">
        <div className="flex items-center gap-2 text-muted-foreground font-medium min-w-0">
          <FileText className="size-3.5 text-emerald-600 shrink-0" />
          <span className="font-mono text-[11px] truncate max-w-[220px]">
            {pdfUrl.split("/").pop()}
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-medium">
            Fit 100%
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
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto p-4 flex flex-col items-center justify-start"
      >
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-2">
            <Loader2 className="size-7 animate-spin text-emerald-600" />
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
          <div className="rounded-md border bg-card shadow-md overflow-hidden transition-all duration-150 my-auto">
            <canvas ref={canvasRef} className="block select-none" />
          </div>
        )}
      </div>
    </div>
  );
}
