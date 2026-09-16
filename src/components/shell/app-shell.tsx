import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Inbox,
  ClipboardList,
  Users,
  Gauge,
  Settings as SettingsIcon,
  Moon,
  Sun,
  LogOut,
  Plus,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";
import { useServiceLine } from "@/context/service-line";
import { ServiceLineFilter } from "@/components/shell/service-line-filter";
import { LogTodayDialog } from "@/components/log-today/log-today-dialog";
import { useDailyCheckin } from "@/hooks/use-data";
import { todayInBrisbane, TIME_ZONE } from "@/lib/format";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: Inbox },
  { to: "/daily-log", label: "Daily Log", icon: ClipboardList },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/capacity", label: "Capacity", icon: Gauge },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AppShell({
  children,
  displayName,
  email,
}: {
  children: ReactNode;
  displayName: string;
  email: string;
}) {
  const { theme, toggle } = useTheme();
  const { serviceLine } = useServiceLine();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const search = serviceLine === "All" ? {} : { service: serviceLine };
  const [logOpen, setLogOpen] = useState(false);
  const today = todayInBrisbane();
  const checkin = useDailyCheckin(today);
  const logged = !!checkin.data;
  const brisbaneHour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: TIME_ZONE }).format(new Date()),
  );
  const overdue = !logged && brisbaneHour >= 16;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-16 items-center px-5">
          <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
            Social <span className="text-primary">Lab</span>
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              search={search}
              activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-accent text-accent-foreground" }}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-3 pb-4 text-xs text-muted-foreground">Brisbane time · AUD</div>
      </aside>

      <div className="md:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
          <span className="text-base font-semibold tracking-tight md:hidden">
            Social <span className="text-primary">Lab</span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <ServiceLineFilter />
            <Button
              size="sm"
              onClick={() => setLogOpen(true)}
              variant={logged ? "outline" : "default"}
              className={
                logged
                  ? "gap-1.5 border-[var(--good)] text-[var(--good)]"
                  : overdue
                    ? "gap-1.5 bg-[var(--warning)] text-[var(--warning-foreground)] hover:bg-[var(--warning)]/90"
                    : "gap-1.5"
              }
            >
              {logged ? (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              ) : overdue ? (
                <AlertTriangle className="size-4" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{logged ? "Logged" : "Log today"}</span>
              <span className="sr-only sm:hidden">{logged ? "Logged" : "Log today"}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <Sun className="size-4" aria-hidden="true" />
              ) : (
                <Moon className="size-4" aria-hidden="true" />
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="max-w-40 truncate">
                  {displayName}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-medium">{displayName}</div>
                  <div className="text-xs text-muted-foreground">{email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="px-4 pb-24 pt-6 md:px-6 md:pb-10">{children}</main>
      </div>

      <LogTodayDialog open={logOpen} onOpenChange={setLogOpen} />

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-border bg-background md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            search={search}
            activeOptions={{ exact: to === "/" }}
            className="flex flex-col items-center gap-1 px-1 py-2 text-[10px] font-medium text-muted-foreground"
            activeProps={{ className: "text-primary" }}
          >
            <Icon className="size-5" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
