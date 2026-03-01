// src/features/accounts/components/AccountDetailsDialog.tsx
// src/features/accounts/components/AccountDetailsDialog.tsx
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Phone,
  Bot,
  Globe,
  Clock,
  FileText,
  Save,
  Pencil,
  X,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  Ban,
  HelpCircle,
  Loader2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AccountRow {
  [key: string]: any;
  Id?: number;
  id?: number;
  name?: string;
  phone?: string;
  owner_email?: string;
  website?: string;
  timezone?: string;
  notes?: string;
  status?: string;
  type?: string;
  business_niche?: string;
  business_description?: string;
  business_hours_start?: string;
  business_hours_end?: string;
  max_daily_sends?: number;
  webhook_url?: string;
  webhook_secret?: string;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_messaging_service_sid?: string;
  twilio_default_from_number?: string;
  default_ai_name?: string;
  default_ai_role?: string;
  default_ai_style?: string;
  default_typo_frequency?: string;
  preferred_terminology?: string;
  service_categories?: string;
  opt_out_keyword?: string;
  data_collection_disclosure?: string;
  address?: string | null;
  tax_id?: string | null;
  logo_url?: string | null;
}

interface AccountDetailsDialogProps {
  account: AccountRow | null;
  open?: boolean;
  onClose?: () => void;
  onSave: (accountId: number, patch: Partial<AccountRow>) => Promise<void>;
  /** When true, renders as an inline panel instead of a modal dialog */
  panelMode?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ["Active", "Inactive", "Trial", "Suspended", "Unknown"];
const TYPE_OPTIONS = ["Agency", "Client"];
const TYPO_FREQUENCY_OPTIONS = ["None", "Rare", "Occasional", "Frequent"];
const TIMEZONE_OPTIONS = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Asia/Tokyo",
  "Asia/Dubai",
  "Asia/Singapore",
  "Australia/Sydney",
];

function statusBadgeProps(status: string) {
  switch (status) {
    case "Active":
      return {
        icon: <CheckCircle2 className="h-3 w-3" />,
        cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
      };
    case "Trial":
      return {
        icon: <Clock className="h-3 w-3" />,
        cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25",
      };
    case "Suspended":
      return {
        icon: <Ban className="h-3 w-3" />,
        cls: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25",
      };
    case "Inactive":
      return {
        icon: <PauseCircle className="h-3 w-3" />,
        cls: "bg-slate-400/15 text-slate-600 dark:text-slate-400 border-slate-400/25",
      };
    default:
      return {
        icon: <HelpCircle className="h-3 w-3" />,
        cls: "bg-slate-400/15 text-slate-600 dark:text-slate-400 border-slate-400/25",
      };
  }
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-5">
      <div className="text-primary">{icon}</div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
    </div>
  );
}

