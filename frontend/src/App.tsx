import { FileStack, ListTree, Search } from "lucide-react";
import { useState } from "react";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AskPanel } from "@/features/ask";
import type { AskOptions } from "@/features/ask/AskComposer";
import { SettingsDialog } from "@/features/settings/SettingsDialog";
import { DocumentsPanel } from "@/features/documents/DocumentsPanel";
import { OutlinePanel } from "@/features/outline/OutlinePanel";
import { cn } from "@/lib/utils";

/**
 * Ba khu vực, xếp theo tần suất dùng: Tra cứu chiếm 90% thời gian nên là
 * mặc định. Tài liệu gộp cả "xem đang có gì" và "thêm mới" vì đó là một việc.
 */
const AREAS = [
  { id: "ask", label: "Tra cứu", icon: Search },
  { id: "outline", label: "Mục lục", icon: ListTree },
  { id: "documents", label: "Tài liệu", icon: FileStack },
] as const;

type AreaId = (typeof AREAS)[number]["id"];

export default function App() {
  const [collection, setCollection] = useState("default");
  const [area, setArea] = useState<AreaId>("ask");
  const [askOptions, setAskOptions] = useState<AskOptions>({
    topK: 5,
    useTocRewrite: true,
  });

  return (
    <SidebarProvider>
      <AppSidebar collection={collection} onCollectionChange={setCollection} />

      <SidebarInset className="flex h-svh min-w-0 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3">
          <SidebarTrigger className="size-7" />
          <Separator orientation="vertical" className="mr-1 !h-5" />

          <nav aria-label="Khu vực làm việc" className="flex items-center gap-0.5">
            {AREAS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setArea(id)}
                aria-current={area === id ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[15px] transition-colors",
                  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
                  area === id
                    ? "bg-secondary font-medium text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <span className="rounded-md border bg-card px-2 py-1 font-mono text-sm">
              {collection}
            </span>
            <SettingsDialog options={askOptions} onOptionsChange={setAskOptions} />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">
          {area === "ask" && (
            <AskPanel collection={collection} options={askOptions} />
          )}
          {area === "outline" && <OutlinePanel collection={collection} />}
          {area === "documents" && (
            <div className="h-full overflow-y-auto">
              <DocumentsPanel collection={collection} />
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
