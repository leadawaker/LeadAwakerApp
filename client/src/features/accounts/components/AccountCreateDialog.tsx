// src/features/accounts/components/AccountCreateDialog.tsx
import React, { useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Phone,
  Globe,
  Clock,
  Loader2,
  Plus,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NewAccountForm {
  name: string;
  status: string;
  type: string;
  owner_email: string;
  phone: string;
  website: string;
  timezone: string;
  business_niche: string;
  notes: string;
}

interface AccountCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: NewAccountForm) => Promise<void>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ["Active", "Trial", "Inactive", "Suspended"];
const TYPE_OPTIONS = ["Agency", "Client"];
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

const DEFAULT_FORM: NewAccountForm = {
  name: "",
  status: "Active",
  type: "Client",
  owner_email: "",
  phone: "",
  website: "",
  timezone: "UTC",
  business_niche: "",
  notes: "",
};

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
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 items-start py-2 border-b border-border/40 last:border-0">
      <Label className="text-xs text-muted-foreground pt-2 leading-tight">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <div>{children}</div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AccountCreateDialog({
  open,
  onClose,
  onCreate,
}: AccountCreateDialogProps) {
  const [form, setForm] = useState<NewAccountForm>({ ...DEFAULT_FORM });
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");

  function handleChange(key: keyof NewAccountForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "name" && value.trim()) {
      setNameError("");
    }
  }

  function handleClose() {
    setForm({ ...DEFAULT_FORM });
    setNameError("");
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate required fields
    if (!form.name.trim()) {
      setNameError("Account name is required");
      return;
    }

    setSaving(true);
    try {
      await onCreate(form);
      setForm({ ...DEFAULT_FORM });
      setNameError("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        data-testid="account-create-dialog"
      >
        <DialogHeader>
          <div className="flex items-start gap-3 pr-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-semibold">
                Create New Account
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Fill in the details to add a new account
              </p>
            </div>
          </div>
        </DialogHeader>

        <Separator className="my-1" />

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-0 pb-2">
            {/* Basic Info */}
            <SectionHeader
              icon={<Building2 className="h-4 w-4" />}
              title="Basic Information"
            />

            <FieldRow label="Name" required>
              <div>
                <Input
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Account name"
                  className={`text-sm h-8 ${nameError ? "border-destructive" : ""}`}
                  data-testid="create-field-name"
                  autoFocus
                />
                {nameError && (
                  <p className="text-xs text-destructive mt-1">{nameError}</p>
                )}
              </div>
            </FieldRow>

            <FieldRow label="Status">
              <Select
                value={form.status}
                onValueChange={(v) => handleChange("status", v)}
              >
                <SelectTrigger
                  className="h-8 text-sm"
                  data-testid="create-field-status"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>

            <FieldRow label="Type">
              <Select
                value={form.type}
                onValueChange={(v) => handleChange("type", v)}
              >
                <SelectTrigger
                  className="h-8 text-sm"
                  data-testid="create-field-type"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>

            <FieldRow label="Business Niche">
              <Input
                value={form.business_niche}
                onChange={(e) => handleChange("business_niche", e.target.value)}
                placeholder="e.g. Construction, SaaS..."
                className="text-sm h-8"
                data-testid="create-field-business_niche"
              />
            </FieldRow>

            {/* Contact */}
            <SectionHeader
              icon={<Phone className="h-4 w-4" />}
              title="Contact"
            />

            <FieldRow label="Owner Email">
              <Input
                type="email"
                value={form.owner_email}
                onChange={(e) => handleChange("owner_email", e.target.value)}
                placeholder="owner@example.com"
                className="text-sm h-8"
                data-testid="create-field-owner_email"
              />
            </FieldRow>

            <FieldRow label="Phone">
              <Input
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="+1 555 000 0000"
                className="text-sm h-8"
                data-testid="create-field-phone"
              />
            </FieldRow>

            <FieldRow label="Website">
              <Input
                value={form.website}
                onChange={(e) => handleChange("website", e.target.value)}
                placeholder="https://..."
                className="text-sm h-8"
                data-testid="create-field-website"
              />
            </FieldRow>

            {/* Timezone */}
            <SectionHeader
              icon={<Clock className="h-4 w-4" />}
              title="Schedule & Timezone"
            />

            <FieldRow label="Timezone">
              <Select
                value={form.timezone}
                onValueChange={(v) => handleChange("timezone", v)}
              >
                <SelectTrigger
                  className="h-8 text-sm"
                  data-testid="create-field-timezone"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>

            {/* Notes */}
            <SectionHeader
              icon={<Globe className="h-4 w-4" />}
              title="Notes"
            />

            <FieldRow label="Notes">
              <Textarea
                value={form.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="Internal notes..."
                className="text-sm min-h-[80px] resize-none"
                data-testid="create-field-notes"
              />
            </FieldRow>
          </div>

          <Separator className="mt-2" />

          <DialogFooter className="flex items-center gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={saving}
              data-testid="btn-cancel-create"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              data-testid="btn-submit-create"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1.5" />
              )}
              Create Account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
