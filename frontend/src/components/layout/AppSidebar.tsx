import { BookOpen, Layers, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
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
import { useCollections } from "@/hooks/use-api";

interface AppSidebarProps {
  collection: string;
  onCollectionChange: (collection: string) => void;
}

export function AppSidebar({ collection, onCollectionChange }: AppSidebarProps) {
  const { data: collections, isLoading, isError, refetch } = useCollections();
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
      <SidebarHeader className="border-b px-4 py-4 group-data-[collapsible=icon]:px-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary">
            <BookOpen className="size-4" aria-hidden />
          </div>
          <p className="min-w-0 truncate font-semibold leading-tight group-data-[collapsible=icon]:hidden">
            Cosmo ChatPDF
          </p>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm">Bộ tài liệu</SidebarGroupLabel>
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
                  className="h-9"
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

              {/* Bộ đang chọn nhưng backend chưa biết: vẫn hiện để người dùng
                  thấy mình đang ở đâu trước khi index. */}
              {!isLoading && !isKnown && collection && (
                <CollectionItem
                  name={collection}
                  isActive
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

              {isError && (
                <div className="px-2 py-1.5 group-data-[collapsible=icon]:hidden">
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-[15px]"
                    onClick={() => void refetch()}
                  >
                    Tải lại danh sách
                  </Button>
                </div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function CollectionItem({
  name,
  isActive,
  onSelect,
}: {
  name: string;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        onClick={onSelect}
        tooltip={name}
        className="font-mono text-[15px]"
      >
        <Layers aria-hidden />
        <span className="truncate">{name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
