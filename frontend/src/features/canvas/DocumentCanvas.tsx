import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  FileWarning,
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
import { useState } from "react";

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

interface DocumentCanvasProps {
  source: SearchResult | null;
  collection: string;
  onClose?: () => void;
  onSelectSource?: (source: SearchResult) => void;
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
  const [copiedFormula, setCopiedFormula] = useState<string | null>(null);
  const [openBooks, setOpenBooks] = useState<Set<number>>(new Set([0]));
  const [isLoadingSection, setIsLoadingSection] = useState(false);
  const [viewMode, setViewMode] = useState<"slice" | "pdf">("slice");
  const [pdfTargetPage, setPdfTargetPage] = useState<number>(1);

  const books = tocData?.books ?? [];
  const fileName =
    typeof source?.metadata?.file_name === "string" ? source.metadata.file_name : null;

  function toggleBook(index: number) {
    setOpenBooks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleSelectTocSection(section: TocSection) {
    if (!section.title || section.title === "noname") return;
    setIsLoadingSection(true);
    try {
      const response = await api.searchBySectionTitle({
        sectionTitle: section.title,
        collection,
        limit: 1,
        includeBase64: true,
      });
      if (response.results[0] && onSelectSource) {
        onSelectSource(response.results[0]);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoadingSection(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedFormula(text);
    setTimeout(() => setCopiedFormula(null), 2000);
  }

  // Parse page number if available for PDF jump
  const firstPageNum = source?.section_pages?.[0]
    ? parseInt(source.section_pages[0].replace(/\D/g, ""), 10)
    : 1;

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

          {/* Mode Switcher: Ảnh cắt lát vs PDF Gốc */}
          <div className="flex items-center rounded-md border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("slice")}
              className={cn(
                "rounded px-2 py-0.5 text-[11px] font-medium transition-all",
                viewMode === "slice"
                  ? "bg-background text-emerald-700 dark:text-emerald-300 shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("view_mode_slice")}
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("pdf");
                if (firstPageNum > 0) setPdfTargetPage(firstPageNum);
              }}
              className={cn(
                "rounded px-2 py-0.5 text-[11px] font-medium transition-all",
                viewMode === "pdf"
                  ? "bg-background text-emerald-700 dark:text-emerald-300 shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("view_mode_pdf")}
            </button>
          </div>

          <div className="min-w-0 flex-1 pl-1">
            <h3 className="truncate text-xs font-semibold text-foreground">
              {source?.section_title || fileName || t("canvas_title")}
            </h3>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Zoom controls */}
          <div className="flex items-center rounded-md border bg-muted/30 p-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-6.5 rounded-sm"
              onClick={() => setZoom((z) => Math.max(50, z - 15))}
              title={t("zoom_out")}
            >
              <ZoomOut className="size-3.5" />
            </Button>
            <span className="w-9 text-center font-mono text-[10px] tabular-nums text-muted-foreground">
              {zoom}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-6.5 rounded-sm"
              onClick={() => setZoom((z) => Math.min(200, z + 15))}
              title={t("zoom_in")}
            >
              <ZoomIn className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6.5 rounded-sm text-muted-foreground hover:text-foreground"
              onClick={() => setZoom(100)}
              title={t("reset_zoom")}
            >
              <RotateCcw className="size-3" />
            </Button>
          </div>

          {onToggleExpand && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7.5 text-muted-foreground hover:text-foreground"
              onClick={onToggleExpand}
              title={isExpanded ? "Thu gọn về 2 cột" : "Mở rộng toàn màn hình"}
            >
              {isExpanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
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
      {source && viewMode === "slice" && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/15 px-3 py-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium text-muted-foreground text-[11px]">Trang đối soát:</span>
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
                              onClick={() => {
                                handleSelectTocSection(sec);
                                if (viewMode === "pdf" && sec.index) {
                                  setPdfTargetPage(sec.index);
                                }
                              }}
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

        {/* Document Main Viewer Area */}
        <main className="flex-1 min-w-0 overflow-hidden relative">
          {/* MODE 1: Trình đọc PDF Thật qua pdfjs-dist */}
          {viewMode === "pdf" && (
            <PdfViewer
              pdfUrl="/sample_document.pdf"
              initialPage={pdfTargetPage}
              zoom={zoom}
              className="h-full"
            />
          )}

          {/* MODE 2: Trình đọc Cắt lát Visual RAG */}
          {viewMode === "slice" && (
            <div className="h-full overflow-y-auto bg-muted/10 p-4">
              {isLoadingSection && (
                <div className="flex flex-col items-center justify-center py-20">
                  <Skeleton className="h-[380px] w-[500px] rounded-lg" />
                  <p className="mt-3 text-xs text-muted-foreground animate-pulse">
                    Đang nạp ảnh cắt lát mục...
                  </p>
                </div>
              )}

              {!isLoadingSection && !source && (
                <div className="flex h-full flex-col items-center justify-center text-center p-8">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 mb-3">
                    <BookOpen className="size-6" />
                  </div>
                  <h4 className="text-xs font-semibold">{t("no_source_selected")}</h4>
                  <p className="mt-1 max-w-xs text-[11px] text-muted-foreground">
                    {t("no_source_desc")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 h-7 text-xs gap-1.5"
                    onClick={() => setViewMode("pdf")}
                  >
                    <FileText className="size-3.5" />
                    <span>Mở xem tài liệu PDF thật</span>
                  </Button>
                </div>
              )}

              {!isLoadingSection && source && (
                <div className="flex flex-col items-center space-y-5 pb-12">
                  {/* Image View with Zoom transform */}
                  <div
                    className="transition-transform duration-150 ease-out origin-top"
                    style={{ transform: `scale(${zoom / 100})` }}
                  >
                    {source.image_base64 ? (
                      <div className="overflow-hidden rounded-lg border bg-card shadow-lg">
                        <img
                          src={source.image_base64}
                          alt={source.section_title || "Ảnh tài liệu"}
                          className="block max-w-full select-none"
                        />
                      </div>
                    ) : (
                      <div className="flex h-64 w-[480px] flex-col items-center justify-center rounded-lg border border-dashed bg-card p-6 text-center text-muted-foreground">
                        <FileWarning className="size-7 text-amber-500 mb-2" />
                        <p className="text-xs font-medium">Ảnh cắt lát mục chưa được nạp</p>
                        <p className="mt-1 text-[11px]">
                          Bấm nút "Xem PDF gốc" phía trên để đọc tài liệu gốc.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Extracted Formulas list */}
                  {source.formulas && source.formulas.length > 0 && (
                    <div className="w-full max-w-2xl rounded-lg border bg-card p-3.5 shadow-xs">
                      <div className="flex items-center gap-1.5 border-b pb-2 text-xs font-semibold text-foreground">
                        <Sigma className="size-4 text-emerald-600" />
                        <span>Công thức nhận diện trong mục ({source.formulas.length})</span>
                      </div>
                      <div className="divide-y mt-2">
                        {source.formulas.map((f, i) => (
                          <div key={i} className="flex items-center justify-between py-1.5 gap-3">
                            <code className="font-mono text-xs text-emerald-700 dark:text-emerald-300 bg-muted/40 px-2 py-1 rounded flex-1 overflow-x-auto">
                              {f.content}
                            </code>
                            <div className="flex items-center gap-1 shrink-0">
                              {f.page && (
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  Trang {f.page}
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 text-muted-foreground hover:text-foreground"
                                onClick={() => copyToClipboard(f.content)}
                                title={t("copy_formula")}
                              >
                                <Copy className="size-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {copiedFormula && (
                        <p className="mt-2 text-[10px] text-emerald-600 font-medium">
                          ✓ {t("formula_copied")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
