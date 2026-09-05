import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Copy,
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
import type { SearchResult, TocSection } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  const [showToC, setShowToC] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [tocFilter, setTocFilter] = useState("");
  const [copiedFormula, setCopiedFormula] = useState<string | null>(null);
  const [openBooks, setOpenBooks] = useState<Set<number>>(new Set([0]));
  const [isLoadingSection, setIsLoadingSection] = useState(false);

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

  return (
    <div className="flex h-full min-h-0 flex-col bg-background border-l border-border shadow-md overflow-hidden">
      {/* --- Top Canvas Toolbar --- */}
      <header className="flex h-13 shrink-0 items-center justify-between border-b bg-card px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant={showToC ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowToC((v) => !v)}
            className="h-8 gap-1.5 text-xs font-medium"
            title="Bật/Tắt Cây mục lục của tài liệu"
          >
            <ListTree className="size-3.5 text-primary" />
            <span>Mục lục</span>
          </Button>

          <div className="h-4 w-px bg-border" />

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xs font-semibold text-foreground">
              {source?.section_title || fileName || "Document Canvas"}
            </h3>
            {source?.ancestors && source.ancestors.length > 0 && (
              <p className="truncate text-[11px] text-muted-foreground">
                {source.ancestors.join(" / ")}
              </p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center rounded-md border bg-muted/30 p-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-sm"
              onClick={() => setZoom((z) => Math.max(50, z - 15))}
              title="Thu nhỏ"
            >
              <ZoomOut className="size-3.5" />
            </Button>
            <span className="w-10 text-center font-mono text-[11px] tabular-nums text-muted-foreground">
              {zoom}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-sm"
              onClick={() => setZoom((z) => Math.min(200, z + 15))}
              title="Phóng to"
            >
              <ZoomIn className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-sm text-muted-foreground hover:text-foreground"
              onClick={() => setZoom(100)}
              title="Kích thước gốc (100%)"
            >
              <RotateCcw className="size-3" />
            </Button>
          </div>

          {onToggleExpand && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              onClick={onToggleExpand}
              title={isExpanded ? "Thu gọn về 2 cột" : "Mở rộng toàn màn hình"}
            >
              {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>
          )}

          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={onClose}
              title="Đóng Canvas"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </header>

      {/* --- Sub-header: Metadata & Page Badges --- */}
      {source && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/15 px-4 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium text-muted-foreground">Trang đối soát:</span>
            <PageBadgeList pages={source.section_pages} max={6} />
          </div>
          {source.formulas && source.formulas.length > 0 && (
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-primary">
              <Sigma className="size-3.5" />
              <span>{source.formulas.length} công thức toán</span>
            </div>
          )}
        </div>
      )}

      {/* --- Main Body: Split between Document ToC & Image View --- */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Document ToC Tree Sidebar inside Canvas */}
        {showToC && (
          <aside className="flex w-64 shrink-0 flex-col border-r bg-muted/20 min-h-0">
            <div className="p-2 border-b bg-card/60">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  value={tocFilter}
                  onChange={(e) => setTocFilter(e.target.value)}
                  placeholder="Lọc mục lục..."
                  className="h-8 pl-8 text-xs bg-background"
                />
              </div>
            </div>

            <ScrollArea className="flex-1 p-2">
              {isTocLoading && (
                <div className="space-y-2 p-2">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-4/5" />
                  <Skeleton className="h-6 w-3/4" />
                </div>
              )}

              {!isTocLoading && books.length === 0 && (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  Chưa có mục lục cho bộ tài liệu này.
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
                      className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-foreground/90 hover:bg-muted transition-colors"
                    >
                      {isOpen ? (
                        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <BookOpen className="size-3.5 shrink-0 text-primary/80" />
                      <span className="truncate">{book.title || `Quyển ${book.book_index + 1}`}</span>
                    </button>

                    {isOpen && (
                      <div className="ml-3 pl-2 border-l border-border/60 mt-1 space-y-0.5">
                        {filteredSections.map((sec, sIdx) => {
                          const isCurrent =
                            source?.section_title === sec.title && sec.title !== "noname";
                          return (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => handleSelectTocSection(sec)}
                              className={cn(
                                "flex w-full items-center justify-between rounded px-2 py-1 text-left text-[11px] transition-colors",
                                isCurrent
                                  ? "bg-primary text-primary-foreground font-medium"
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
                                    isCurrent ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
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
        <main className="flex-1 min-w-0 overflow-y-auto bg-muted/10 p-4">
          {isLoadingSection && (
            <div className="flex flex-col items-center justify-center py-20">
              <Skeleton className="h-[400px] w-[540px] rounded-lg" />
              <p className="mt-3 text-xs text-muted-foreground animate-pulse">
                Đang nạp ảnh cắt lát mục...
              </p>
            </div>
          )}

          {!isLoadingSection && !source && (
            <div className="flex h-full flex-col items-center justify-center text-center p-8">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                <BookOpen className="size-7" />
              </div>
              <h4 className="text-sm font-semibold">Chưa chọn tài liệu hoặc trích dẫn</h4>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Hãy bấm vào một trích dẫn trong câu trả lời bên trái, hoặc chọn một mục trong Cây mục lục để xem ảnh cắt lát đối soát.
              </p>
            </div>
          )}

          {!isLoadingSection && source && (
            <div className="flex flex-col items-center space-y-6 pb-12">
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
                  <div className="flex h-72 w-[520px] flex-col items-center justify-center rounded-lg border border-dashed bg-card p-6 text-center text-muted-foreground">
                    <FileWarning className="size-8 text-amber-500 mb-2" />
                    <p className="text-xs font-medium">Ảnh cắt lát mục chưa được nạp</p>
                    <p className="mt-1 text-[11px]">
                      Hệ thống đang chạy chế độ không lưu ảnh tạm hoặc đường dẫn file đã thay đổi.
                    </p>
                  </div>
                )}
              </div>

              {/* Extracted Formulas list */}
              {source.formulas && source.formulas.length > 0 && (
                <div className="w-full max-w-2xl rounded-lg border bg-card p-4 shadow-sm">
                  <div className="flex items-center gap-1.5 border-b pb-2 text-xs font-semibold text-foreground">
                    <Sigma className="size-4 text-primary" />
                    <span>Công thức nhận diện được trong mục ({source.formulas.length})</span>
                  </div>
                  <div className="divide-y mt-2">
                    {source.formulas.map((f, i) => (
                      <div key={i} className="flex items-center justify-between py-2 gap-3">
                        <code className="font-mono text-xs text-primary bg-muted/40 px-2 py-1 rounded flex-1 overflow-x-auto">
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
                            title="Sao chép LaTeX"
                          >
                            <Copy className="size-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {copiedFormula && (
                    <p className="mt-2 text-[10px] text-green-600 dark:text-green-400 font-medium">
                      ✓ Đã sao chép công thức vào clipboard!
                    </p>
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
