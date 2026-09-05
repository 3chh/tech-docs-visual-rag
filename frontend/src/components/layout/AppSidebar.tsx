import {
  BookOpen,
  Check,
  Layers,
  MessageSquare,
  Plus,
  Trash2,
} from "lucide-react";
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
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { useCollections } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

export interface SessionSummary {
  id: string;
  title: string;
  collection: string;
  updatedAt: number;
}

interface AppSidebarProps {
  collection: string;
  onCollectionChange: (collection: string) => void;
  sessions?: SessionSummary[];
  currentSessionId?: string;
  onSelectSession?: (id: string) => void;
  onNewChat?: () => void;
  onDeleteSession?: (id: string) => void;
  settingsTrigger?: React.ReactNode;
}

export function AppSidebar({
  collection,
  onCollectionChange,
  sessions = [],
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  settingsTrigger,
}: AppSidebarProps) {
  const { data: collections, isLoading, isError, refetch } = useCollections();
  const [isAddingCollection, setIsAddingCollection] = useState(false);
  const [draftCollection, setDraftCollection] = useState("");

  const items = collections ?? [];
  const isKnown = items.includes(collection);

  // Filter sessions for the currently selected collection (or all if desired)
  const collectionSessions = sessions.filter((s) => s.collection === collection);

  function commitDraftCollection() {
    const name = draftCollection.trim();
    if (name) onCollectionChange(name);
    setDraftCollection("");
    setIsAddingCollection(false);
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      {/* App Header & Brand */}
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <BookOpen className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate font-semibold text-sm leading-tight text-sidebar-foreground">
              Cosmo ChatPDF
            </p>
            <p className="truncate text-[11px] text-muted-foreground font-mono">
              Visual RAG Workspace
            </p>
          </div>
        </div>

        {/* Primary Action: "+ Cuộc trò chuyện mới" */}
        {onNewChat && (
          <div className="mt-3 group-data-[collapsible=icon]:mt-2">
            <Button
              onClick={onNewChat}
              className="w-full justify-start gap-2 bg-primary/95 text-primary-foreground hover:bg-primary font-medium text-xs h-9 shadow-sm group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center"
              title="Tạo cuộc trò chuyện mới"
            >
              <Plus className="size-4 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden">Cuộc trò chuyện mới</span>
            </Button>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="gap-2">
        {/* SECTION 1: Bộ tài liệu (Collections) */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bộ tài liệu
          </SidebarGroupLabel>
          <SidebarGroupAction
            title="Thêm bộ tài liệu mới"
            onClick={() => setIsAddingCollection((v) => !v)}
          >
            <Plus className="size-3.5" aria-hidden />
            <span className="sr-only">Thêm bộ tài liệu</span>
          </SidebarGroupAction>

          <SidebarGroupContent>
            {isAddingCollection && (
              <div className="px-2 pb-2 group-data-[collapsible=icon]:hidden">
                <Input
                  autoFocus
                  value={draftCollection}
                  onChange={(e) => setDraftCollection(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitDraftCollection();
                    if (e.key === "Escape") {
                      setDraftCollection("");
                      setIsAddingCollection(false);
                    }
                  }}
                  onBlur={commitDraftCollection}
                  placeholder="Tên bộ tài liệu..."
                  className="h-8 text-xs font-mono"
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

              {/* Nếu bộ đang chọn chưa có trong danh sách thì vẫn hiển thị */}
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
                    className="h-auto p-0 text-xs text-destructive"
                    onClick={() => void refetch()}
                  >
                    Tải lại danh sách
                  </Button>
                </div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* SECTION 2: Lịch sử hội thoại (Chat Sessions) */}
        <SidebarGroup className="min-h-0 flex-1">
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Lịch sử trò chuyện
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {collectionSessions.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-muted-foreground italic group-data-[collapsible=icon]:hidden">
                  Chưa có hội thoại nào trong bộ này.
                </div>
              ) : (
                collectionSessions.map((session) => {
                  const isActive = session.id === currentSessionId;
                  return (
                    <SidebarMenuItem key={session.id}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => onSelectSession?.(session.id)}
                        tooltip={session.title}
                        className={cn(
                          "group/session text-xs",
                          isActive && "font-medium bg-sidebar-accent text-sidebar-accent-foreground",
                        )}
                      >
                        <MessageSquare className="size-3.5 shrink-0 text-muted-foreground group-hover/session:text-primary" />
                        <span className="truncate flex-1">{session.title}</span>
                      </SidebarMenuButton>

                      {onDeleteSession && (
                        <SidebarMenuAction
                          showOnHover
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSession(session.id);
                          }}
                          title="Xoá hội thoại này"
                          className="hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                          <span className="sr-only">Xoá</span>
                        </SidebarMenuAction>
                      )}
                    </SidebarMenuItem>
                  );
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Sidebar Footer: Settings & Engine Status */}
      <SidebarFooter className="border-t border-sidebar-border p-2">
        {settingsTrigger && (
          <div className="w-full">
            {settingsTrigger}
          </div>
        )}

        <div className="flex items-center justify-between px-2 py-1 text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Engine: 2005</span>
          </span>
          <span className="font-mono text-[10px]">v1.0-visual</span>
        </div>
      </SidebarFooter>
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
        className={cn(
          "font-mono text-xs flex items-center justify-between",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="size-3.5 shrink-0 text-primary/80" aria-hidden />
          <span className="truncate">{name}</span>
        </div>
        {isActive && (
          <Check className="size-3 shrink-0 text-primary group-data-[collapsible=icon]:hidden" />
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
