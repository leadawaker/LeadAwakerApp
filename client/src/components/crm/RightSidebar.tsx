import { useLocation } from "wouter";
import { useWorkspace } from "@/hooks/useWorkspace";
import { 
  LayoutDashboard, 
  MessageSquare, 
  Users, 
  Zap, 
  Calendar, 
  Tag, 
  BarChart3,
  Search,
  Bell,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RightSidebarProps {
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
  onOpenSupport?: () => void;
  onOpenSearch?: () => void;
  onOpenNotifications?: () => void;
  notificationsCount?: number;
  onOpenEdgeSettings?: () => void;
  onToggleHelp?: () => void;
  onGoHome?: () => void;
  hideStandardSidebar?: boolean;
}

export function RightSidebar({ 
  collapsed, 
  onCollapse, 
  onOpenSupport,
  onOpenSearch,
  onOpenNotifications,
  notificationsCount = 0,
  onOpenEdgeSettings,
  onToggleHelp,
  onGoHome,
  hideStandardSidebar = false
}: RightSidebarProps) {
  const [location, setLocation] = useLocation();
  const { isAgencyView } = useWorkspace();

  const base = isAgencyView ? "/agency" : "/subaccount";

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: `${base}/dashboard` },
    { icon: MessageSquare, label: "Conversations", href: `${base}/conversations` },
    { icon: Users, label: "Contacts", href: `${base}/contacts` },
    { icon: Zap, label: "Automation Logs", href: `${base}/automation` },
    { icon: Calendar, label: "Calendar", href: `${base}/calendar` },
    { icon: Tag, label: "Tags", href: `${base}/tags` },
    { icon: BarChart3, label: "Campaigns", href: `${base}/campaigns` },
  ];

  if (hideStandardSidebar) {
    return (
      <nav className="flex-1 space-y-1 px-2">
        {navItems.map((item) => {
          const isActive = location.startsWith(item.href);
          return (
            <button
              key={item.label}
              onClick={() => setLocation(item.href)}
              className={cn(
                "w-full flex items-center gap-3 h-10 px-3 rounded-xl transition-all duration-200 group relative",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", !isActive && "group-hover:scale-110 transition-transform")} />
              {!collapsed && <span className="text-sm font-semibold truncate">{item.label}</span>}
              {collapsed && isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-foreground rounded-r-full" />
              )}
            </button>
          );
        })}
      </nav>
    );
  }

  return null;
}
