import { BookOpen, Layers, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { useCollections, useHealth } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  collection: string;
  onCollectionChange: (collection: string) => void;
}

export function AppSidebar({ collection, onCollectionChange }: AppSidebarProps) {
  const { data: collections, isLoading, isError, refetch, isFetching } = useCollections();
  const { data: health } = useHealth();
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const items = collections ?? [];
  const isKnown = items.includes(collection);

  function commitDraft() {
    const name = draft.trim();
    if (name) onCollectionChange(name);
    setDraft("");
    setIsAdding(false);
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-4 py-3.5 group-data-[collapsible=icon]:px-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary">
            <BookOpen className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold leading-tight">Cosmo ChatPDF</p>
            <p className="truncate text-xs text-muted-foreground">Visual RAG cấp mục</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Bộ tài liệu</SidebarGroupLabel>
          <SidebarGroupAction
            title="Thêm bộ tài liệu"
            onClick={() => setIsAdding((v) => !v)}
          >
            <Plus aria-hidden />
            <span className="sr-only">Thêm bộ tài liệu</span>
          </SidebarGroupAction>

          <SidebarGroupContent>
            {isAdding && (
              <div className="px-2 pb-2 group-data-[collapsible=icon]:hidden">
                <Input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitDraft();
                    if (e.key === "Escape") {
                      setDraft("");
                      setIsAdding(false);
                    }
                  }}
                  onBlur={commitDraft}
                  placeholder="Tên bộ tài liệu"
                  className="h-8 text-sm"
                  aria-label="Tên bộ tài liệu mới"
                />
              </div>
            )}

            <SidebarMenu>
              {isLoading && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                </>
              )}

              {/* Collection đang chọn nhưng backend chưa biết: vẫn hiện để
                  người dùng thấy mình đang ở đâu trước khi index. */}
              {!isLoading && !isKnown && collection && (
                <CollectionItem
                  name={collection}
                  isActive
                  isPending
                  onSelect={() => onCollectionChange(collection)}
                />
              )}

              {items.map((name) => (
                <CollectionItem
                  key={name}
                  name={name}
                  isActive={name === collection}
                  onSelect={() => onCollectionChange(name)}
                />
              ))}

              {!isLoading && items.length === 0 && !isError && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                  Chưa có bộ tài liệu nào. Tải PDF lên để bắt đầu.
                </p>
              )}

              {isError && (
                <div className="px-2 py-1.5 group-data-[collapsible=icon]:hidden">
                  <p className="text-xs text-muted-foreground">
                    Không đọc được danh sách.
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => void refetch()}
                  >
                    Thử lại
                  </Button>
                </div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                health ? "bg-primary" : "bg-destructive",
              )}
              aria-hidden
            />
            <span className="truncate text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              {health ? `Backend v${health.version}` : "Mất kết nối backend"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 group-data-[collapsible=icon]:hidden"
            onClick={() => void refetch()}
            aria-label="Tải lại danh sách bộ tài liệu"
          >
            <RefreshCw className={cn("size-3", isFetching && "animate-spin")} aria-hidden />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function CollectionItem({
  name,
  isActive,
  isPending,
  onSelect,
}: {
  name: string;
  isActive: boolean;
  isPending?: boolean;
  onSelect: () => void;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        onClick={onSelect}
        tooltip={name}
        className="font-mono text-[13px]"
      >
        <Layers aria-hidden />
        <span className="truncate">{name}</span>
        {isPending && (
          <span className="ml-auto text-[10px] text-muted-foreground">mới</span>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
