import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Search,
  Bell,
  Settings,
  Moon,
  HelpCircle,
  Headphones,
  LayoutDashboard,
  MessageSquare,
  Megaphone,
  Building2,
  Calendar,
  ScrollText,
  Users,
  Tag,
  BookOpen,
  PanelRightClose,
  PanelRightOpen,
  BookUser,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function IconButton({
  label,
  onClick,
  children,
  active,
  testId,
  isAgencyView,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  active?: boolean;
  testId: string;
  isAgencyView: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative h-8 w-8 rounded-lg grid place-items-center transition-colors",
        active ? "bg-black/10 text-black" : "text-black/60 hover:bg-black/5",
        !isAgencyView && !active && "text-white/60 hover:text-white hover:bg-white/10"
      )}
      data-testid={testId}
    >
      {children}
      <div
        className="pointer-events-none absolute top-full mt-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-[110]"
        data-testid={`${testId}-tooltip`}
      >
        <div className="rounded-md border border-border bg-popover text-popover-foreground px-2 py-0.5 text-[10px] shadow-md whitespace-nowrap">
          {label}
        </div>
      </div>
    </button>
  );
}

const accountsList = [
  { id: 1, label: "LeadAwaker Agency" },
  { id: 2, label: "FitnessGym ABC" },
  { id: 3, label: "LawFirm XYZ" },
];

