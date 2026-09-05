import { FileStack, ListTree, MessageSquare, Settings2 } from "lucide-react";
import { useState } from "react";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AskPanel } from "@/features/ask";
import { useChatSessions } from "@/features/ask/use-sessions";
import { DocumentsPanel } from "@/features/documents/DocumentsPanel";
import { OutlinePanel } from "@/features/outline/OutlinePanel";
import { SettingsDialog } from "@/features/settings/SettingsDialog";
import {
  loadSettings,
  saveSettings,
  type StoredSettings,
} from "@/features/settings/types";
import { api } from "@/lib/api";
import type { SearchResult, TocBook } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Các khu vực làm việc chính theo luồng sử dụng hiện đại:
 * 1. Chat & Canvas (Mặc định): Màn hình chia đôi - bên trái hỏi đáp với AI,
 *    bên phải là Canvas xem ảnh trang gốc, công thức và mục lục tài liệu.
 * 2. Tài liệu: Quản lý các cuốn sách PDF trong bộ, tải lên và chỉ mục.
 * 3. Mục lục tổng quan: Cây thư mục toàn bộ các sách trong bộ.
 */
const AREAS = [
  { id: "ask", label: "Chat & Canvas", icon: MessageSquare },
  { id: "documents", label: "Tài liệu", icon: FileStack },
  { id: "outline", label: "Mục lục", icon: ListTree },
] as const;

type AreaId = (typeof AREAS)[number]["id"];

export default function App() {
  const [collection, setCollection] = useState("default");
  const [area, setArea] = useState<AreaId>("ask");
  const [settings, setSettings] = useState<StoredSettings>(loadSettings);
  const [activeSource, setActiveSource] = useState<SearchResult | null>(null);

  // Quản lý phiên hội thoại cho bộ tài liệu hiện tại
  const {
    sessions,
    currentSessionId,
    currentTurns,
    updateCurrentTurns,
    createNewSession,
    selectSession,
    deleteSession,
  } = useChatSessions(collection);

  function updateSettings(next: StoredSettings) {
    setSettings(next);
    saveSettings(next);
  }

  // Mở trực tiếp một cuốn sách từ tab Tài liệu vào Canvas
  async function handleOpenBookInCanvas(book: TocBook) {
    setArea("ask");
    const targetSection =
      book.sections?.find((s) => s.title && s.title !== "noname") ?? book.sections?.[0];

    if (targetSection?.title) {
      try {
        const response = await api.searchBySectionTitle({
          sectionTitle: targetSection.title,
          collection,
          limit: 1,
          includeBase64: true,
        });
        if (response.results[0]) {
          setActiveSource(response.results[0]);
        }
      } catch {
        // Fallback
      }
    }
  }

  const sidebarSettingsTrigger = (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start gap-2 h-8 text-xs text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 font-medium"
      title="Cấu hình hệ thống"
    >
      <Settings2 className="size-4 shrink-0 text-muted-foreground" />
      <span className="group-data-[collapsible=icon]:hidden">Cấu hình hệ thống</span>
    </Button>
  );

  return (
    <SidebarProvider>
      <AppSidebar
        collection={collection}
        onCollectionChange={setCollection}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={(id) => {
          selectSession(id);
          setArea("ask");
        }}
        onNewChat={() => {
          createNewSession();
          setArea("ask");
        }}
        onDeleteSession={deleteSession}
        settingsTrigger={
          <SettingsDialog
            settings={settings}
            onChange={updateSettings}
            trigger={sidebarSettingsTrigger}
          />
        }
      />

      <SidebarInset className="flex h-svh min-w-0 flex-col overflow-hidden">
        {/* Top App Header */}
        <header className="flex h-13 shrink-0 items-center gap-2 border-b bg-background px-3">
          <SidebarTrigger className="size-7" />
          <Separator orientation="vertical" className="mr-1 !h-5" />

          <nav aria-label="Khu vực làm việc" className="flex items-center gap-1">
            {AREAS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setArea(id)}
                aria-current={area === id ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                  area === id
                    ? "bg-secondary font-semibold text-secondary-foreground shadow-2xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1 text-xs">
              <span className="text-[11px] text-muted-foreground">Bộ hiện tại:</span>
              <span className="font-mono font-semibold text-foreground">{collection}</span>
            </div>

            <SettingsDialog settings={settings} onChange={updateSettings} />
          </div>
        </header>

        {/* Main Content Area */}
        <main className="min-h-0 flex-1 overflow-hidden">
          {area === "ask" && (
            <AskPanel
              collection={collection}
              options={settings.ask}
              turns={currentTurns}
              onUpdateTurns={updateCurrentTurns}
              activeSource={activeSource}
              onSelectSource={setActiveSource}
            />
          )}

          {area === "documents" && (
            <div className="h-full overflow-y-auto">
              <DocumentsPanel
                collection={collection}
                overrides={settings.processing}
                onOpenBookInCanvas={handleOpenBookInCanvas}
              />
            </div>
          )}

          {area === "outline" && <OutlinePanel collection={collection} />}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
