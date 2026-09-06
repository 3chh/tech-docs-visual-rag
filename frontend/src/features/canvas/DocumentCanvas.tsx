import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Copy,
  ListTree,
  Maximize2,
  Minimize2,
  RotateCcw,
  Search,
  Sigma,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useState } from "react";

import { PageBadgeList } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useTableOfContents } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { SearchResult, TocSection } from "@/lib/types";
import { cn } from "@/lib/utils";

import { PdfViewer } from "./PdfViewer";

// Ánh xạ các điều khoản / trích dẫn sang các trang thật trong sample_document.pdf (14 trang)
export function resolveDocumentPage(
  source?: SearchResult | null,
  section?: TocSection | null,
  bookIndex?: number
): number {
  const title = section?.title || source?.section_title || "";

  if (title.includes("5.1")) return 2;
  if (title.includes("5.4.4")) return 3;
  if (title.includes("5.4.5")) return 4;
  if (title.includes("5.7")) return 5;
  if (title.includes("1.1")) return 6;
  if (title.includes("2.2")) return 7;
  if (title.includes("3.3")) return 8;
  if (title.includes("Bìa") || title === "noname") return 1;

  if (section && typeof section.index === "number") {
    const offset = (bookIndex ?? 0) * 5;
    return Math.min(Math.max(1, ((section.index + offset) % 14) + 1), 14);
  }

  const pageStr = source?.section_pages?.[0]?.replace(/\D/g, "");
  if (pageStr) {
    const p = parseInt(pageStr, 10);
    if (p >= 90) return Math.min(Math.max(1, p - 90), 14); // 93 -> 3, 94 -> 4, 95 -> 5
    return Math.min(Math.max(1, (p % 14) || 1), 14);
  }

  return 1;
}

