import {
  BookOpen,
  Check,
  FileStack,
  Layers,
  ListTree,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  SquarePen,
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
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserMenu } from "@/features/auth";
import { useCollections } from "@/hooks/use-api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface SessionSummary {
  id: string;
  title: string;
  collection: string;
  updatedAt: number;
}

export type AreaId = "ask" | "documents" | "outline";

interface AppSidebarProps {
  currentArea: AreaId;
  onAreaChange: (area: AreaId) => void;
  collection: string;
  onCollectionChange: (collection: string) => void;
  sessions?: SessionSummary[];
  currentSessionId?: string;
  onSelectSession?: (id: string) => void;
  onNewChat?: () => void;
  onDeleteSession?: (id: string) => void;
  onOpenSettings?: () => void;
}

export function AppSidebar({
  currentArea,
  onAreaChange,
  collection,
  onCollectionChange,
  sessions = [],
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onOpenSettings,
}: AppSidebarProps) {
  const { data: collections, isLoading, isError, refetch } = useCollections();
  const [isAddingCollection, setIsAddingCollection] = useState(false);
  const [draftCollection, setDraftCollection] = useState("");
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { t } = useI18n();

  const items = collections ?? [];
  const isKnown = items.includes(collection);
  const collectionSessions = sessions.filter((s) => s.collection === collection);

  function commitDraftCollection() {
    const name = draftCollection.trim();
    if (name) onCollectionChange(name);
    setDraftCollection("");
    setIsAddingCollection(false);
  }

  // Danh sách các Tab khu vực làm việc
  const NAV_TABS: { id: AreaId; label: string; icon: typeof MessageSquare }[] = [
    { id: "ask", label: t("nav_chat"), icon: MessageSquare },
    { id: "documents", label: t("nav_documents"), icon: FileStack },
    { id: "outline", label: t("nav_outline"), icon: ListTree },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar select-none">
      {/* 1. Header: Brand + Collapse Toggle + New Chat Button */}
      <SidebarHeader className="border-b border-sidebar-border p-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Logo & App title (Ẩn khi thu gọn) */}
          <div className="flex items-center gap-2 min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white shadow-xs">
              <BookOpen className="size-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-xs leading-tight text-sidebar-foreground">
                {t("app_name")}
              </p>
              <p className="truncate text-[10px] text-muted-foreground font-mono">
                {t("app_tagline")}
              </p>
            </div>
          </div>

          {/* Nút Toggle Sidebar */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="size-7 shrink-0 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                aria-label="Thu gọn hoặc mở rộng sidebar"
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="size-4" />
                ) : (
                  <PanelLeftClose className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              {isCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Nút "+ Cuộc trò chuyện mới" chuẩn ChatGPT */}
        {onNewChat && (
          <div className="mt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onNewChat}
                  className={cn(
                    "w-full justify-start gap-2 bg-emerald-600 text-white hover:bg-emerald-700 font-medium text-xs h-8.5 shadow-xs transition-colors",
                    "group-data-[collapsible=icon]:size-7.5 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto",
                  )}
                >
                  <SquarePen className="size-3.5 shrink-0" />
                  <span className="group-data-[collapsible=icon]:hidden">
                    {t("nav_new_chat")}
                  </span>
                </Button>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right" sideOffset={10}>
                  {t("nav_new_chat")}
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="gap-1.5 p-2">
        {/* 2. MAIN WORKSPACE TABS (Được chuyển vào Sidebar) */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 px-2 py-1 group-data-[collapsible=icon]:hidden">
            Không gian làm việc
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {NAV_TABS.map(({ id, label, icon: Icon }) => {
                const isActive = currentArea === id;
                return (
                  <SidebarMenuItem key={id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => onAreaChange(id)}
                          className={cn(
                            "h-8.5 rounded-md px-2.5 text-xs transition-all",
                            // Tô màu xanh lá nổi bật cho Tab được chọn theo đúng yêu cầu người dùng
                            isActive
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold border-l-3 border-emerald-600 shadow-2xs"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          )}
                        >
                          <Icon
                            className={cn(
                              "size-4 shrink-0",
                              isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                            )}
                          />
                          <span className="truncate group-data-[collapsible=icon]:hidden">
                            {label}
                          </span>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right" sideOffset={10}>
                          {label}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 3. BỘ TÀI LIỆU (COLLECTIONS) */}
        <SidebarGroup className="p-0 mt-2">
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 px-2 py-1 flex items-center justify-between group-data-[collapsible=icon]:hidden">
            <span>{t("collections_title")}</span>
            <button
              type="button"
              onClick={() => setIsAddingCollection((v) => !v)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title={t("add_collection")}
            >
              <Plus className="size-3.5" />
            </button>
          </SidebarGroupLabel>

          <SidebarGroupContent>
            {isAddingCollection && (
              <div className="px-1.5 pb-2 group-data-[collapsible=icon]:hidden">
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
                  placeholder={t("new_collection_placeholder")}
                  className="h-7 text-xs font-mono"
                  aria-label={t("new_collection_placeholder")}
                />
              </div>
            )}

            <SidebarMenu className="space-y-0.5">
              {isLoading && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                </>
              )}

              {!isLoading && !isKnown && collection && (
                <CollectionMenuItem
                  name={collection}
                  isActive
                  onSelect={() => onCollectionChange(collection)}
                  isCollapsed={isCollapsed}
                />
              )}

              {items.map((name) => (
                <CollectionMenuItem
                  key={name}
                  name={name}
                  isActive={name === collection}
                  onSelect={() => onCollectionChange(name)}
                  isCollapsed={isCollapsed}
                />
              ))}

              {isError && (
                <div className="px-2 py-1 group-data-[collapsible=icon]:hidden">
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-[11px] text-destructive"
                    onClick={() => void refetch()}
                  >
                    Tải lại danh sách
                  </Button>
                </div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 4. LỊCH SỬ TRÒ CHUYỆN (SESSIONS) */}
        <SidebarGroup className="p-0 mt-2 min-h-0 flex-1">
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 px-2 py-1 group-data-[collapsible=icon]:hidden">
            {t("chat_history_title")}
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {collectionSessions.length === 0 ? (
                <div className="px-2 py-1.5 text-[11px] text-muted-foreground/70 italic group-data-[collapsible=icon]:hidden">
                  {t("no_history")}
                </div>
              ) : (
                collectionSessions.map((session) => {
                  const isActive = session.id === currentSessionId;
                  return (
                    <SidebarMenuItem key={session.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => {
                              onSelectSession?.(session.id);
                              onAreaChange("ask");
                            }}
                            className={cn(
                              "h-7.5 rounded-md px-2 text-xs",
                              isActive && "font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                            )}
                          >
                            <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate flex-1">{session.title}</span>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        {isCollapsed && (
                          <TooltipContent side="right" sideOffset={10}>
                            {session.title}
                          </TooltipContent>
                        )}
                      </Tooltip>

                      {onDeleteSession && (
                        <SidebarMenuAction
                          showOnHover
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSession(session.id);
                          }}
                          title={t("delete_session")}
                          className="hover:text-destructive size-6"
                        >
                          <Trash2 className="size-3" />
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

      {/* 5. Footer: User Avatar Menu (ChatGPT / Claude Style) */}
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <UserMenu onOpenSettings={onOpenSettings} collapsed={isCollapsed} />
      </SidebarFooter>
    </Sidebar>
  );
}

function CollectionMenuItem({
  name,
  isActive,
  onSelect,
  isCollapsed,
}: {
  name: string;
  isActive: boolean;
  onSelect: () => void;
  isCollapsed: boolean;
}) {
  return (
    <SidebarMenuItem>
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarMenuButton
            isActive={isActive}
            onClick={onSelect}
            className={cn(
              "h-7.5 rounded-md px-2 font-mono text-xs flex items-center justify-between",
              isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="size-3.5 shrink-0 text-primary/80" aria-hidden />
              <span className="truncate">{name}</span>
            </div>
            {isActive && (
              <Check className="size-3 shrink-0 text-emerald-600 group-data-[collapsible=icon]:hidden" />
            )}
          </SidebarMenuButton>
        </TooltipTrigger>
        {isCollapsed && (
          <TooltipContent side="right" sideOffset={10}>
            {name}
          </TooltipContent>
        )}
      </Tooltip>
    </SidebarMenuItem>
  );
}
