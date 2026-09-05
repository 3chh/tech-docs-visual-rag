import { ChevronRight, FileText, Sigma, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { SearchResult } from "@/lib/types";

/** Xem chi tiết một mục nguồn: ảnh ghép, trang, công thức, mục cha. */
export function SourcePanel({
  source,
  onClose,
}: {
  source: SearchResult;
  onClose: () => void;
}) {
  const fileName =
    typeof source.metadata?.file_name === "string" ? source.metadata.file_name : null;

  return (
    <aside
      className="flex h-full flex-col border-l bg-card"
      aria-label={`Chi tiết mục ${source.section_title}`}
    >
      <header className="flex items-start gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          {source.ancestors.length > 0 && (
            <nav aria-label="Mục cha" className="mb-1 flex flex-wrap items-center gap-0.5">
              {source.ancestors.map((ancestor, i) => (
                <span key={i} className="flex items-center gap-0.5">
                  {i > 0 && (
                    <ChevronRight className="size-3 text-muted-foreground" aria-hidden />
                  )}
                  <span className="text-xs text-muted-foreground">{ancestor}</span>
                </span>
              ))}
            </nav>
          )}
          <h3 className="text-sm font-medium leading-snug">{source.section_title}</h3>
          {fileName && (
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
              {fileName}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={onClose}
          aria-label="Đóng chi tiết"
        >
          <X className="size-3.5" aria-hidden />
        </Button>
      </header>

      <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5">
        {source.section_pages.map((page) => (
          <Badge key={page} variant="secondary" className="font-mono text-xs tabular">
            trang {page}
          </Badge>
        ))}
        {source.formulas.length > 0 && (
          <Badge variant="outline" className="gap-1 text-xs">
            <Sigma className="size-3" aria-hidden />
            {source.formulas.length} công thức
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {source.image_base64 ? (
            <figure className="space-y-1.5">
              <img
                src={source.image_base64}
                alt={`Ảnh ghép của mục ${source.section_title}`}
                className="w-full rounded-md border bg-white"
                loading="lazy"
              />
              <figcaption className="text-xs text-muted-foreground">
                Ảnh ghép của toàn mục, đã cắt số trang
              </figcaption>
            </figure>
          ) : (
            <div className="rounded-md border border-dashed px-4 py-8 text-center">
              <FileText className="mx-auto size-5 text-muted-foreground" aria-hidden />
              <p className="mt-2 text-xs text-muted-foreground">
                Không tải được ảnh của mục này
              </p>
              <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                {source.image_path}
              </p>
            </div>
          )}

          {source.formulas.length > 0 && (
            <>
              <Separator />
              <section className="space-y-2">
                <h4 className="text-xs font-medium">Công thức trong mục</h4>
                <ul className="space-y-1.5">
                  {source.formulas.map((formula, i) => (
                    <li
                      key={i}
                      className="rounded-md border bg-muted/40 px-2.5 py-2 font-mono text-xs"
                    >
                      <div className="break-all">{formula.content || "(không đọc được)"}</div>
                      {formula.page && (
                        <div className="mt-1 text-[10px] text-muted-foreground tabular">
                          trang {formula.page}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}

          {source.chunk_images.length > 0 && (
            <>
              <Separator />
              <section className="space-y-2">
                <h4 className="text-xs font-medium">
                  Trang gốc ({source.chunk_images.length})
                </h4>
                <p className="text-xs text-muted-foreground">
                  Ảnh từng trang trước khi ghép, dùng để đối chiếu với bản in.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {source.chunk_images.map((image, i) => (
                    <img
                      key={i}
                      src={image}
                      alt={`Trang gốc ${i + 1} của mục ${source.section_title}`}
                      className="w-full rounded border bg-white"
                      loading="lazy"
                    />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