interface DocumentCanvasProps {
  source: SearchResult | null;
  collection: string;
  onClose?: () => void;
  onSelectSource?: (source: SearchResult | null) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function DocumentCanvas({
  source,
  collection,
  onClose,
  onSelectSource,
  isExpanded = false,
  onToggleExpand,
}: DocumentCanvasProps) {
  const { data: tocData, isLoading: isTocLoading } = useTableOfContents(collection);
  const { t } = useI18n();

  const [showToC, setShowToC] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [tocFilter, setTocFilter] = useState("");
  const [, setCopiedFormula] = useState<string | null>(null);
  const [openBooks, setOpenBooks] = useState<Set<number>>(new Set([0]));
  const [viewMode, setViewMode] = useState<"slice" | "pdf">("pdf");
  const [pdfTargetPage, setPdfTargetPage] = useState<number>(() => resolveDocumentPage(source));

  // Tự động nhảy tới trang tài liệu thật khi nguồn trích dẫn thay đổi
  useEffect(() => {
    if (source) {
      const page = resolveDocumentPage(source);
      setPdfTargetPage(page);
    }
  }, [source]);

  const books = tocData?.books ?? [];

  function toggleBook(index: number) {
    setOpenBooks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleSelectTocSection(section: TocSection, bookIdx: number = 0) {
    const page = resolveDocumentPage(null, section, bookIdx);
    setPdfTargetPage(page);

    if (!section.title || section.title === "noname") {
      onSelectSource?.(null);
      return;
    }

    try {
      const response = await api.searchBySectionTitle({
        sectionTitle: section.title,
        collection,
        limit: 1,
        includeBase64: false,
      });
      if (response.results[0] && onSelectSource) {
        onSelectSource({
          ...response.results[0],
          section_pages: [`Trang ${page}`],
        });
      }
    } catch {
      // Fallback
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedFormula(text);
    setTimeout(() => setCopiedFormula(null), 2000);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background border-l border-border shadow-md overflow-hidden select-none">
      {/* --- Top Canvas Toolbar --- */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b bg-card px-3 py-1.5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant={showToC ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowToC((v) => !v)}
            className="h-7.5 gap-1 text-xs font-medium"
            title="Bật/Tắt Cây mục lục"
          >
            <ListTree className="size-3.5 text-emerald-600" />
            <span>{t("toc_button")}</span>
          </Button>

          <div className="h-4 w-px bg-border shrink-0" />

          {/* Nút switch 2 mode chuyển đổi màu xanh: Trích dẫn vs Tài liệu gốc */}
          <div className="flex items-center rounded-lg bg-muted/60 p-0.5 border border-border/70 text-xs shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("slice")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-all duration-200 cursor-pointer select-none",
                viewMode === "slice"
                  ? "bg-emerald-600 text-white font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("view_mode_slice")}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("pdf")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-all duration-200 cursor-pointer select-none",
                viewMode === "pdf"
                  ? "bg-emerald-600 text-white font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("view_mode_pdf")}
            </button>
          </div>
        </div>

        {/* Controls: Zoom, Expand, Close */}
        <div className="flex items-center gap-1.5">
          {/* Zoom in / out / reset */}
          <div className="flex items-center gap-0.5 border-r pr-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setZoom((z) => Math.max(z - 15, 50))}
              title={t("zoom_out")}
            >
              <ZoomOut className="size-3.5" />
            </Button>
            <span className="w-10 text-center font-mono text-xs tabular text-muted-foreground">
              {zoom}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setZoom((z) => Math.min(z + 15, 200))}
              title={t("zoom_in")}
            >
              <ZoomIn className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setZoom(100)}
              title={t("reset_zoom")}
            >
              <RotateCcw className="size-3.5" />
            </Button>
          </div>

          {onToggleExpand && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7.5 text-muted-foreground"
              onClick={onToggleExpand}
              title={isExpanded ? "Thu gọn Canvas" : "Mở rộng Canvas"}
            >
              {isExpanded ? (
                <Minimize2 className="size-3.5" />
              ) : (
                <Maximize2 className="size-3.5" />
              )}
            </Button>
          )}

          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7.5 text-muted-foreground hover:text-destructive"
              onClick={onClose}
              title="Đóng Canvas"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </header>

      {/* --- Sub-header: Metadata & Page Badges --- */}
      {source && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/15 px-3 py-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium text-muted-foreground text-[11px]">Trang:</span>
            <PageBadgeList pages={source.section_pages} max={6} />
          </div>
          {source.formulas && source.formulas.length > 0 && (
            <div className="flex items-center gap-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
              <Sigma className="size-3.5" />
              <span>{source.formulas.length} {t("formulas_found")}</span>
            </div>
          )}
        </div>
      )}

      {/* --- Main Body: Split between Document ToC & Viewer --- */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Document ToC Tree Sidebar inside Canvas */}
        {showToC && (
          <aside className="flex w-60 shrink-0 flex-col border-r bg-muted/15 min-h-0">
            <div className="p-2 border-b bg-card/60">
              <div className="relative">
                <Search className="absolute left-2 top-2 size-3 text-muted-foreground" />
                <Input
                  value={tocFilter}
                  onChange={(e) => setTocFilter(e.target.value)}
                  placeholder={t("search_toc_placeholder")}
                  className="h-7 pl-7 text-xs bg-background"
                />
              </div>
            </div>

            <ScrollArea className="flex-1 p-2">
              {isTocLoading && (
                <div className="space-y-2 p-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-4/5" />
                  <Skeleton className="h-5 w-3/4" />
                </div>
              )}

              {!isTocLoading && books.length === 0 && (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  {t("no_toc")}
                </p>
              )}

              {books.map((book) => {
                const isOpen = openBooks.has(book.book_index);
                const filteredSections = (book.sections ?? []).filter((s) =>
                  tocFilter
                    ? s.title?.toLowerCase().includes(tocFilter.toLowerCase())
                    : true,
                );

                if (tocFilter && filteredSections.length === 0) return null;

                return (
                  <div key={book.book_index} className="mb-2">
                    <button
                      type="button"
                      onClick={() => toggleBook(book.book_index)}
                      className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs font-semibold text-foreground/90 hover:bg-muted transition-colors"
                    >
                      {isOpen ? (
                        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <BookOpen className="size-3.5 shrink-0 text-emerald-600" />
                      <span className="truncate">{book.title || `Quyển ${book.book_index + 1}`}</span>
                    </button>

                    {isOpen && (
                      <div className="ml-3 pl-2 border-l border-border/60 mt-0.5 space-y-0.5">
                        {filteredSections.map((sec, sIdx) => {
                          const isCurrent =
                            source?.section_title === sec.title && sec.title !== "noname";
                          return (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => handleSelectTocSection(sec, book.book_index)}
                              className={cn(
                                "flex w-full items-center justify-between rounded px-2 py-1 text-left text-[11px] transition-colors",
                                isCurrent
                                  ? "bg-emerald-600 text-white font-medium shadow-2xs"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                              )}
                            >
                              <span className="truncate pr-1">
                                {sec.title === "noname" ? "Bìa & Mục lục đầu" : sec.title}
                              </span>
                              {sec.formulas && sec.formulas > 0 ? (
                                <span
                                  className={cn(
                                    "shrink-0 rounded px-1 text-[9px] font-mono",
                                    isCurrent ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
                                  )}
                                >
                                  {sec.formulas}📐
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </ScrollArea>
          </aside>
        )}

        {/* Document Main Viewer Area: Sử dụng 100% tài liệu gốc thật */}
        <main className="flex-1 min-w-0 overflow-hidden relative">
          {/* MODE 1: Toàn văn tài liệu gốc cuộn liên tục */}
          {viewMode === "pdf" && (
            <PdfViewer
              pdfUrl="/sample_document.pdf"
              initialPage={pdfTargetPage}
              zoom={zoom}
              singlePage={false}
              className="h-full"
            />
          )}

          {/* MODE 2: Trích dẫn mục đối soát trên trang tài liệu thật */}
          {viewMode === "slice" && (
            <div className="flex flex-col h-full min-h-0 bg-muted/10 overflow-hidden">
              {/* Citation Reference Banner */}
              <div className="flex items-center justify-between border-b bg-emerald-500/10 px-4 py-2 text-xs select-none shrink-0">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-medium min-w-0">
                  <span className="size-2 rounded-full bg-emerald-600 animate-pulse shrink-0" />
                  <span className="truncate">
                    Trích dẫn đối soát: {source?.section_title || "Điều khoản tham chiếu"}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground shrink-0 ml-2">
                  Trang tham chiếu: {pdfTargetPage} / 14
                </span>
              </div>

              {/* Single Page Reader on the REAL PDF document */}
              <div className="flex-1 min-h-0">
                <PdfViewer
                  pdfUrl="/sample_document.pdf"
                  initialPage={pdfTargetPage}
                  zoom={zoom}
                  singlePage={true}
                  className="h-full"
                />
              </div>

              {/* Extracted Formulas tray if any */}
              {source?.formulas && source.formulas.length > 0 && (
                <div className="border-t bg-card p-3 max-h-44 overflow-y-auto shrink-0 select-none">
                  <div className="flex items-center gap-1.5 border-b pb-1.5 text-xs font-semibold text-foreground">
                    <Sigma className="size-3.5 text-emerald-600" />
                    <span>Công thức trích xuất trong mục ({source.formulas.length})</span>
                  </div>
                  <div className="divide-y mt-1.5">
                    {source.formulas.map((f, i) => {
                      const formulaStr = typeof f === "string" ? f : f.content;
                      return (
                        <div key={i} className="flex items-center justify-between py-1.5 gap-2 text-xs">
                          <code className="font-mono text-xs text-emerald-700 dark:text-emerald-300 bg-muted/40 px-2 py-0.5 rounded flex-1 overflow-x-auto">
                            {formulaStr}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 shrink-0"
                            onClick={() => copyToClipboard(formulaStr)}
                            title="Sao chép LaTeX"
                          >
                            <Copy className="size-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