// ── Field Row ─────────────────────────────────────────────────────────────────

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 items-start py-2 border-b border-border/40 last:border-0">
      <Label className="text-xs text-muted-foreground pt-2 leading-tight">
        {label}
      </Label>
      <div>{children}</div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AccountDetailsDialog({
  account,
  open,
  onClose,
  onSave,
  panelMode = false,
}: AccountDetailsDialogProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [form, setForm] = useState<Partial<AccountRow>>({});
  const { toast } = useToast();

  // Reset form when account changes
  useEffect(() => {
    if (account) {
      setForm({ ...account });
      setEditing(false);
    }
  }, [account]);

  if (!account) return null;

  const accountId = account.Id ?? account.id ?? 0;
  const status = form.status ?? account.status ?? "Unknown";
  const badge = statusBadgeProps(status);

  function handleChange(key: string, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Build patch — only fields that changed
      const patch: Partial<AccountRow> = {};
      const keys: (keyof AccountRow)[] = [
        "name",
        "phone",
        "owner_email",
        "website",
        "timezone",
        "notes",
        "status",
        "type",
        "business_niche",
        "business_description",
        "business_hours_start",
        "business_hours_end",
        "max_daily_sends",
        "default_ai_name",
        "default_ai_role",
        "default_ai_style",
        "default_typo_frequency",
        "preferred_terminology",
        "service_categories",
        "opt_out_keyword",
        "data_collection_disclosure",
        "twilio_account_sid",
        "twilio_auth_token",
        "twilio_messaging_service_sid",
        "twilio_default_from_number",
        "webhook_secret",
      ];
      for (const k of keys) {
        if (form[k] !== account?.[k]) {
          (patch as any)[k] = form[k];
        }
      }
      await onSave(accountId, patch);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setForm({ ...account });
    setEditing(false);
  }

  /**
   * Quick status toggle: Active ↔ Inactive.
   * Non-destructive — only changes status field, no full edit mode needed.
   */
  async function handleStatusToggle(checked: boolean) {
    const newStatus = checked ? "Active" : "Inactive";
    setToggling(true);
    try {
      await onSave(accountId, { status: newStatus });
      setForm((prev) => ({ ...prev, status: newStatus }));
      toast({
        title: `Account ${newStatus === "Active" ? "activated" : "deactivated"}`,
        description: `${account?.name || "Account"} is now ${newStatus.toLowerCase()}.`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Status update failed",
        description: "Could not update account status. Please try again.",
      });
    } finally {
      setToggling(false);
    }
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  function textField(
    key: string,
    placeholder = "",
    type: "input" | "textarea" = "input"
  ) {
    if (!editing) {
      const val = form[key];
      return (
        <span className="text-sm text-foreground break-words">
          {val || <span className="text-muted-foreground italic">—</span>}
        </span>
      );
    }
    if (type === "textarea") {
      return (
        <Textarea
          value={form[key] ?? ""}
          onChange={(e) => handleChange(key, e.target.value)}
          placeholder={placeholder}
          className="text-sm min-h-[80px] resize-none"
          data-testid={`field-${key}`}
        />
      );
    }
    return (
      <Input
        value={form[key] ?? ""}
        onChange={(e) => handleChange(key, e.target.value)}
        placeholder={placeholder}
        className="text-sm h-8"
        data-testid={`field-${key}`}
      />
    );
  }

  /**
   * Formats a "HH:MM:SS" or "HH:MM" time string to a human-readable 12h format.
   * Returns "—" for empty/null values.
   */
  function formatTimeDisplay(val: string | null | undefined): React.ReactNode {
    if (!val) return <span className="text-muted-foreground italic">—</span>;
    // Strip seconds if present: "09:00:00" → "09:00"
    const parts = val.split(":");
    if (parts.length < 2) return <span className="text-foreground text-sm">{val}</span>;
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    if (isNaN(hours)) return <span className="text-foreground text-sm">{val}</span>;
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 === 0 ? 12 : hours % 12;
    return (
      <span className="text-sm text-foreground">
        {String(displayHour).padStart(2, "0")}:{minutes} {ampm}
      </span>
    );
  }

  /**
   * Converts a "HH:MM:SS" DB value to "HH:MM" for the <input type="time"> element.
   */
  function toTimeInputValue(val: string | null | undefined): string {
    if (!val) return "";
    const parts = val.split(":");
    if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
    return val;
  }

  /**
   * Time field: displays formatted time in view mode; native time picker in edit mode.
   * Saves in "HH:MM" format (the backend accepts this).
   */
  function timeField(key: string, placeholder = "00:00") {
    if (!editing) {
      return formatTimeDisplay(form[key]);
    }
    return (
      <Input
        type="time"
        value={toTimeInputValue(form[key])}
        onChange={(e) => handleChange(key, e.target.value)}
        placeholder={placeholder}
        className="text-sm h-8 w-36"
        data-testid={`field-${key}`}
      />
    );
  }

  function selectField(key: string, options: string[]) {
    const val = form[key] ?? account?.[key] ?? "";
    if (!editing) {
      return (
        <span className="text-sm text-foreground">
          {val || <span className="text-muted-foreground italic">—</span>}
        </span>
      );
    }
    return (
      <Select
        value={val}
        onValueChange={(v) => handleChange(key, v)}
      >
        <SelectTrigger className="h-8 text-sm" data-testid={`field-${key}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  function numberField(key: string, placeholder = "") {
    if (!editing) {
      const val = form[key];
      return (
        <span className="text-sm text-foreground">
          {val != null ? String(val) : <span className="text-muted-foreground italic">—</span>}
        </span>
      );
    }
    return (
      <Input
        type="number"
        value={form[key] ?? ""}
        onChange={(e) =>
          handleChange(key, e.target.value ? Number(e.target.value) : null)
        }
        placeholder={placeholder}
        className="text-sm h-8"
        data-testid={`field-${key}`}
      />
    );
  }

  /**
   * Parses a service_categories value — either a JSON array string or a
   * comma-separated plain string — into an array of category strings.
   */
  function parseServiceCategories(val: string | null | undefined): string[] {
    if (!val) return [];
    const trimmed = val.trim();
    // Try parsing as JSON array
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((s: unknown) => String(s).trim()).filter(Boolean);
        }
      } catch {
        // Fall through to comma split
      }
    }
    // Fallback: comma-separated
    return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  }

  /**
   * Service categories field:
   * - View mode: renders each category as a small badge/chip
   * - Edit mode: plain textarea where user can edit the raw JSON or comma list;
   *   the value is stored as-is (JSON string) in the form state
   */
  function serviceCategoriesField() {
    const val = form["service_categories"];
    if (!editing) {
      const cats = parseServiceCategories(val);
      if (cats.length === 0) {
        return <span className="text-muted-foreground italic text-sm">—</span>;
      }
      return (
        <div
          className="flex flex-wrap gap-1.5"
          data-testid="service-categories-display"
        >
          {cats.map((cat, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary border border-primary/20"
              data-testid={`service-category-tag-${i}`}
            >
              {cat}
            </span>
          ))}
        </div>
      );
    }
    // Edit mode: textarea with helpful hint
    return (
      <div className="space-y-1">
        <Textarea
          value={val ?? ""}
          onChange={(e) => handleChange("service_categories", e.target.value)}
          placeholder={`["Category A", "Category B"] or Category A, Category B`}
          className="text-sm min-h-[70px] resize-none font-mono text-xs"
          data-testid="field-service_categories"
        />
        <p className="text-[11px] text-muted-foreground">
          Enter as JSON array or comma-separated values
        </p>
      </div>
    );
  }

  // ── Shared inner content ─────────────────────────────────────────────────

  const headerContent = (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Building2 className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xl font-semibold truncate leading-tight">
          {account.name || "Unnamed Account"}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge
            variant="outline"
            className={cn(
              "flex items-center gap-1 text-[11px] px-2 py-0.5",
              badge.cls
            )}
          >
            {badge.icon}
            {status}
          </Badge>
          {account.type && (
            <Badge
              variant="outline"
              className="text-[11px] px-2 py-0.5 text-muted-foreground"
            >
              {account.type}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            #{accountId}
          </span>
          <div className="flex items-center gap-1.5 ml-1" title={status === "Active" ? "Click to deactivate" : "Click to activate"}>
            <Switch
              id={`status-toggle-${accountId}`}
              checked={status === "Active"}
              onCheckedChange={handleStatusToggle}
              disabled={toggling || saving}
              data-testid="account-status-toggle"
              className="scale-90"
            />
            <label
              htmlFor={`status-toggle-${accountId}`}
              className={cn(
                "text-[11px] font-medium cursor-pointer select-none",
                status === "Active"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground"
              )}
            >
              {toggling ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Updating...
                </span>
              ) : (
                status === "Active" ? "Active" : "Inactive"
              )}
            </label>
          </div>
        </div>
      </div>
      {panelMode && onClose && (
        <button
          onClick={onClose}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  const bodyContent = (
    <div className="space-y-0 pb-2">
      <SectionHeader icon={<Building2 className="h-4 w-4" />} title="Basic Information" />
      <FieldRow label="Name">{textField("name", "Account name")}</FieldRow>
      <FieldRow label="Status">{selectField("status", STATUS_OPTIONS)}</FieldRow>
      <FieldRow label="Type">{selectField("type", TYPE_OPTIONS)}</FieldRow>
      <FieldRow label="Business Niche">
        <div data-testid="field-business_niche">
          {textField("business_niche", "e.g. Construction, SaaS...")}
        </div>
      </FieldRow>

      <SectionHeader icon={<Phone className="h-4 w-4" />} title="Contact" />
      <FieldRow label="Owner Email">{textField("owner_email", "owner@example.com")}</FieldRow>
      <FieldRow label="Phone">{textField("phone", "+1 555 000 0000")}</FieldRow>
      <FieldRow label="Website">{textField("website", "https://...")}</FieldRow>

      <SectionHeader icon={<Clock className="h-4 w-4" />} title="Schedule & Timezone" />
      <FieldRow label="Timezone">{selectField("timezone", TIMEZONE_OPTIONS)}</FieldRow>
      <FieldRow label="Business Hours Open">{timeField("business_hours_start", "09:00")}</FieldRow>
      <FieldRow label="Business Hours Close">{timeField("business_hours_end", "17:00")}</FieldRow>
      <FieldRow label="Max Daily Sends">{numberField("max_daily_sends", "500")}</FieldRow>

      <SectionHeader icon={<Bot className="h-4 w-4" />} title="AI & Messaging" />
      <FieldRow label="AI Name">{textField("default_ai_name", "e.g. Alex")}</FieldRow>
      <FieldRow label="AI Role">{textField("default_ai_role", "e.g. admin support")}</FieldRow>
      <FieldRow label="AI Style">{textField("default_ai_style", "e.g. Natural, human, low pressure")}</FieldRow>
      <FieldRow label="Typo Frequency">{selectField("default_typo_frequency", TYPO_FREQUENCY_OPTIONS)}</FieldRow>
      <FieldRow label="Opt-out Keyword">{textField("opt_out_keyword", "e.g. STOP")}</FieldRow>
      <FieldRow label="Preferred Terminology">{textField("preferred_terminology", "")}</FieldRow>
      <FieldRow label="Disclosure Text">{textField("data_collection_disclosure", "", "textarea")}</FieldRow>

      <SectionHeader icon={<FileText className="h-4 w-4" />} title="Description & Notes" />
      <FieldRow label="Business Description">
        <div data-testid="field-business_description">
          {textField("business_description", "Describe the business...", "textarea")}
        </div>
      </FieldRow>
      <FieldRow label="Service Categories">{serviceCategoriesField()}</FieldRow>
      <FieldRow label="Notes">{textField("notes", "Internal notes...", "textarea")}</FieldRow>

      <SectionHeader icon={<Globe className="h-4 w-4" />} title="Twilio Integration" />
      <FieldRow label="Account SID">{textField("twilio_account_sid", "ACxxxxxxxx")}</FieldRow>
      <FieldRow label="Auth Token">{textField("twilio_auth_token", "")}</FieldRow>
      <FieldRow label="Messaging Service SID">{textField("twilio_messaging_service_sid", "MGxxxxxxxx")}</FieldRow>
      <FieldRow label="From Number">{textField("twilio_default_from_number", "+1 555 000 0000")}</FieldRow>
      <FieldRow label="API Key (Intake)">{textField("webhook_secret", "")}</FieldRow>
      <FieldRow label="Intake URL">
        <span className="text-[11px] font-mono text-foreground/70 select-all">https://webhooks.leadawaker.com/api/leads/intake</span>
      </FieldRow>
    </div>
  );

  const footerContent = (
    <div className={cn("flex items-center gap-2", panelMode ? "justify-end" : "")}>
      {editing ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={saving}
            data-testid="btn-cancel-edit"
          >
            <X className="h-4 w-4 mr-1.5" />
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            data-testid="btn-save-account"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            Save Changes
          </Button>
        </>
      ) : (
        <>
          {!panelMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              data-testid="btn-close-detail"
            >
              Close
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setEditing(true)}
            data-testid="btn-edit-account"
          >
            <Pencil className="h-4 w-4 mr-1.5" />
            Edit
          </Button>
        </>
      )}
    </div>
  );

  // ── Panel mode (inline right sidebar) ────────────────────────────────────

  if (panelMode) {
    return (
      <div className="flex flex-col h-full" data-testid="account-detail-dialog">
        <div className="px-4 py-3 border-b border-border flex-shrink-0 bg-card">
          {headerContent}
        </div>
        <div className="flex-1 overflow-y-auto px-4">
          {bodyContent}
        </div>
        <div className="flex-shrink-0 bg-card border-t border-border px-4 py-3">
          {footerContent}
        </div>
      </div>
    );
  }

  // ── Dialog mode (modal) ───────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        data-testid="account-detail-dialog"
      >
        <DialogHeader>
          <div className="pr-6">{headerContent}</div>
        </DialogHeader>

        <Separator className="my-1" />

        {bodyContent}

        <Separator className="mt-2" />
        <DialogFooter className="pt-2">
          {footerContent}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
