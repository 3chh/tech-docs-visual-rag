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
  singlePage?: boolean;
}

const PAGE_GAP = 16; // khoảng cách giữa các trang (px)

interface PdfPageItemProps {
  pageNumber: number;
  pdfDoc: any;
  pageWidth: number;
  pageHeight: number;
  scale: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function PdfPageItem({
  pageNumber,
  pdfDoc,
  pageWidth,
  pageHeight,
  scale,
  containerRef,
}: PdfPageItemProps) {
  const itemRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const [shouldRender, setShouldRender] = useState(false);
  const [isRendered, setIsRendered] = useState(false);

  // Quan sát khi trang cuộn vào gần khung nhìn thì mới render canvas
  useEffect(() => {
    const el = itemRef.current;
    const container = containerRef.current;
    if (!el || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldRender(true);
          }
        }
      },
      {
        root: container,
        rootMargin: "600px 0px 600px 0px", // nạp trước trang cách viewport 600px
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  // Vẽ nội dung trang PDF lên canvas bằng pdfjs-dist
  useEffect(() => {
    if (!shouldRender || !pdfDoc || !canvasRef.current || pageWidth <= 0) return;

    let isCancelled = false;

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // ignore
      }
    }

    pdfDoc.getPage(pageNumber).then((page: any) => {
      if (isCancelled || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;

      const viewport = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const renderContext = {
        canvasContext: context,
        viewport,
      };

      const task = page.render(renderContext);
      renderTaskRef.current = task;

      task.promise
        .then(() => {
          renderTaskRef.current = null;
          setIsRendered(true);
        })
        .catch((err: any) => {
          if (err?.name !== "RenderingCancelledException") {
            console.error(`Page ${pageNumber} render error:`, err);
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
  }, [shouldRender, pdfDoc, pageNumber, scale, pageWidth]);

  return (
    <div
      ref={itemRef}
      id={`pdf-page-${pageNumber}`}
      data-page-number={pageNumber}
      style={{
        width: `${pageWidth}px`,
        height: `${pageHeight}px`,
      }}
      className="relative rounded-md border bg-card shadow-md shrink-0 flex items-center justify-center transition-shadow hover:shadow-lg select-none"
    >
      <canvas
        ref={canvasRef}
        className={cn(
          "block select-none pointer-events-none transition-opacity duration-150",
          isRendered ? "opacity-100" : "opacity-0"
        )}
      />
      {!isRendered && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/10 text-muted-foreground gap-2 pointer-events-none">
          <Loader2 className="size-5 animate-spin text-emerald-600" />
          <span className="text-[11px] font-mono">Trang {pageNumber}</span>
        </div>
      )}
      <div className="absolute bottom-2 right-2 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shadow-xs pointer-events-none backdrop-blur-xs border">
        {pageNumber}
      </div>
    </div>
  );
}

export function PdfViewer({
  pdfUrl = "/sample_document.pdf",
  initialPage = 1,
  zoom = 100,
  onPageChange,
  className,
  singlePage = false,
}: PdfViewerProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jumpPageInput, setJumpPageInput] = useState(String(initialPage));
  const [containerWidth, setContainerWidth] = useState(800);

  // Kích thước chuẩn từ trang đầu tiên
  const [unscaledWidth, setUnscaledWidth] = useState(595);
  const [pageAspectRatio, setPageAspectRatio] = useState(1.414);

  // Kéo thả chuột để di chuyển xem các phần khi phóng to (drag-to-pan)
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const isProgrammaticScrollRef = useRef(false);
  const prevPageHeightRef = useRef(0);

  // Theo dõi chiều rộng container để tính scale Fit-to-Width
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

  // Tải tài liệu PDF thật từ URL và lấy kích thước chuẩn của trang
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });

    loadingTask.promise
      .then(async (doc) => {
        if (isCancelled) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(Math.min(initialPage, doc.numPages));
        setJumpPageInput(String(Math.min(initialPage, doc.numPages)));

        // Lấy kích thước trang 1 để tính tỷ lệ chính xác
        try {
          const page1 = await doc.getPage(1);
          const vp = page1.getViewport({ scale: 1.0 });
          if (!isCancelled) {
            setUnscaledWidth(vp.width);
            setPageAspectRatio(vp.height / vp.width);
          }
        } catch (e) {
          console.warn("Could not inspect page 1 viewport:", e);
        }

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

  // Tính toán kích thước trang hiển thị
  const horizontalPadding = 48;
  const availableWidth = Math.max(containerWidth - horizontalPadding, 320);
  const fitWidthScale = unscaledWidth > 0 ? availableWidth / unscaledWidth : 1;
  const effectiveScale = fitWidthScale * (zoom / 100);
  const pageWidth = Math.floor(unscaledWidth * effectiveScale);
  const pageHeight = Math.floor(unscaledWidth * pageAspectRatio * effectiveScale);

  // Giữ nguyên vị trí cuộn tương đối khi người dùng zoom in / zoom out
  useEffect(() => {
    const container = containerRef.current;
    if (!container || prevPageHeightRef.current <= 0 || pageHeight <= 0) {
      prevPageHeightRef.current = pageHeight;
      return;
    }
    if (prevPageHeightRef.current !== pageHeight) {
      const ratio = pageHeight / prevPageHeightRef.current;
      container.scrollTop = container.scrollTop * ratio;
      prevPageHeightRef.current = pageHeight;
    }
  }, [pageHeight]);

  // Theo dõi sự kiện cuộn chuột để cập nhật số trang đang xem
  const handleScroll = () => {
    if (singlePage || isProgrammaticScrollRef.current) return;
    const container = containerRef.current;
    if (!container || pageHeight <= 0) return;

    const scrollTop = container.scrollTop;
    const pageStride = pageHeight + PAGE_GAP;
    const viewportMid = scrollTop + container.clientHeight / 2;
    const calcPage = Math.min(
      Math.max(1, Math.floor(viewportMid / pageStride) + 1),
      totalPages
    );

    if (calcPage !== currentPage) {
      setCurrentPage(calcPage);
      setJumpPageInput(String(calcPage));
      onPageChange?.(calcPage, totalPages);
    }
  };

  // Cuộn tới một trang cụ thể
  function scrollToPage(targetPage: number) {
    const container = containerRef.current;
    if (!container || pageHeight <= 0) return;
    const clampedPage = Math.min(Math.max(1, targetPage), totalPages);

    if (singlePage) {
      setCurrentPage(clampedPage);
      setJumpPageInput(String(clampedPage));
      onPageChange?.(clampedPage, totalPages);
      container.scrollTop = 0;
      return;
    }

    const pageStride = pageHeight + PAGE_GAP;
    const targetTop = (clampedPage - 1) * pageStride;

    isProgrammaticScrollRef.current = true;
    setCurrentPage(clampedPage);
    setJumpPageInput(String(clampedPage));
    onPageChange?.(clampedPage, totalPages);

    container.scrollTo({ top: targetTop, behavior: "smooth" });

    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 450);
  }

  // Chuyển trang khi initialPage hoặc pdfUrl thay đổi từ bên ngoài (nhấp ToC hoặc chọn trích dẫn)
  const prevInitialPageRef = useRef<number | null>(null);
  const prevPdfUrlRef = useRef<string>(pdfUrl);
  useEffect(() => {
    if (initialPage >= 1 && initialPage <= totalPages) {
      const urlChanged = prevPdfUrlRef.current !== pdfUrl;
      const pageChanged = prevInitialPageRef.current !== initialPage || initialPage !== currentPage;
      if (urlChanged || pageChanged) {
        prevPdfUrlRef.current = pdfUrl;
        prevInitialPageRef.current = initialPage;
        if (singlePage) {
          setCurrentPage(initialPage);
          setJumpPageInput(String(initialPage));
          onPageChange?.(initialPage, totalPages);
        } else if (pageHeight > 0) {
          scrollToPage(initialPage);
        }
      }
    }
  }, [initialPage, totalPages, pageHeight, singlePage, pdfUrl, currentPage]);

  // Kéo thả chuột để di chuyển (Pan) trong tài liệu
  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) return;

    const container = containerRef.current;
    if (!container) return;

    isDraggingRef.current = true;
    setIsPanning(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };

    const handleGlobalMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      moveEvent.preventDefault();
      const dx = moveEvent.clientX - dragStartRef.current.x;
      const dy = moveEvent.clientY - dragStartRef.current.y;
      containerRef.current.scrollLeft = dragStartRef.current.scrollLeft - dx;
      containerRef.current.scrollTop = dragStartRef.current.scrollTop - dy;
    };

    const handleGlobalMouseUp = () => {
      isDraggingRef.current = false;
      setIsPanning(false);
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
  }

  function handlePrev() {
    if (currentPage > 1) {
      scrollToPage(currentPage - 1);
    }
  }

  function handleNext() {
    if (currentPage < totalPages) {
      scrollToPage(currentPage + 1);
    }
  }

  function handleJump() {
    const p = parseInt(jumpPageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      scrollToPage(p);
    } else {
      setJumpPageInput(String(currentPage));
    }
  }

  const pagesToRender = singlePage
    ? [currentPage]
    : Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className={cn("flex flex-col h-full min-h-0 bg-muted/10", className)}>
      {/* PDF Controls Header Bar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b bg-card/70 px-4 py-1.5 text-xs select-none">
        <div className="flex items-center gap-2 text-muted-foreground font-medium min-w-0">
          <FileText className="size-3.5 text-emerald-600 shrink-0" />
          <span className="font-mono text-[11px] truncate max-w-[280px]">
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

      {/* Main Canvas Scroll Area: Cuộn dọc hoặc hiển thị trang đối soát */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onScroll={handleScroll}
        className={cn(
          "flex-1 min-h-0 overflow-auto p-4 select-none",
          isPanning ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-2">
            <Loader2 className="size-7 animate-spin text-emerald-600" />
            <p className="text-xs text-muted-foreground">Đang nạp tài liệu PDF...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-destructive max-w-sm text-center mx-auto">
            <AlertCircle className="size-6" />
            <p className="text-xs font-semibold">Không thể nạp tệp PDF</p>
            <p className="text-[11px] text-muted-foreground">{error}</p>
          </div>
        )}

        {!isLoading && !error && (
          <div
            className="flex flex-col items-center mx-auto pb-16"
            style={{
              width: pageWidth > availableWidth ? `${pageWidth}px` : "100%",
              gap: `${PAGE_GAP}px`,
            }}
          >
            {pagesToRender.map((pageNum) => (
              <PdfPageItem
                key={pageNum}
                pageNumber={pageNum}
                pdfDoc={pdfDoc}
                pageWidth={pageWidth}
                pageHeight={pageHeight}
                scale={effectiveScale}
                containerRef={containerRef}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
