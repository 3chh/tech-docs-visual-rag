import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { SearchResult } from "@/lib/types";

import { SourcePanel } from "./SourcePanel";

/**
 * Ngưỡng chuyển giữa cột bên phải và sheet trượt lên.
 *
 * Phải khớp với breakpoint dùng trong CSS. Dùng hai ngưỡng khác nhau (ví dụ
 * useIsMobile 768px cho sheet nhưng lg:block 1024px cho cột) sẽ tạo khoảng
 * chết 768-1023px không hiện gì cả.
 */
const SIDE_PANEL_MIN_WIDTH = 1024;

/** Panel nguồn thích ứng: cột bên phải ở màn rộng, sheet trượt lên ở màn hẹp. */
export function SourceView({
  source,
  onClose,
}: {
  source: SearchResult | null;
  onClose: () => void;
}) {
  const hasRoomForColumn = useMediaQuery(`(min-width: ${SIDE_PANEL_MIN_WIDTH}px)`);

  if (!source) return null;

  if (hasRoomForColumn) {
    return (
      <div className="w-[400px] shrink-0 border-l xl:w-[440px]">
        <SourcePanel source={source} onClose={onClose} />
      </div>
    );
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[85dvh] p-0">
        <SheetTitle className="sr-only">
          Nguồn: {source.section_title || "mục không có tiêu đề"}
        </SheetTitle>
        <SourcePanel source={source} onClose={onClose} />
      </SheetContent>
    </Sheet>
  );
}
