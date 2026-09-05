import { FileWarning, Sigma, X } from "lucide-react";

import {
  PageBadgeList,
  SectionHeading,
  SectionPath,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchResult } from "@/lib/types";

/**
 * Chi tiết một mục nguồn: ảnh ghép, số trang in, công thức, trang gốc.
 *
 * Dùng ở cả tab Tra cứu và tab Mục lục vì cùng một việc: đối chiếu kết quả
 * với bản in giấy.
 */
export function SourcePanel({
  source,
  onClose,
}: {
  source: SearchResult;
  onClose?: () => void;
}) {
  const fileName =
    typeof source.metadata?.file_name === "string" ? source.metadata.file_name : null;

  return (
    <section
      className="flex h-full min-h-0 flex-col bg-card"
      aria-label={`Nguồn: ${source.section_title || "mục không có tiêu đề"}`}
    >
      <header className="flex items-start gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <SectionPath ancestors={source.ancestors} className="mb-1" />
          <h2 className="text-[15px] font-medium leading-snug">
            {source.section_title || "Mục không có tiêu đề"}
          </h2>
          {fileName && (
            <p className="mt-1 truncate font-mono text-sm text-muted-foreground">
              {fileName}
            </p>
          )}
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="-mr-1 size-7 shrink-0"
            onClick={onClose}
            aria-label="Đóng chi tiết nguồn"
          >
            <X className="size-4" aria-hidden />
          </Button>
        )}
      </header>

      {(source.section_pages.length > 0 || source.formulas.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-background/60 px-4 py-2">
          <PageBadgeList pages={source.section_pages} max={6} />
          {source.formulas.length > 0 && (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground tabular">
              <Sigma className="size-3.5" aria-hidden />
              {source.formulas.length} công thức
            </span>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-5 p-4">
          <MergedImage source={source} />

          {source.formulas.length > 0 && (
            <div className="space-y-2">
              <SectionHeading>Công thức</SectionHeading>
              <ul className="space-y-1.5">
                {source.formulas.map((formula, i) => (
                  <li
                    key={i}
                    className="rounded-md border bg-background px-2.5 py-2"
                  >
                    <p className="break-words font-mono text-sm leading-relaxed">
                      {formula.content || "(không đọc được nội dung)"}
                    </p>
                    {formula.page && (
                      <p className="mt-1 font-mono text-xs text-muted-foreground tabular">
                        trang {formula.page}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {source.chunk_images.length > 0 && (
            <div className="space-y-2">
              <SectionHeading>Trang gốc ({source.chunk_images.length})</SectionHeading>
              <p className="text-sm text-muted-foreground">
                Từng trang trước khi ghép, để đối chiếu với bản in.
              </p>
              <ul className="grid grid-cols-2 gap-2">
                {source.chunk_images.map((image, i) => (
                  <li key={i}>
                    <img
                      src={image}
                      alt={`Trang gốc thứ ${i + 1} của mục ${source.section_title}`}
                      className="w-full rounded-md border bg-white"
                      loading="lazy"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function MergedImage({ source }: { source: SearchResult }) {
  if (!source.image_base64) {
    return (
      <div className="rounded-md border border-dashed bg-background px-4 py-8 text-center">
        <FileWarning className="mx-auto size-5 text-muted-foreground/70" aria-hidden />
        <p className="mt-2 text-sm font-medium">Không tải được ảnh của mục này</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Backend và worker phải dùng chung volume dữ liệu.
        </p>
        {source.image_path && (
          <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
            {source.image_path}
          </p>
        )}
      </div>
    );
  }

  return (
    <figure className="space-y-1.5">
      <img
        src={source.image_base64}
        alt={`Ảnh ghép của mục ${source.section_title || "không có tiêu đề"}`}
        className="w-full rounded-md border bg-white"
        loading="lazy"
      />
      <figcaption className="text-sm text-muted-foreground">
        Ảnh ghép của toàn mục, đã bỏ số trang ở chân trang.
      </figcaption>
    </figure>
  );
}

/** Khung chờ khi đang tải mục nguồn. */
export function SourcePanelSkeleton() {
  return (
    <div
      className="flex h-full flex-col bg-card"
      aria-busy="true"
      aria-label="Đang tải nguồn"
    >
      <div className="space-y-2 border-b px-4 py-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="space-y-3 p-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="aspect-[3/4] w-full" />
      </div>
    </div>
  );
}
