import { MessageSquare, Library, ListTree, Upload } from "lucide-react";
import { useState } from "react";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ChatPanel } from "@/features/chat/ChatPanel";
import { LibraryPanel, OutlinePanel } from "@/features/library/LibraryPanel";
import { UploadPanel } from "@/features/upload/UploadPanel";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "chat", label: "Hỏi đáp", icon: MessageSquare },
  { id: "library", label: "Thư viện", icon: Library },
  { id: "outline", label: "Mục lục", icon: ListTree },
  { id: "upload", label: "Tải lên", icon: Upload },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function App() {
  const [collection, setCollection] = useState("default");
  const [tab, setTab] = useState<TabId>("chat");

  return (
    <SidebarProvider>
      <AppSidebar collection={collection} onCollectionChange={setCollection} />

      <SidebarInset className="flex h-svh min-w-0 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-1 h-5" />

          <nav aria-label="Khu vực làm việc" className="flex items-center gap-0.5">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  tab === id
                    ? "bg-secondary font-medium text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              đang xem
            </span>
            <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
              {collection}
            </span>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">
          {tab === "chat" && <ChatPanel collection={collection} />}
          {tab === "library" && <LibraryPanel collection={collection} />}
          {tab === "outline" && (
            <div className="h-full overflow-auto">
              <OutlinePanel collection={collection} />
            </div>
          )}
          {tab === "upload" && (
            <div className="h-full overflow-auto">
              <UploadPanel collection={collection} />
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
