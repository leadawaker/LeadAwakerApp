import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Search,
  Bell,
  Moon,
  HelpCircle,
  Headphones,
  LayoutDashboard,
  MessageSquare,
  Megaphone,
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
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function RightSidebar({
  collapsed,
  onCollapse,
  onOpenSupport,
  onOpenSearch,
  onOpenNotifications,
  onToggleHelp,
  notificationsCount,
}: {
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
  onOpenSupport: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onToggleHelp: () => void;
  notificationsCount?: number;
}) {
  const [location, setLocation] = useLocation();
  const { currentAccount, isAgencyView } = useWorkspace();

  const [openSwitcher, setOpenSwitcher] = useState(false);
  const [dark, setDark] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const count = notificationsCount ?? 0;

  // ✅ ADMIN CHECK
  const currentUserEmail =
    localStorage.getItem("leadawaker_user_email") || "";
  const isAdmin = currentUserEmail === "leadawaker@gmail.com";

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const prefix = isAgencyView ? "/agency" : "/subaccount";

  const navItems: {
    href: string;
    label: string;
    icon: any;
    testId: string;
    adminOnly?: boolean;
    agencyOnly?: boolean;
  }[] = [
    { href: `${prefix}/dashboard`, label: "Dashboard", icon: LayoutDashboard, testId: "nav-home" },
    {
      href: `${prefix}/accounts`,
      label: "Accounts",
      icon: Building2,
      testId: "nav-accounts",
      agencyOnly: true,
    },
    { href: `${prefix}/campaigns`, label: "Campaigns", icon: Megaphone, testId: "nav-campaigns" },
    { href: `${prefix}/contacts`, label: "Contacts", icon: BookUser, testId: "nav-contacts" },
    { href: `${prefix}/conversations`, label: "Chats", icon: MessageSquare, testId: "nav-chats" },
    { href: `${prefix}/calendar`, label: "Calendar", icon: Calendar, testId: "nav-calendar" },
    { href: `${prefix}/tags`, label: "Tags", icon: Tag, testId: "nav-tags" },
    { href: `${prefix}/users`, label: "Users", icon: Users, testId: "nav-users" },

    // 🔒 ADMIN ONLY
    {
      href: `${prefix}/automation-logs`,
      label: "Automations",
      icon: ScrollText,
      testId: "nav-automations",
      adminOnly: true,
    },
    {
      href: `${prefix}/prompt-library`,
      label: "Library",
      icon: BookOpen,
      testId: "nav-library",
      adminOnly: true,
    },
  ];

  const visibleNavItems = navItems.filter((it) => {
    if (it.adminOnly && !isAdmin) return false;
    if (it.agencyOnly && !(isAdmin || isAgencyView)) return false;
    return true;
  });

  return (
    <>
      {/* MOBILE BOTTOM BAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-[64px] border-t bg-white z-[100] flex justify-around">
        <button onClick={() => setLocation(`${prefix}/dashboard`)}>
          <LayoutDashboard />
        </button>
        <button onClick={() => setLocation(`${prefix}/contacts`)}>
          <BookUser />
        </button>
        <button onClick={() => setLocation(`${prefix}/conversations`)}>
          <MessageSquare />
        </button>
        <button onClick={() => setIsMobileMenuOpen((v) => !v)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* MOBILE MENU */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[90] bg-white pb-[64px]">
          <nav className="p-4 space-y-2">
            {visibleNavItems.map((it) => {
              const Icon = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className="flex gap-3 p-3 rounded-xl"
                >
                  <Icon />
                  {it.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside
        className={cn(
          "fixed left-4 top-[16px] bottom-4 bg-white border rounded-[32px] shadow hidden md:block",
          collapsed ? "w-[60px]" : "w-[180px]"
        )}
      >
        <div className="h-full flex flex-col">
          {/* LOGO */}
          <div className={cn("py-6 flex", collapsed ? "justify-center" : "pl-4")}>
            <Link href="/">
              <img
                src="/6. Favicon.svg"
                alt="Lead Awaker"
                className="h-10 w-10"
              />
            </Link>
          </div>

          {/* NAV */}
          <nav className="px-3 space-y-2 flex-1">
            {visibleNavItems.map((it) => {
              const active = location === it.href;
              const Icon = it.icon;

              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={cn(
                    "relative group flex items-center gap-3 rounded-xl transition-colors",
                    collapsed ? "h-12 justify-center" : "px-3 py-3",
                    active
                      ? "bg-blue-600 text-white"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                  data-testid={`link-${it.testId}`}
                >
                  <Icon className="h-5 w-5" />
                  {!collapsed && (
                    <span className="text-sm font-semibold">
                      {it.label}
                    </span>
                  )}

                  {/* 🔹 COLLAPSED TOOLTIP (RESTORED) */}
                  {collapsed && (
                    <div className="absolute left-[40px] opacity-0 group-hover:opacity-100 transition-opacity z-[120] pointer-events-none">
                      <div
                        className={cn(
                          "px-3 py-3.5 rounded-xl text-sm font-semibold whitespace-nowrap",
                          active
                            ? "bg-blue-600 text-white"
                            : "bg-muted text-foreground"
                        )}
                      >
                        {it.label}
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* BOTTOM ACTIONS */}
          <div className="px-3 mb-8 space-y-3">
            {/* COLLAPSE */}
            <button
              onClick={() => onCollapse(!collapsed)}
              className={cn(
                "w-full h-11 rounded-xl flex items-center gap-3 text-muted-foreground hover:text-foreground",
                collapsed ? "justify-center" : "px-3"
              )}
            >
              {collapsed ? (
                <PanelRightClose className="h-5 w-5" />
              ) : (
                <PanelRightOpen className="h-5 w-5" />
              )}
              {!collapsed && <span className="font-bold">Collapse</span>}
            </button>

            {/* HELP */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "w-full h-11 rounded-xl flex items-center gap-3 text-muted-foreground hover:text-foreground",
                    collapsed ? "justify-center" : "px-3"
                  )}
                >
                  <HelpCircle className="h-5 w-5" />
                  {!collapsed && <span className="font-bold">Help</span>}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start">
                <DropdownMenuItem onClick={onOpenSupport}>
                  <Headphones className="h-4 w-4 mr-2" />
                  Support
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleHelp}>
                  <BookOpen className="h-4 w-4 mr-2" />
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