import {
  Globe,
  LogOut,
  MoreVertical,
  Settings2,
  ShieldCheck,
  User,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";

import { useAuth } from "./AuthContext";

interface UserMenuProps {
  onOpenSettings?: () => void;
  collapsed?: boolean;
}

export function UserMenu({ onOpenSettings, collapsed = false }: UserMenuProps) {
  const { user, isAuthenticated, login, logout } = useAuth();
  const { language, toggleLanguage, t } = useI18n();

  const displayName = user?.name ?? t("guest_user");
  const displayEmail = user?.email ?? "guest@cosmo.ai";
  const initials = user?.initials ?? "G";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left text-xs transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
          title={displayName}
        >
          <Avatar className="size-7 shrink-0">
            {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={displayName} />}
            <AvatarFallback className="bg-primary/20 text-primary font-bold text-[11px]">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate font-medium text-sidebar-foreground">{displayName}</p>
            <p className="truncate text-[10px] text-muted-foreground">{displayEmail}</p>
          </div>

          <MoreVertical className="size-3.5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={collapsed ? "center" : "start"}
        side={collapsed ? "right" : "top"}
        sideOffset={8}
        className="w-56"
      >
        <DropdownMenuLabel className="p-2">
          <div className="flex items-center gap-2">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{displayName}</p>
              <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                <ShieldCheck className="size-2.5" />
                {user?.role === "engineer" ? t("engineer_user") : t("guest_user")}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          {onOpenSettings && (
            <DropdownMenuItem onClick={onOpenSettings} className="gap-2 text-xs">
              <Settings2 className="size-3.5 text-muted-foreground" />
              <span>{t("system_settings_tab")}</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={toggleLanguage} className="gap-2 text-xs">
            <Globe className="size-3.5 text-muted-foreground" />
            <span className="flex-1">{t("language_switch")}</span>
            <span className="font-mono text-[10px] font-bold text-primary uppercase">
              {language === "vi" ? "VI" : "EN"}
            </span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {isAuthenticated ? (
          <DropdownMenuItem onClick={logout} className="gap-2 text-xs text-destructive focus:text-destructive">
            <LogOut className="size-3.5" />
            <span>{t("sign_out")}</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => login()} className="gap-2 text-xs text-primary focus:text-primary">
            <User className="size-3.5" />
            <span>{t("sign_in")}</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
