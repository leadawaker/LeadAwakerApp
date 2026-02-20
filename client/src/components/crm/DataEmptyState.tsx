import {
  Users,
  Megaphone,
  Building2,
  Tag,
  UserCog,
  BookOpen,
  Activity,
  MessageSquare,
  CalendarDays,
  LayoutDashboard,
  Inbox,
  Search,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type EmptyStateVariant =
  | "leads"
  | "campaigns"
  | "accounts"
  | "tags"
  | "users"
  | "prompts"
  | "automation"
  | "conversations"
  | "calendar"
  | "dashboard"
  | "search"
  | "generic";

interface EmptyStateConfig {
  icon: LucideIcon;
  title: string;
  description: string;
}

const emptyStateConfigs: Record<EmptyStateVariant, EmptyStateConfig> = {
  leads: {
    icon: Users,
    title: "No leads yet",
    description: "Import leads or add your first contact to start tracking your pipeline.",
  },
  campaigns: {
    icon: Megaphone,
    title: "No campaigns yet",
    description: "Create your first campaign to start engaging with leads via WhatsApp.",
  },
  accounts: {
    icon: Building2,
    title: "No accounts yet",
    description: "Add a client account to begin managing their leads and campaigns.",
  },
  tags: {
    icon: Tag,
    title: "No tags found",
    description: "Create tags to categorize and organize your leads for better segmentation.",
  },
  users: {
    icon: UserCog,
    title: "No team members",
    description: "Invite team members to collaborate on managing leads and campaigns.",
  },
  prompts: {
    icon: BookOpen,
    title: "No prompts saved",
    description: "Create AI prompt templates to standardize messaging across campaigns.",
  },
  automation: {
    icon: Activity,
    title: "No automation logs",
    description: "Automation logs will appear here once n8n workflows start running.",
  },
  conversations: {
    icon: MessageSquare,
    title: "No conversations yet",
    description: "Conversations will appear here once leads start receiving messages.",
  },
  calendar: {
    icon: CalendarDays,
    title: "No appointments scheduled",
    description: "Booked calls and appointments will show up here as leads convert.",
  },
  dashboard: {
    icon: LayoutDashboard,
    title: "No data to display",
    description: "Start by adding leads and creating campaigns to see your dashboard metrics.",
  },
  search: {
    icon: Search,
    title: "No results found",
    description: "Try adjusting your search or filters to find what you're looking for.",
  },
  generic: {
    icon: Inbox,
    title: "Nothing here yet",
    description: "Data will appear here once it's been created.",
  },
};

interface DataEmptyStateProps {
  /** Which empty state variant to use */
  variant: EmptyStateVariant;
  /** Override the default title */
  title?: string;
  /** Override the default description */
  description?: string;
  /** Override the default icon */
  icon?: LucideIcon;
  /** Optional call-to-action button */
  actionLabel?: string;
  /** CTA click handler */
  onAction?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode for inline/table contexts */
  compact?: boolean;
}

/**
 * Consistent empty state component for data pages.
 * Provides a uniform design language with icon, title, and helpful messaging
 * that guides users on what action to take.
 *
 * Supports both light and dark mode via Tailwind dark: variants.
 */
export function DataEmptyState({
  variant,
  title: titleOverride,
  description: descOverride,
  icon: iconOverride,
  actionLabel,
  onAction,
  className,
  compact = false,
}: DataEmptyStateProps) {
  const config = emptyStateConfigs[variant];
  const Icon = iconOverride || config.icon;
  const title = titleOverride || config.title;
  const description = descOverride || config.description;

  if (compact) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 py-10 px-4 text-center",
          className
        )}
        data-testid="empty-state"
        data-variant={variant}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted dark:bg-muted/50">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground max-w-[280px]">{description}</p>
        {actionLabel && onAction && (
          <Button
            size="sm"
            variant="outline"
            onClick={onAction}
            className="mt-1 h-7 text-xs"
          >
            {actionLabel}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg border border-dashed border-border/60 dark:border-border/40",
        "bg-muted/15 dark:bg-muted/8 glass-surface",
        "p-8 md:p-12 min-h-[250px]",
        className
      )}
      data-testid="empty-state"
      data-variant={variant}
    >
      <div className="flex flex-col items-center text-center max-w-sm space-y-4">
        {/* Icon container */}
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 dark:bg-muted/30 glass-surface ring-1 ring-border/30 dark:ring-border/20">
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>

        {/* Text content */}
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-foreground font-heading tracking-tight">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>

        {/* Optional CTA */}
        {actionLabel && onAction && (
          <Button
            size="sm"
            variant="outline"
            onClick={onAction}
            className="mt-2"
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
