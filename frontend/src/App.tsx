import { Globe } from "lucide-react";
import { useState } from "react";

import { AppSidebar, type AreaId } from "@/components/layout/AppSidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { useI18n } from "@/lib/i18n";
import type { SearchResult, TocBook } from "@/lib/types";

export default function App() {
  const [collection, setCollection] = useState("default");
  const [area, setArea] = useState<AreaId>("ask");
  const [settings, setSettings] = useState<StoredSettings>(loadSettings);
  const [activeSource, setActiveSource] = useState<SearchResult | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { t, language, toggleLanguage } = useI18n();

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

  const areaTitle =
    area === "ask"
      ? t("nav_chat")
      : area === "documents"
      ? t("nav_documents")
      : t("nav_outline");

  return (
    <SidebarProvider>
      <AppSidebar
        currentArea={area}
        onAreaChange={setArea}
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
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <SidebarInset className="flex h-svh min-w-0 flex-col overflow-hidden bg-background">
        {/* Top Minimalist Header Bar */}
        <header className="flex h-11 shrink-0 items-center justify-between border-b bg-card/60 px-3 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <SidebarTrigger className="size-7 text-muted-foreground hover:text-foreground" />
            <Separator orientation="vertical" className="!h-4" />
            <h2 className="text-xs font-semibold text-foreground truncate">
              {areaTitle}
            </h2>
            <span className="text-[11px] text-muted-foreground/80 font-mono">
              / {collection}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Quick Language Switcher */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleLanguage}
                  className="h-7 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Globe className="size-3.5" />
                  <span className="font-mono text-[10px] font-bold uppercase">
                    {language}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t("language_switch")}: {language === "vi" ? "Tiếng Việt" : "English"}
              </TooltipContent>
            </Tooltip>

            {/* System & Collection Settings Dialog */}
            <SettingsDialog
              open={isSettingsOpen}
              onOpenChange={setIsSettingsOpen}
              settings={settings}
              onChange={updateSettings}
              activeCollection={collection}
            />
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
