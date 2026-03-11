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
  Inbox,
  Search,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

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
  | "search"
  | "generic";

interface EmptyStateConfig {
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
}

const emptyStateConfigs: Record<EmptyStateVariant, EmptyStateConfig> = {
  leads: {
    icon: Users,
    titleKey: "emptyStates.leads.title",
    descKey: "emptyStates.leads.description",
  },
  campaigns: {
    icon: Megaphone,
    titleKey: "emptyStates.campaigns.title",
    descKey: "emptyStates.campaigns.description",
  },
  accounts: {
    icon: Building2,
    titleKey: "emptyStates.accounts.title",
    descKey: "emptyStates.accounts.description",
  },
  tags: {
    icon: Tag,
    titleKey: "emptyStates.tags.title",
    descKey: "emptyStates.tags.description",
  },
  users: {
    icon: UserCog,
    titleKey: "emptyStates.users.title",
    descKey: "emptyStates.users.description",
  },
  prompts: {
    icon: BookOpen,
    titleKey: "emptyStates.prompts.title",
    descKey: "emptyStates.prompts.description",
  },
  automation: {
    icon: Activity,
    titleKey: "emptyStates.automation.title",
    descKey: "emptyStates.automation.description",
  },
  conversations: {
    icon: MessageSquare,
    titleKey: "emptyStates.conversations.title",
    descKey: "emptyStates.conversations.description",
  },
  calendar: {
    icon: CalendarDays,
    titleKey: "emptyStates.calendar.title",
    descKey: "emptyStates.calendar.description",
  },
  search: {
    icon: Search,
    titleKey: "emptyStates.search.title",
    descKey: "emptyStates.search.description",
  },
  generic: {
    icon: Inbox,
    titleKey: "emptyStates.generic.title",
    descKey: "emptyStates.generic.description",
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
  const { t } = useTranslation("crm");
  const config = emptyStateConfigs[variant];
  const Icon = iconOverride || config.icon;
  const title = titleOverride || t(config.titleKey);
  const description = descOverride || t(config.descKey);

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
          <Icon className="h-4 w-4 text-muted-foreground" />
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
