import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Megaphone,
  Building2,
  Calendar,
  ScrollText,
  Tag,
  BookOpen,
  Settings,
  ChevronDown,
  PanelRightClose,
  PanelRightOpen,
  BookUser,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";

const navItems = []; // Moved inside component for dynamic prefixing

const accountsList = [
  { id: 1, label: "LeadAwaker Agency" },
  { id: 2, label: "FitnessGym ABC" },
  { id: 3, label: "LawFirm XYZ" },
];

export function RightSidebar() {
  const [location, setLocation] = useLocation();
  const { currentAccountId, setCurrentAccountId, currentAccount, isAgencyView } = useWorkspace();
  const [openSwitcher, setOpenSwitcher] = useState(false);

  const prefix = isAgencyView ? "/agency" : "/subaccount";
  const navItems = [
    { href: `${prefix}/dashboard`, label: "Dashboard", icon: LayoutDashboard, testId: "nav-dashboard" },
    { href: `${prefix}/contacts`, label: "Contacts", icon: BookUser, testId: "nav-contacts" },
    { href: `${prefix}/conversations`, label: "Conversations", icon: MessageSquare, testId: "nav-conversations" },
    { href: `${prefix}/campaigns`, label: "Campaigns", icon: Megaphone, testId: "nav-campaigns" },
    { href: `${prefix}/calendar`, label: "Calendar", icon: Calendar, testId: "nav-calendar" },
    { href: `${prefix}/accounts`, label: "Accounts", icon: Building2, testId: "nav-accounts", agencyOnly: true },
    { href: `${prefix}/settings`, label: "Settings", icon: Settings, testId: "nav-settings" },
  ];

  const handleAccountSelect = (id: number) => {
    setCurrentAccountId(id);
    setOpenSwitcher(false);
    
    const isTargetAgency = id === 1;
    const currentPath = location.split('/').slice(2).join('/');
    const newBase = isTargetAgency ? "/agency" : "/subaccount";
    setLocation(`${newBase}/${currentPath || 'dashboard'}`);
  };

  return (
    <div className="flex items-center gap-6 w-full" data-testid="top-nav">
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpenSwitcher((v) => !v)}
          className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2 hover:bg-muted/30 transition-colors min-w-[180px]"
          data-testid="wrap-workspace"
        >
          <div className="text-sm font-semibold truncate">
            {currentAccount.name}
          </div>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", openSwitcher && "rotate-180")} />
        </button>

        {openSwitcher && (
          <div 
            className="absolute top-full left-0 mt-2 w-64 bg-background border border-border rounded-xl shadow-xl z-[60] py-1 animate-in fade-in zoom-in-95 duration-100"
            data-testid="dropdown-switcher"
          >
            {accountsList.map((acc) => (
              <button
                key={acc.id}
                onClick={() => handleAccountSelect(acc.id)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between",
                  currentAccountId === acc.id && "text-blue-600 font-medium bg-blue-50/50"
                )}
              >
                <span className="truncate">{acc.label}</span>
                {acc.id === 1 && (
                  <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold uppercase ml-2">
                    Agency
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar" data-testid="nav-top">
        {navItems.map((it) => {
          if (it.agencyOnly && !isAgencyView) return null;
          const active = location === it.href;
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border border-transparent transition-all whitespace-nowrap",
                active
                  ? isAgencyView
                    ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20"
                    : "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm font-semibold">{it.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
