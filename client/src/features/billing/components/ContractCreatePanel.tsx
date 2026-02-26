import { useState, useCallback, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus, Copy, Check, RotateCcw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { fetchCampaigns, createCampaign } from "../../campaigns/api/campaignsApi";
import { generateContractText, type ContractFormFields } from "../utils/contractTemplate";

// ── Constants ──────────────────────────────────────────────────────────────────

const DEAL_TYPE_OPTIONS = [
  { value: "performance",      label: "Zero-risk / Performance", subLabel: "All costs on you. Paid on results only." },
  { value: "cost_passthrough", label: "Cost Passthrough",        subLabel: "Client pays campaign costs." },
  { value: "fixed_fee",        label: "Fixed Upfront Fee",       subLabel: "Client pays a fixed amount in advance." },
  { value: "deposit",          label: "Deposit + Return",        subLabel: "Deposit collected, returned on conditions." },
  { value: "monthly_retainer", label: "Monthly Retainer",        subLabel: "Fixed recurring charge per month." },
  { value: "hybrid",           label: "Hybrid / Mix",            subLabel: "Combination of the above." },
] as const;

const PAYMENT_TRIGGER_OPTIONS = [
  { value: "call_booked",  label: "Call Booked" },
  { value: "closed_sale",  label: "Closed Sale (by client's team)" },
] as const;

const CURRENCY_OPTIONS = ["EUR", "USD", "GBP", "BRL"] as const;

const END_DATE_PRESETS = [
  { label: "1 mo",  months: 1  },
  { label: "3 mo",  months: 3  },
  { label: "6 mo",  months: 6  },
  { label: "1 yr",  months: 12 },
  { label: "Custom", months: 0 },
] as const;

const CADENCE_OPTIONS = [
  { value: "weekly",   label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly",  label: "Monthly" },
] as const;

const PAYMENT_PRESETS = [
  { value: "EU", label: "EU — N26",      summary: "IBAN: DE35 1001 1001 2939 5454 81" },
  { value: "BR", label: "BR — Banco 380", summary: "Conta: 98927440-3" },
] as const;

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

function autoTitle(accountName: string): string {
  if (!accountName) return "";
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  return `${accountName} — Service Agreement ${month} ${now.getFullYear()}`;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface ContractCreatePanelProps {
  accounts: Array<{ id: number; name: string | null }>;
  isAgencyUser: boolean;
  onCreate: (payload: Record<string, any>) => Promise<any>;
  onClose: () => void;
  compact?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ContractCreatePanel({
  accounts,
  isAgencyUser,
  onCreate,
  onClose,
  compact,
}: ContractCreatePanelProps) {
  const { toast } = useToast();

  // ── Core fields ─────────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [accountId, setAccountId] = useState("");
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignId, setCampaignId] = useState("");
  const [signerName, setSignerName] = useState("");
  const [showNewCampaignForm, setShowNewCampaignForm] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  // ── Settings ─────────────────────────────────────────────────────────────
  const [language, setLanguage] = useState("en");
  const [timezone, setTimezone] = useState("Europe/Amsterdam");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(addMonths(todayISO(), 12));
  const [endDatePreset, setEndDatePreset] = useState<number | "custom">(12);

  // ── Deal structure ─────────────────────────────────────────────────────────
  const [dealType, setDealType] = useState("");
  const [paymentTrigger, setPaymentTrigger] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [valuePerBooking, setValuePerBooking] = useState("");
  const [fixedFeeAmount, setFixedFeeAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [monthlyFee, setMonthlyFee] = useState("");
  const [costPassthroughRate, setCostPassthroughRate] = useState("");

  // ── Payment & invoicing ───────────────────────────────────────────────────
  const [invoiceCadence, setInvoiceCadence] = useState("weekly");
  const [paymentPreset, setPaymentPreset] = useState("EU");

  // ── Contract text ─────────────────────────────────────────────────────────
  const [editedText, setEditedText] = useState("");
  const [isManuallyEdited, setIsManuallyEdited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Derived values ────────────────────────────────────────────────────────

  const selectedAccount = useMemo(
    () => accounts.find(a => String(a.id) === accountId),
    [accounts, accountId]
  );
  const accountName = selectedAccount?.name ?? "";

  const selectedCampaign = useMemo(
    () => campaigns.find(c => String(c.id) === campaignId),
    [campaigns, campaignId]
  );
  const campaignName = selectedCampaign?.name ?? "";

  // ── Effects ───────────────────────────────────────────────────────────────

  // Auto-fill title when account selected (only if title not yet set)
  useEffect(() => {
    if (accountName && !title) setTitle(autoTitle(accountName));
  }, [accountName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch campaigns when account changes
  useEffect(() => {
    if (!accountId) { setCampaigns([]); setCampaignId(""); return; }
    setCampaignsLoading(true);
    fetchCampaigns(Number(accountId))
      .then(setCampaigns)
      .catch(() => setCampaigns([]))
      .finally(() => setCampaignsLoading(false));
  }, [accountId]);

  // Build template fields
  const templateFields: ContractFormFields = useMemo(() => ({
    title, accountName, campaignName, startDate, endDate, timezone, language,
    dealType: dealType as any, paymentTrigger: paymentTrigger as any,
    valuePerBooking, currency, fixedFeeAmount, depositAmount, monthlyFee,
    costPassthroughRate, invoiceCadence, paymentPreset, signerName,
  }), [
    title, accountName, campaignName, startDate, endDate, timezone, language,
    dealType, paymentTrigger, valuePerBooking, currency, fixedFeeAmount,
    depositAmount, monthlyFee, costPassthroughRate, invoiceCadence, paymentPreset, signerName,
  ]);

  // Auto-generate contract text (only if not manually edited)
  useEffect(() => {
    if (!isManuallyEdited) {
      setEditedText(generateContractText(templateFields));
    }
  }, [templateFields, isManuallyEdited]);

  // ── Conditional field visibility ──────────────────────────────────────────
  const showCostPassthrough = dealType === "cost_passthrough" || dealType === "hybrid";
  const showFixedFee        = dealType === "fixed_fee"        || dealType === "hybrid";
  const showDeposit         = dealType === "deposit"          || dealType === "hybrid";
  const showMonthlyFee      = dealType === "monthly_retainer" || dealType === "hybrid";

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleEndDatePreset = (months: number) => {
    if (months === 0) {
      setEndDatePreset("custom");
      return;
    }
    setEndDatePreset(months);
    setEndDate(addMonths(startDate, months));
  };

  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) return;
    setCreatingCampaign(true);
    try {
      const result = await createCampaign({
        name: newCampaignName.trim(),
        Accounts_id: accountId ? Number(accountId) : null,
        status: "Draft",
      });
      const newCamp = { id: result.id ?? result.Id, name: newCampaignName.trim() };
      setCampaigns(prev => [...prev, newCamp]);
      setCampaignId(String(newCamp.id));
      setNewCampaignName("");
      setShowNewCampaignForm(false);
      toast({ title: "Campaign created", description: `"${newCamp.name}" has been created.` });
    } catch {
      toast({ title: "Failed to create campaign", variant: "destructive" });
    } finally {
      setCreatingCampaign(false);
    }
  };

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(editedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [editedText]);

  const handleReset = useCallback(() => {
    setIsManuallyEdited(false);
    setEditedText(generateContractText(templateFields));
  }, [templateFields]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await onCreate({
        title: title.trim(),
        Accounts_id: accountId ? Number(accountId) : null,
        start_date: startDate || null,
        end_date: endDate || null,
        status: "Draft",
        deal_type: dealType || null,
        payment_trigger: paymentTrigger || null,
        value_per_booking: valuePerBooking || null,
        fixed_fee_amount: fixedFeeAmount || null,
        deposit_amount: depositAmount || null,
        monthly_fee: monthlyFee || null,
        cost_passthrough_rate: costPassthroughRate || null,
        campaigns_id: campaignId ? Number(campaignId) : null,
        currency: currency || null,
        language: language || null,
        timezone: timezone || null,
        invoice_cadence: invoiceCadence || null,
        payment_preset: paymentPreset || null,
        contract_text: editedText || null,
        signer_name: signerName.trim() || null,
      });
      toast({ title: "Contract created", description: `"${title}" has been saved as Draft.` });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      toast({ title: "Failed to create contract", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [
    title, accountId, startDate, endDate, dealType, paymentTrigger, valuePerBooking,
    fixedFeeAmount, depositAmount, monthlyFee, costPassthroughRate, campaignId,
    currency, language, timezone, invoiceCadence, paymentPreset, editedText,
    signerName, onCreate, onClose, toast,
  ]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", compact && "")}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/30 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-foreground font-heading">Contract Builder</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Fields auto-fill the contract text on the right</p>
        </div>
        <button onClick={onClose} className="icon-circle-lg icon-circle-base">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Two-column body OR stacked if compact */}
      <div className={cn("flex-1 min-h-0 flex overflow-hidden", compact ? "flex-col" : "flex-row")}>

        {/* ── LEFT: Form column ── */}
        <div className={cn(
          "flex flex-col overflow-y-auto border-r border-border/20 bg-card",
          compact ? "flex-none" : "w-[380px] shrink-0"
        )}>
          <div className="px-4 py-4 space-y-4">

            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Title</Label>
              <Input
                placeholder="Service Agreement Q1 2026"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            {/* Account (agency only) */}
            {isAgencyUser && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Account</Label>
                <Select value={accountId || "__none__"} onValueChange={v => setAccountId(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No account</SelectItem>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name || `Account #${a.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Signer name */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Signer Name <span className="font-normal normal-case text-muted-foreground/50">(person signing)</span>
              </Label>
              <Input
                placeholder="e.g. John Smith"
                value={signerName}
                onChange={e => setSignerName(e.target.value)}
              />
            </div>

            {/* Campaign + inline create */}
            {isAgencyUser && accountId && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Campaign</Label>
                <div className="flex gap-1.5">
                  <Select value={campaignId || "__none__"} onValueChange={v => setCampaignId(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="flex-1" disabled={campaignsLoading}>
                      <SelectValue placeholder={campaignsLoading ? "Loading..." : "Select campaign"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {campaigns.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name || `Campaign #${c.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={() => setShowNewCampaignForm(v => !v)}
                    title="Create new campaign"
                    className="icon-circle-lg icon-circle-base shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {showNewCampaignForm && (
                  <div className="flex gap-1.5 mt-1">
                    <Input
                      placeholder="New campaign name"
                      value={newCampaignName}
                      onChange={e => setNewCampaignName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleCreateCampaign(); }}
                      className="flex-1 h-9 text-[12px]"
                    />
                    <Button
                      size="sm"
                      onClick={handleCreateCampaign}
                      disabled={creatingCampaign || !newCampaignName.trim()}
                      className="h-9 px-3 text-[12px] bg-brand-indigo text-white hover:bg-brand-indigo/90"
                    >
                      {creatingCampaign ? "..." : "Create"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Language + Timezone row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Language</Label>
                <div className="flex gap-1">
                  {(["en"] as const).map(lang => (
                    <button key={lang} type="button"
                      className={cn(
                        "h-9 px-3 rounded-lg text-[12px] font-medium border",
                        language === lang
                          ? "bg-[#F5DFB3] border-[#E3A857] text-foreground"
                          : "bg-card border-border text-muted-foreground"
                      )}
                      onClick={() => setLanguage(lang)}>
                      EN
                    </button>
                  ))}
                  {/* Future languages — grayed out */}
                  {["nl", "pt"].map(l => (
                    <button key={l} type="button" disabled
                      className="h-9 px-3 rounded-lg text-[12px] font-medium border border-border/40 text-muted-foreground/30 cursor-not-allowed">
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Timezone</Label>
                <Input
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  placeholder="Europe/Amsterdam"
                  className="text-[12px]"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={e => { setEndDate(e.target.value); setEndDatePreset("custom"); }}
                  />
                </div>
              </div>
              {/* End date quick presets */}
              <div className="flex gap-1 flex-wrap">
                {END_DATE_PRESETS.map(p => (
                  <button key={p.label} type="button"
                    onClick={() => handleEndDatePreset(p.months)}
                    className={cn(
                      "h-7 px-2.5 rounded-full text-[11px] font-medium border transition-colors",
                      endDatePreset === (p.months === 0 ? "custom" : p.months)
                        ? "bg-[#F5DFB3] border-[#E3A857] text-foreground"
                        : "bg-card border-border/60 text-muted-foreground hover:text-foreground"
                    )}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider: Deal Structure */}
            <div className="h-px bg-border/40" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 font-heading">Deal Structure</p>

            {/* Deal Type pills */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Deal Type</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {DEAL_TYPE_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setDealType(opt.value)}
                    className={cn(
                      "flex flex-col gap-0.5 px-2.5 py-2 text-left rounded-xl border transition-colors",
                      dealType === opt.value
                        ? "bg-[#FFE35B] border-yellow-400 border-2"
                        : "bg-card border-border hover:bg-muted/60"
                    )}>
                    <span className="text-[11px] font-semibold leading-tight">{opt.label}</span>
                    <span className="text-[9px] text-foreground/50 leading-snug">{opt.subLabel}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Value per Booking + Currency */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Value per Booking</Label>
              <div className="flex gap-1.5">
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-[80px] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={valuePerBooking}
                  onChange={e => setValuePerBooking(e.target.value)}
                  className="flex-1 tabular-nums"
                />
              </div>
            </div>

            {/* Payment Trigger */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payment Trigger</Label>
              <div className="flex gap-1.5 flex-wrap">
                {PAYMENT_TRIGGER_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setPaymentTrigger(opt.value)}
                    className={cn(
                      "h-9 px-3 rounded-full border text-[12px] font-medium transition-colors",
                      paymentTrigger === opt.value
                        ? "bg-[#FFE35B] border-yellow-400 border-2 text-foreground"
                        : "bg-card border-border text-foreground/70 hover:bg-muted/60"
                    )}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Conditional deal fields */}
            {(showCostPassthrough || showFixedFee || showDeposit || showMonthlyFee) && (
              <div className="grid grid-cols-2 gap-3">
                {showCostPassthrough && (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cost Passthrough %</Label>
                    <div className="relative">
                      <Input
                        type="number" min={0} max={100} step={0.01} placeholder="0"
                        value={costPassthroughRate}
                        onChange={e => setCostPassthroughRate(e.target.value)}
                        className="pr-7 tabular-nums"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground pointer-events-none">%</span>
                    </div>
                  </div>
                )}
                {showFixedFee && (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fixed Fee</Label>
                    <Input
                      type="number" min={0} step={0.01} placeholder="0.00"
                      value={fixedFeeAmount}
                      onChange={e => setFixedFeeAmount(e.target.value)}
                      className="tabular-nums"
                    />
                  </div>
                )}
                {showDeposit && (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Deposit</Label>
                    <Input
                      type="number" min={0} step={0.01} placeholder="0.00"
                      value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                      className="tabular-nums"
                    />
                  </div>
                )}
                {showMonthlyFee && (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Monthly Fee</Label>
                    <Input
                      type="number" min={0} step={0.01} placeholder="0.00"
                      value={monthlyFee}
                      onChange={e => setMonthlyFee(e.target.value)}
                      className="tabular-nums"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Divider: Invoicing & Payment */}
            <div className="h-px bg-border/40" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 font-heading">Invoicing & Payment</p>

            {/* Invoice Cadence */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Invoice Cadence</Label>
              <div className="flex gap-1.5">
                {CADENCE_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setInvoiceCadence(opt.value)}
                    className={cn(
                      "h-9 px-3 rounded-full border text-[12px] font-medium transition-colors",
                      invoiceCadence === opt.value
                        ? "bg-[#F5DFB3] border-[#E3A857] text-foreground"
                        : "bg-card border-border text-foreground/70 hover:bg-muted/60"
                    )}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Preset */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payment Account</Label>
              <div className="flex gap-1.5">
                {PAYMENT_PRESETS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setPaymentPreset(opt.value)}
                    className={cn(
                      "flex-1 flex flex-col gap-0.5 px-3 py-2 rounded-xl border text-left transition-colors",
                      paymentPreset === opt.value
                        ? "bg-[#F5DFB3] border-[#E3A857] text-foreground"
                        : "bg-card border-border text-foreground/70 hover:bg-muted/60"
                    )}>
                    <span className="text-[12px] font-semibold">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{opt.summary}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Footer inside left column */}
          <div className="mt-auto px-4 py-3 border-t border-border/30 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-sm text-muted-foreground hover:text-foreground font-medium"
            >
              Cancel
            </button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !title.trim()}
              className="bg-brand-indigo text-white hover:bg-brand-indigo/90 h-9 px-5 text-sm"
            >
              {saving ? "Creating..." : "Create Contract"}
            </Button>
          </div>
        </div>

        {/* ── RIGHT: Contract text column ── */}
        <div className={cn("flex flex-col bg-muted/30", compact ? "flex-none h-[340px]" : "flex-1 min-w-0")}>

          {/* Right header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/20 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/40 font-heading">Contract Text</span>
              {isManuallyEdited && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-semibold">
                  <AlertCircle className="h-3 w-3" />
                  Manually edited
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {isManuallyEdited && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-card border border-border/40 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-card border border-border/40 transition-colors"
              >
                {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Contract textarea */}
          <textarea
            className="flex-1 min-h-0 w-full resize-none bg-transparent font-mono text-[11px] leading-relaxed text-foreground/80 p-4 outline-none"
            value={editedText}
            onChange={e => {
              setEditedText(e.target.value);
              setIsManuallyEdited(e.target.value !== generateContractText(templateFields));
            }}
            spellCheck={false}
          />

          {/* Character count */}
          <div className="px-4 py-1.5 border-t border-border/20 shrink-0">
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">
              {editedText.length.toLocaleString()} characters
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