export function RightSidebar({ 
  collapsed, 
  onCollapse,
  onOpenSupport,
  onOpenSearch,
  onOpenNotifications,
  onOpenEdgeSettings,
  onToggleHelp,
  notificationsCount,
  onGoHome,
}: { 
  collapsed: boolean; 
  onCollapse: (v: boolean) => void;
  onOpenSupport: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenEdgeSettings: () => void;
  onToggleHelp: () => void;
  onGoHome: () => void;
  notificationsCount?: number;
}) {
  const [location, setLocation] = useLocation();
  const { currentAccountId, setCurrentAccountId, currentAccount, isAgencyView } = useWorkspace();
  const [openSwitcher, setOpenSwitcher] = useState(false);
  const [dark, setDark] = useState(false);
  const count = notificationsCount ?? 0;

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on location change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const prefix = isAgencyView ? "/agency" : "/subaccount";
  const navItems: { href: string; label: string; icon: any; testId: string; agencyOnly?: boolean }[] = [
    { href: `${prefix}/dashboard`, label: "Dashboard", icon: LayoutDashboard, testId: "nav-dashboard" },
    { href: `${prefix}/contacts`, label: "Contacts", icon: BookUser, testId: "nav-contacts" },
    { href: `${prefix}/conversations`, label: "Conversations", icon: MessageSquare, testId: "nav-conversations" },
    { href: `${prefix}/campaigns`, label: "Campaigns", icon: Megaphone, testId: "nav-campaigns" },
    { href: `${prefix}/calendar`, label: "Calendar", icon: Calendar, testId: "nav-calendar" },
    { href: `${prefix}/automation-logs`, label: "Automation Logs", icon: ScrollText, testId: "nav-automation-logs" },
    { href: `${prefix}/users`, label: "Users", icon: Users, testId: "nav-users" },
    { href: `${prefix}/tags`, label: "Tags", icon: Tag, testId: "nav-tags" },
    { href: `${prefix}/prompt-library`, label: "Prompt Library", icon: BookOpen, testId: "nav-prompt-library" },
  ];

  const handleAccountSelect = (id: number) => {
    const prevIsAgency = currentAccountId === 1;
    const prevBase = prevIsAgency ? "/agency" : "/subaccount";

    setCurrentAccountId(id);
    setOpenSwitcher(false);

    const nextIsAgency = id === 1;
    const nextBase = nextIsAgency ? "/agency" : "/subaccount";

    // Keep the same page path, but swap the base (agency/subaccount).
    // Example: /agency/conversations -> /subaccount/conversations
    const tail = location.startsWith(prevBase)
      ? location.slice(prevBase.length)
      : location.replace(/^\/(agency|subaccount)/, "");

    const nextPath = `${nextBase}${tail || "/dashboard"}`;
    setLocation(nextPath);
  };

  return (
    <>
      {/* Desktop Top Bar */}
      {/* Hidden to avoid double header */}

      {/* Mobile Bottom Bar */}
      <div
        className={cn(
          "md:hidden fixed bottom-0 left-0 right-0 h-[64px] border-t z-[100] flex items-center justify-around px-2",
          isAgencyView ? "bg-yellow-50" : "bg-blue-50/95"
        )}
      >
        <button
          onClick={() => { setLocation(`${prefix}/dashboard`); setIsMobileMenuOpen(false); }}
          className={cn(
            "p-3 rounded-xl transition-colors relative group",
            isAgencyView ? "text-yellow-600 hover:bg-yellow-100" : "text-blue-700 hover:bg-blue-100"
          )}
          title="Dashboard"
        >
          <LayoutDashboard className="h-6 w-6" />
        </button>

        <button
          onClick={() => { setLocation(`${prefix}/contacts`); setIsMobileMenuOpen(false); }}
          className={cn(
            "p-3 rounded-xl transition-colors relative group",
            isAgencyView ? "text-yellow-600 hover:bg-yellow-100" : "text-blue-700 hover:bg-blue-100"
          )}
          title="Leads"
        >
          <BookUser className="h-6 w-6" />
        </button>

        <button
          onClick={() => { setLocation(`${prefix}/calendar`); setIsMobileMenuOpen(false); }}
          className={cn(
            "p-3 rounded-xl transition-colors relative group",
            isAgencyView ? "text-yellow-600 hover:bg-yellow-100" : "text-blue-700 hover:bg-blue-100"
          )}
          title="Calendar"
        >
          <Calendar className="h-6 w-6" />
        </button>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={cn(
            "p-3 rounded-xl transition-colors relative group",
            isAgencyView ? "text-yellow-600 hover:bg-yellow-100" : "text-blue-700 hover:bg-blue-100"
          )}
          title="Menu"
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Fullscreen Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[90] bg-background animate-in slide-in-from-bottom duration-300 pb-[64px]">
          <div className="h-full flex flex-col overflow-y-auto p-4 space-y-6">
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-3 mb-2">Workspace</h3>
              <button
                type="button"
                onClick={() => setOpenSwitcher((v) => !v)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 h-[56px] px-4",
                  isAgencyView ? "text-yellow-600 font-bold" : "text-blue-600 font-bold"
                )}
              >
                <div className="min-w-0 text-left">
                  <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                    <span className="truncate">{currentAccount.name}</span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", openSwitcher && "rotate-180")} />
                  </div>
                </div>
              </button>
              
              {openSwitcher && (
                <div className="bg-muted/10 border border-border rounded-xl overflow-hidden mt-2">
                  {accountsList.map((acc) => (
                    <button
                      key={acc.id}
                      onClick={() => handleAccountSelect(acc.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between border-b border-border/50 last:border-0",
                        currentAccountId === acc.id && "text-blue-600 font-bold bg-blue-50/50",
                      )}
                    >
                      <span className="truncate">{acc.label}</span>
                      {acc.id === 1 && (
                        <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                          Agency
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <nav className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-3 mb-2">Navigation</h3>
              {navItems.map((it) => {
                if (it.agencyOnly && !isAgencyView) return null;
                const active = location === it.href;
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border border-transparent px-4 py-3.5 transition-colors",
                      active
                        ? isAgencyView
                          ? "bg-yellow-500 text-black font-bold shadow-lg shadow-yellow-500/20"
                          : "bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30 font-medium",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-base">{it.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-3 mb-2">System</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onOpenSearch}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <Search className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs font-semibold">Search</span>
                </button>
                <button
                  onClick={onOpenNotifications}
                  className="relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <Bell className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs font-semibold">Alerts</span>
                  {count > 0 && (
                    <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center border-2 border-background">
                      {count}
                    </div>
                  )}
                </button>
                <button
                  onClick={onToggleHelp}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <HelpCircle className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs font-semibold">Help</span>
                </button>
                <button
                  onClick={onOpenSupport}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <Headphones className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs font-semibold">Support</span>
                </button>
                <button
                  onClick={() => {
                    setDark((v) => !v);
                    document.documentElement.classList.toggle("dark");
                  }}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <Moon className={cn("h-6 w-6", dark ? "text-yellow-500" : "text-muted-foreground")} />
                  <span className="text-xs font-semibold">{dark ? "Light Mode" : "Dark Mode"}</span>
                </button>
              </div>
            </div>

            <div className="mt-auto pt-6 border-t border-border">
              <div className="text-center text-[11px] text-muted-foreground">
                MOCK CRM • NocoDB-ready
              </div>
            </div>
          </div>
        </div>
      )}

      <aside
        className={cn(
          "fixed left-4 top-[16px] bottom-4 border-none bg-background z-40 transition-all hidden md:block rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)]",
          collapsed ? "w-[60px]" : "w-[180px]",
        )}
        data-testid="sidebar-left"
      >
        <div className="h-full flex flex-col">
          <div className={cn("h-auto py-8 flex items-center justify-start px-6 relative")}> 
            <button
              type="button"
              onClick={onGoHome}
              className="flex items-center justify-center hover:opacity-80 transition-opacity"
            >
              <img src="/6. Favicon.svg" alt="Lead Awaker" className="h-10 w-10 object-contain" />
            </button>
          </div>

          <nav className={cn("px-3 space-y-4 flex-1")} data-testid="nav-right">
            {navItems.map((it) => {
              if (it.agencyOnly && !isAgencyView) return null;
              const active = location === it.href;
              const Icon = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-transparent transition-all group",
                    collapsed ? "h-12 justify-center" : "px-3 py-3",
                    active
                      ? isAgencyView
                        ? "text-yellow-600"
                        : "text-blue-600"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  data-testid={`link-${it.testId}`}
                  title={collapsed ? it.label : undefined}
                >
                  <Icon className={cn("h-[32px] w-[32px]", active && "scale-110")} />
                  {!collapsed && <span className="text-base font-bold tracking-tight">{it.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className={cn("mt-auto px-3 mb-8 space-y-4")} data-testid="section-sidebar-bottom">
            <button
              type="button"
              onClick={() => onCollapse(!collapsed)}
              className={cn(
                "w-full h-12 rounded-xl transition-colors flex items-center gap-3 text-muted-foreground hover:text-foreground",
                collapsed ? "justify-center" : "px-3",
              )}
              data-testid="button-sidebar-collapse"
              aria-label="Toggle sidebar"
            >
              {collapsed ? <PanelRightClose className="h-[32px] w-[32px]" /> : <PanelRightOpen className="h-[32px] w-[32px]" />}
              {!collapsed && <span className="text-base font-bold">Collapse</span>}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "w-full h-12 rounded-xl transition-colors flex items-center gap-3 text-muted-foreground hover:text-foreground",
                    collapsed ? "justify-center" : "px-3",
                  )}
                  data-testid="button-sidebar-help"
                >
                  <HelpCircle className="h-[32px] w-[32px]" />
                  {!collapsed && <span className="text-base font-bold">Help</span>}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="right" className="w-56 ml-2 rounded-xl shadow-xl border-border bg-background">
                <DropdownMenuItem onClick={onOpenSupport} className="py-3 cursor-pointer font-bold flex items-center gap-2">
                  <Headphones className="h-5 w-5" />
                  Speak to Support
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation('/documentation')} className="py-3 cursor-pointer font-bold flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Documentation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>
    </>
  );
}
