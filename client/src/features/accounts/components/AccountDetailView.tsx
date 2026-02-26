import { useState, useCallback, useEffect, useRef } from "react";
import {
  Building2, Phone, Bot, Globe, Clock, FileText, Ban,
  Eye, EyeOff, Copy, Check,
  Plus, Trash2, FileDown,
  Pencil, X, RefreshCw, Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";
import type { AccountRow } from "./AccountDetailsDialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ── Status helpers ─────────────────────────────────────────────────────────────

function getStatusDotCls(status: string): string {
  switch (status) {
    case "Active":    return "bg-emerald-500";
    case "Trial":     return "bg-amber-500";
    case "Suspended": return "bg-rose-500";
    case "Inactive":  return "bg-slate-400";
    default:          return "bg-indigo-400";
  }
}

function getStatusBadgeStyle(status: string): { bg: string; text: string } {
  switch (status) {
    case "Active":    return { bg: "#D1FAE5", text: "#065F46" };
    case "Trial":     return { bg: "#FEF3C7", text: "#92400E" };
    case "Suspended": return { bg: "#FFE4E6", text: "#9F1239" };
    case "Inactive":  return { bg: "#F4F4F5", text: "#52525B" };
    default:          return { bg: "#E5E7EB", text: "#374151" };
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "Trial":     return <Clock className="w-3 h-3" />;
    case "Suspended": return <Ban className="w-3 h-3" />;
    default:          return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimeDisplay(val: string | null | undefined): string {
  if (!val) return "";
  const parts = val.split(":");
  if (parts.length < 2) return val;
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return val;
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(h).padStart(2, "0")}:${minutes} ${ampm}`;
}

function parseServiceCategories(val: string | null | undefined): string[] {
  if (!val) return [];
  const trimmed = val.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((s: unknown) => String(s).trim()).filter(Boolean);
    } catch { /* fall through */ }
  }
  return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
}

// ── Logo Crop Modal ────────────────────────────────────────────────────────────

function LogoCropModal({ srcUrl, onSave, onCancel }: {
  srcUrl: string;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const PREVIEW = 240;
  const OUTPUT  = 128;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom]     = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging  = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  useEffect(() => {
    const img = new globalThis.Image();
    img.onload = () => {
      imgRef.current = img;
      setZoom(Math.min(PREVIEW / img.width, PREVIEW / img.height));
      setOffset({ x: 0, y: 0 });
    };
    img.src = srcUrl;
  }, [srcUrl]);

  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, PREVIEW, PREVIEW);
    const w = img.width * zoom;
    const h = img.height * zoom;
    ctx.drawImage(img, (PREVIEW - w) / 2 + offset.x, (PREVIEW - h) / 2 + offset.y, w, h);
  }, [zoom, offset]);

  const handleSave = () => {
    const img = imgRef.current;
    if (!img) return;
    const out = document.createElement("canvas");
    out.width = OUTPUT; out.height = OUTPUT;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    const f = OUTPUT / PREVIEW;
    const w = img.width * zoom * f;
    const h = img.height * zoom * f;
    ctx.drawImage(img, (OUTPUT - w) / 2 + offset.x * f, (OUTPUT - h) / 2 + offset.y * f, w, h);
    onSave(out.toDataURL("image/jpeg", 0.85));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setOffset({ x: dragStart.current.ox + e.clientX - dragStart.current.x, y: dragStart.current.oy + e.clientY - dragStart.current.y });
  };
  const onMouseUp = () => { dragging.current = false; };

  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Crop Logo</DialogTitle>
          <DialogDescription>Drag to reposition · use slider to zoom</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-full overflow-hidden ring-2 ring-brand-blue/20" style={{ width: PREVIEW, height: PREVIEW }}>
            <canvas
              ref={canvasRef}
              width={PREVIEW}
              height={PREVIEW}
              className="cursor-grab active:cursor-grabbing"
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            />
          </div>
          <div className="flex items-center gap-3 w-full px-2">
            <button type="button" onClick={() => setZoom((z) => Math.max(0.05, parseFloat((z - 0.1).toFixed(2))))}
              className="h-6 w-6 rounded-full flex items-center justify-center text-[14px] font-bold text-muted-foreground hover:bg-muted transition-colors select-none shrink-0">−</button>
            <input type="range" min="0.05" max="8" step="0.05" value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-brand-blue" />
            <button type="button" onClick={() => setZoom((z) => Math.min(8, parseFloat((z + 0.1).toFixed(2))))}
              className="h-6 w-6 rounded-full flex items-center justify-center text-[14px] font-bold text-muted-foreground hover:bg-muted transition-colors select-none shrink-0">+</button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSave}>Save Logo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Field display components ───────────────────────────────────────────────────

/** Label above value, with a subtle divider below. Value is below the label. */
function InfoRow({ label, value, editChild }: {
  label: string;
  value?: React.ReactNode;
  editChild?: React.ReactNode;
}) {
  return (
    <div className="py-2.5 border-b border-border/20 last:border-0 last:pb-0">
      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block leading-none mb-1">
        {label}
      </span>
      <div className="min-h-[1.125rem]">
        {editChild ?? (
          <span className="text-[12px] font-semibold text-foreground leading-snug">
            {value ?? <span className="text-foreground/25 font-normal italic">—</span>}
          </span>
        )}
      </div>
    </div>
  );
}

/** Sub-section header within a widget column */
function SectionHeader({ label, icon: Icon }: { label: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-1.5 pt-3 mt-1 mb-1 border-t border-white/30">
      {Icon && <Icon className="w-3 h-3 text-foreground/40" />}
      <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{label}</span>
    </div>
  );
}

// ── Edit input helpers ─────────────────────────────────────────────────────────

function EditText({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-[12px] bg-white/60 border border-brand-blue/30 rounded-lg px-2.5 py-1 outline-none focus:ring-1 focus:ring-brand-blue/40 placeholder:text-foreground/25"
    />
  );
}

function EditSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-[12px] bg-white/60 border border-brand-blue/30 rounded-lg px-2.5 py-1 outline-none focus:ring-1 focus:ring-brand-blue/40"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function EditTextarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full text-[12px] bg-white/60 border border-brand-blue/30 rounded-lg px-2.5 py-1 resize-none outline-none focus:ring-1 focus:ring-brand-blue/40 placeholder:text-foreground/25 leading-relaxed"
    />
  );
}

// ── Twilio display helpers (read-only mode) ────────────────────────────────────

function MonoValue({ value }: { value?: string | null }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);
  if (!value) return <span className="text-foreground/25 font-normal italic text-[12px]">—</span>;
  return (
    <span className="flex items-center gap-0.5 min-w-0">
      <span className="text-[11px] font-mono text-foreground truncate">{value}</span>
      <button onClick={copy} className="p-0.5 rounded hover:bg-white/30 transition-colors text-foreground/40 hover:text-foreground shrink-0">
        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}

function SecretDisplay({ value }: { value?: string | null }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);
  if (!value) return <span className="text-foreground/25 font-normal italic text-[12px]">—</span>;
  return (
    <span className="flex items-center gap-0.5 min-w-0">
      <span className={cn("text-[11px] font-mono text-foreground truncate", !revealed && "tracking-widest")}>
        {revealed ? value : "••••••••••••"}
      </span>
      <button onClick={() => setRevealed((r) => !r)} className="p-0.5 rounded hover:bg-white/30 transition-colors text-foreground/40 hover:text-foreground shrink-0">
        {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
      <button onClick={copy} className="p-0.5 rounded hover:bg-white/30 transition-colors text-foreground/40 hover:text-foreground shrink-0">
        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}

// ── AccountCampaignsPanel ──────────────────────────────────────────────────────

function AccountCampaignsPanel({ accountId }: { accountId: number }) {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loadingC, setLoadingC] = useState(true);
  const [loadingK, setLoadingK] = useState(true);

  // Picker state
  const [pickerOpen, setPickerOpen]       = useState(false);
  const [allCampaigns, setAllCampaigns]   = useState<any[]>([]);
  const [pickerSearch, setPickerSearch]   = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [linking, setLinking]             = useState<number | null>(null);

  const refreshCampaigns = useCallback(() => {
    if (!accountId) return;
    setLoadingC(true);
    apiFetch(`/api/campaigns?accountId=${accountId}`)
      .then((res) => res.json())
      .then((data: any) => {
        const list = Array.isArray(data) ? data : (data?.list ?? data?.data ?? []);
        setCampaigns(list);
      })
      .catch(() => setCampaigns([]))
      .finally(() => setLoadingC(false));
  }, [accountId]);

  useEffect(() => { refreshCampaigns(); }, [refreshCampaigns]);

  useEffect(() => {
    if (!accountId) return;
    setLoadingK(true);
    apiFetch(`/api/contracts?accountId=${accountId}`)
      .then((res) => res.json())
      .then((data: any) => {
        const list = Array.isArray(data) ? data : (data?.list ?? data?.data ?? []);
        setContracts(list);
      })
      .catch(() => setContracts([]))
      .finally(() => setLoadingK(false));
  }, [accountId]);

  const openPicker = useCallback(async () => {
    setPickerOpen(true);
    setPickerSearch("");
    setPickerLoading(true);
    try {
      const res  = await apiFetch("/api/campaigns");
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.list ?? data?.data ?? []);
      setAllCampaigns(list);
    } catch {
      setAllCampaigns([]);
    } finally {
      setPickerLoading(false);
    }
  }, []);

  const handleLink = useCallback(async (campaign: any) => {
    const cid = campaign.id ?? campaign.Id;
    if (!cid) return;
    setLinking(cid);
    try {
      await apiFetch(`/api/campaigns/${cid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Accounts_id: accountId }),
      });
      setPickerOpen(false);
      refreshCampaigns();
    } catch (e) {
      console.error("Failed to link campaign", e);
    } finally {
      setLinking(null);
    }
  }, [accountId, refreshCampaigns]);

  const alreadyLinkedIds = new Set(campaigns.map((c: any) => c.id ?? c.Id));
  const pickerFiltered = allCampaigns
    .filter((c: any) => !alreadyLinkedIds.has(c.id ?? c.Id))
    .filter((c: any) => {
      if (!pickerSearch.trim()) return true;
      const name = c.name ?? c.campaign_name ?? c.Name ?? "";
      return name.toLowerCase().includes(pickerSearch.toLowerCase());
    });

  return (
    <div className="space-y-4">

      {/* Campaign picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Campaign</DialogTitle>
            <DialogDescription>Pick a campaign to assign to this account.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Search campaigns…"
              className="w-full text-[12px] bg-white border border-border/40 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-brand-indigo/40"
            />
            <div className="max-h-60 overflow-y-auto">
              {pickerLoading ? (
                <div className="space-y-1.5 py-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}
                </div>
              ) : pickerFiltered.length === 0 ? (
                <p className="text-[12px] text-foreground/40 italic py-6 text-center">No campaigns available</p>
              ) : (
                <div className="space-y-0.5">
                  {pickerFiltered.map((c: any) => {
                    const cid    = c.id ?? c.Id;
                    const name   = c.name ?? c.campaign_name ?? c.Name ?? "Unnamed";
                    const status = c.status ?? c.Status ?? "";
                    return (
                      <button
                        key={cid}
                        onClick={() => handleLink(c)}
                        disabled={linking === cid}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left hover:bg-muted/60 transition-colors disabled:opacity-50"
                      >
                        <span className="text-[12px] text-foreground font-medium truncate flex-1">{name}</span>
                        {status && (
                          <span className="text-[10px] text-foreground/50 shrink-0 bg-black/[0.05] rounded-full px-1.5 py-0.5">{status}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaigns sub-section */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Campaigns</span>
          {!loadingC && (
            <span className="text-[10px] font-semibold text-foreground/40 bg-black/[0.05] rounded-full px-1.5 py-0.5">{campaigns.length}</span>
          )}
          <button
            onClick={openPicker}
            title="Add campaign"
            className="ml-auto h-5 w-5 rounded-full flex items-center justify-center bg-black/[0.06] hover:bg-brand-indigo hover:text-white text-foreground/50 transition-colors"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        {loadingC ? (
          <div className="space-y-1.5">
            {[1, 2, 3].map((i) => <div key={i} className="h-6 rounded bg-black/[0.05] animate-pulse" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <p className="text-[11px] text-foreground/30 italic">No campaigns</p>
        ) : (
          <ul className="space-y-0">
            {campaigns.map((c: any, i: number) => {
              const name   = c.name ?? c.campaign_name ?? c.Name ?? "Unnamed";
              const status = c.status ?? c.Status ?? "";
              return (
                <li key={c.Id ?? c.id ?? i} className="flex items-center justify-between gap-2 py-2 border-b border-border/15 last:border-0">
                  <span className="text-[12px] text-foreground truncate flex-1">{name}</span>
                  {status && (
                    <span className="text-[10px] font-medium text-foreground/50 shrink-0 bg-black/[0.05] rounded-full px-1.5 py-0.5">{status}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Contracts sub-section */}
      <div className="border-t border-white/30 pt-3">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Contracts</span>
          {!loadingK && (
            <span className="text-[10px] font-semibold text-foreground/40 bg-black/[0.05] rounded-full px-1.5 py-0.5">{contracts.length}</span>
          )}
        </div>
        {loadingK ? (
          <div className="space-y-1.5">
            {[1, 2].map((i) => <div key={i} className="h-6 rounded bg-black/[0.05] animate-pulse" />)}
          </div>
        ) : contracts.length === 0 ? (
          <p className="text-[11px] text-foreground/30 italic">No contracts</p>
        ) : (
          <ul className="space-y-0">
            {contracts.map((k: any, i: number) => {
              const name   = k.title ?? k.name ?? k.Name ?? "Unnamed";
              const status = k.status ?? k.Status ?? "";
              return (
                <li key={k.Id ?? k.id ?? i} className="flex items-center justify-between gap-2 py-2 border-b border-border/15 last:border-0">
                  <span className="text-[12px] text-foreground truncate flex-1">{name}</span>
                  {status && (
                    <span className="text-[10px] font-medium text-foreground/50 shrink-0 bg-black/[0.05] rounded-full px-1.5 py-0.5">{status}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── AccountUsersPanel ──────────────────────────────────────────────────────────

function AccountUsersPanel({ accountId }: { accountId: number }) {
  const [users, setUsers]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Picker state
  const [pickerOpen, setPickerOpen]       = useState(false);
  const [allUsers, setAllUsers]           = useState<any[]>([]);
  const [pickerSearch, setPickerSearch]   = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [assigning, setAssigning]         = useState<number | null>(null);

  const refreshUsers = useCallback(() => {
    if (!accountId) return;
    setLoading(true);
    apiFetch("/api/users")
      .then((res) => res.json())
      .then((data: any) => {
        const all: any[] = Array.isArray(data) ? data : (data?.list ?? data?.data ?? []);
        setUsers(all.filter((u: any) => {
          const uid = u.Accounts_id ?? u.accounts_id ?? u.account_id;
          return uid === accountId;
        }));
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [accountId]);

  useEffect(() => { refreshUsers(); }, [refreshUsers]);

  const openPicker = useCallback(async () => {
    setPickerOpen(true);
    setPickerSearch("");
    setPickerLoading(true);
    try {
      const res  = await apiFetch("/api/users");
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.list ?? data?.data ?? []);
      setAllUsers(list);
    } catch {
      setAllUsers([]);
    } finally {
      setPickerLoading(false);
    }
  }, []);

  const handleAssign = useCallback(async (user: any) => {
    const uid = user.id ?? user.Id;
    if (!uid) return;
    setAssigning(uid);
    try {
      await apiFetch(`/api/users/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Accounts_id: accountId }),
      });
      setPickerOpen(false);
      refreshUsers();
    } catch (e) {
      console.error("Failed to assign user", e);
    } finally {
      setAssigning(null);
    }
  }, [accountId, refreshUsers]);

  const alreadyAssignedIds = new Set(users.map((u: any) => u.id ?? u.Id));
  const pickerFiltered = allUsers
    .filter((u: any) => !alreadyAssignedIds.has(u.id ?? u.Id))
    .filter((u: any) => {
      if (!pickerSearch.trim()) return true;
      const name = u.full_name ?? u.name ?? u.email ?? "";
      return name.toLowerCase().includes(pickerSearch.toLowerCase());
    });

  return (
    <div>

      {/* User picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Pick a user to assign to this account.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Search users…"
              className="w-full text-[12px] bg-white border border-border/40 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-brand-indigo/40"
            />
            <div className="max-h-60 overflow-y-auto">
              {pickerLoading ? (
                <div className="space-y-1.5 py-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}
                </div>
              ) : pickerFiltered.length === 0 ? (
                <p className="text-[12px] text-foreground/40 italic py-6 text-center">No users available</p>
              ) : (
                <div className="space-y-0.5">
                  {pickerFiltered.map((u: any) => {
                    const uid   = u.id ?? u.Id;
                    const name  = u.full_name ?? u.name ?? u.email ?? "Unknown";
                    const email = u.email ?? "";
                    const role  = u.role ?? u.Role ?? "";
                    return (
                      <button
                        key={uid}
                        onClick={() => handleAssign(u)}
                        disabled={assigning === uid}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left hover:bg-muted/60 transition-colors disabled:opacity-50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-foreground font-medium truncate">{name}</p>
                          {email && name !== email && (
                            <p className="text-[10px] text-foreground/40 truncate">{email}</p>
                          )}
                        </div>
                        {role && (
                          <span className="text-[10px] text-foreground/50 shrink-0 bg-black/[0.05] rounded-full px-1.5 py-0.5">{role}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Members header */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Members</span>
        {!loading && (
          <span className="text-[10px] font-semibold text-foreground/40 bg-black/[0.05] rounded-full px-1.5 py-0.5">{users.length}</span>
        )}
        <button
          onClick={openPicker}
          title="Add user"
          className="ml-auto h-5 w-5 rounded-full flex items-center justify-center bg-black/[0.06] hover:bg-brand-indigo hover:text-white text-foreground/50 transition-colors"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Users list */}
      {loading ? (
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => <div key={i} className="h-6 rounded bg-black/[0.05] animate-pulse" />)}
        </div>
      ) : users.length === 0 ? (
        <p className="text-[11px] text-foreground/30 italic">No users assigned</p>
      ) : (
        <ul className="space-y-0">
          {users.map((u: any, i: number) => {
            const name  = u.full_name ?? u.name ?? u.email ?? u.username ?? "Unknown";
            const email = u.email ?? "";
            const role  = u.role ?? u.Role ?? "";
            return (
              <li key={u.id ?? u.Id ?? i} className="flex items-center justify-between gap-2 py-2 border-b border-border/15 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-foreground truncate">{name}</p>
                  {email && name !== email && (
                    <p className="text-[10px] text-foreground/40 truncate">{email}</p>
                  )}
                </div>
                {role && (
                  <span className="text-[10px] font-medium text-foreground/50 shrink-0 bg-black/[0.05] rounded-full px-1.5 py-0.5">{role}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

export function AccountDetailViewEmpty() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-stone-50 to-gray-100 flex items-center justify-center ring-1 ring-stone-200/50">
        <Building2 className="h-10 w-10 text-stone-400" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground/70">Select an account</p>
        <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">
          Click any account on the left to see its details and configuration.
        </p>
      </div>
      <div className="text-[11px] text-stone-400 font-medium">&larr; Choose from the list</div>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS   = ["Active", "Trial", "Inactive", "Suspended"];
const TYPE_OPTIONS     = ["Agency", "Client"];
const TIMEZONE_OPTIONS = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Phoenix", "America/Anchorage", "Pacific/Honolulu",
];

// ── Draft type ────────────────────────────────────────────────────────────────

type AccountDraft = {
  name: string; status: string; type: string; business_niche: string;
  owner_email: string; phone: string; website: string; address: string; tax_id: string;
  business_description: string; notes: string; service_categories: string;
  default_ai_name: string; default_ai_role: string; default_ai_style: string;
  default_typo_frequency: string; opt_out_keyword: string; preferred_terminology: string;
  timezone: string; business_hours_start: string; business_hours_end: string; max_daily_sends: string;
  twilio_account_sid: string; twilio_auth_token: string; twilio_messaging_service_sid: string;
  twilio_default_from_number: string; webhook_url: string; logo_url: string;
};

// ── Main Component ─────────────────────────────────────────────────────────────

interface AccountDetailViewProps {
  account: AccountRow;
  onSave: (field: string, value: string) => Promise<void>;
  onAddAccount: () => void;
  onDelete: () => void;
  onToggleStatus: (account: AccountRow) => void;
}

export function AccountDetailView({ account, onSave, onAddAccount, onDelete }: AccountDetailViewProps) {
  const status     = String(account.status || "Unknown");
  const badgeStyle = getStatusBadgeStyle(status);
  const accountId  = account.Id ?? account.id ?? 0;

  // ── Edit state ──────────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [draft,     setDraft]     = useState<AccountDraft>({} as AccountDraft);
  const [saving,    setSaving]    = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc,    setCropSrc]    = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [leadCount, setLeadCount] = useState<number | null>(null);

  useEffect(() => {
    const id = (account as any).Id ?? (account as any).id;
    if (!id) return;
    setLeadCount(null);
    apiFetch(`/api/leads?accountId=${id}&page=1&limit=1`)
      .then((data: any) => {
        const total = data?.total ?? data?.pagination?.total ?? null;
        setLeadCount(typeof total === "number" ? total : null);
      })
      .catch(() => setLeadCount(null));
  }, [(account as any).Id ?? (account as any).id]);

  // ── Edit handlers ───────────────────────────────────────────────────────────
  const startEdit = useCallback(() => {
    setDraft({
      name:                       String(account.name                    || ""),
      status:                     String(account.status                  || ""),
      type:                       String(account.type                    || ""),
      business_niche:             String(account.business_niche          || ""),
      owner_email:                String(account.owner_email             || ""),
      phone:                      String(account.phone                   || ""),
      website:                    String(account.website                 || ""),
      address:                    String(account.address                 || ""),
      tax_id:                     String(account.tax_id                  || ""),
      business_description:       String(account.business_description    || ""),
      notes:                      String(account.notes                   || ""),
      service_categories:         String(account.service_categories      || ""),
      default_ai_name:            String(account.default_ai_name         || ""),
      default_ai_role:            String(account.default_ai_role         || ""),
      default_ai_style:           String(account.default_ai_style        || ""),
      default_typo_frequency:     String(account.default_typo_frequency  || ""),
      opt_out_keyword:            String(account.opt_out_keyword         || ""),
      preferred_terminology:      String(account.preferred_terminology   || ""),
      timezone:                   String(account.timezone                || "UTC"),
      business_hours_start:       String(account.business_hours_start    || ""),
      business_hours_end:         String(account.business_hours_end      || ""),
      max_daily_sends:            account.max_daily_sends != null ? String(account.max_daily_sends) : "",
      twilio_account_sid:         String(account.twilio_account_sid           || ""),
      twilio_auth_token:          String(account.twilio_auth_token            || ""),
      twilio_messaging_service_sid: String(account.twilio_messaging_service_sid || ""),
      twilio_default_from_number: String(account.twilio_default_from_number   || ""),
      webhook_url:                String(account.webhook_url                  || ""),
      logo_url:                   String(account.logo_url                     || ""),
    });
    setIsEditing(true);
  }, [account]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setDraft({} as AccountDraft);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      for (const [field, value] of Object.entries(draft) as [keyof AccountDraft, string][]) {
        const current = String((account as any)[field] ?? "");
        if (value !== current) {
          await onSave(field, value);
        }
      }
      setIsEditing(false);
      setDraft({} as AccountDraft);
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setSaving(false);
    }
  }, [draft, account, onSave]);

  const set = useCallback((field: keyof AccountDraft, value: string) => {
    setDraft((d) => ({ ...d, [field]: value }));
  }, []);

  // Helper: get current value (draft when editing, account otherwise)
  const val = useCallback((field: keyof AccountDraft): string => {
    if (isEditing) return draft[field] ?? "";
    return String((account as any)[field] ?? "");
  }, [isEditing, draft, account]);

  const handleDelete = useCallback(() => {
    if (deleteConfirm) { onDelete(); setDeleteConfirm(false); }
    else { setDeleteConfirm(true); setTimeout(() => setDeleteConfirm(false), 3000); }
  }, [deleteConfirm, onDelete]);

  const handlePDF = useCallback(() => { window.print(); }, []);

  const handleLogoFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (logoInputRef.current) logoInputRef.current.value = "";
    setCropSrc(URL.createObjectURL(file));
  }, []);

  const handleCropSave = useCallback(async (dataUrl: string) => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    await onSave("logo_url", dataUrl);
  }, [cropSrc, onSave]);

  const handleCropCancel = useCallback(() => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }, [cropSrc]);

  const handleRemoveLogo = useCallback(async () => {
    await onSave("logo_url", "");
  }, [onSave]);

  const initials = (account.name || "?")
    .split(" ").slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? "")
    .join("");

  const serviceCategories = parseServiceCategories(account.service_categories);

  // Display status badge uses live account status (not draft — badge updates after save)
  const displayStatus     = isEditing ? (draft.status || status) : status;
  const displayBadgeStyle = getStatusBadgeStyle(displayStatus);

  return (
    <div className="relative flex flex-col h-full overflow-hidden" data-testid="account-detail-view">

      {/* ── Full-height warm gradient ── */}
      <div className="absolute inset-0 bg-[#F8F3EB]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_72%_56%_at_100%_0%,#FFFFFF_0%,rgba(255,255,255,0.80)_30%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_95%_80%_at_0%_0%,#FFF286_0%,rgba(255,242,134,0.60)_40%,rgba(255,242,134,0.25)_64%,transparent_80%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_62%_72%_at_100%_36%,rgba(241,218,162,0.62)_0%,transparent_64%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_92%_36%_at_48%_53%,rgba(210,188,130,0.22)_0%,transparent_72%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_98%_74%_at_50%_88%,rgba(105,170,255,0.60)_0%,transparent_74%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_54%_at_54%_60%,rgba(165,205,255,0.38)_0%,transparent_66%)]" />

      {/* ── Header ── */}
      <div className="shrink-0">
        <div className="relative px-4 pt-6 pb-10 space-y-3">

          {/* Row 1: Toolbar */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={onAddAccount}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-muted/50 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>

            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium bg-brand-blue text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-muted/50 transition-colors"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-muted/50 transition-colors"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            )}

            <button
              onClick={handlePDF}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-muted/50 transition-colors"
            >
              <FileDown className="h-3 w-3" />
              PDF
            </button>
            <button
              onClick={handleDelete}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border transition-colors",
                deleteConfirm
                  ? "border-red-400/60 text-red-600 bg-red-50/50 hover:bg-red-50/70"
                  : "border-border/60 bg-transparent text-foreground hover:bg-muted/50"
              )}
            >
              <Trash2 className="h-3 w-3" />
              {deleteConfirm ? "Confirm?" : "Delete"}
            </button>
          </div>

          {/* Row 2: Avatar + Name + badges */}
          <div className="flex items-start gap-3">
            {/* Logo circle — click to upload */}
            <div className="relative group shrink-0">
              <div
                className="h-[72px] w-[72px] rounded-full flex items-center justify-center text-xl font-bold overflow-hidden cursor-pointer"
                style={account.logo_url ? {} : { backgroundColor: displayBadgeStyle.bg, color: displayBadgeStyle.text }}
                onClick={() => logoInputRef.current?.click()}
                title="Click to upload logo"
              >
                {account.logo_url ? (
                  <img src={account.logo_url} alt="logo" className="h-full w-full object-cover" />
                ) : (
                  initials || <Building2 className="w-6 h-6" />
                )}
              </div>
              {/* Hover overlay */}
              <div
                className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer pointer-events-none"
              >
                <Camera className="w-5 h-5 text-white" />
              </div>
              {/* Remove button — hover-only, top-right */}
              {account.logo_url && !cropSrc && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveLogo(); }}
                  title="Remove logo"
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-white border border-border/50 flex items-center justify-center text-foreground/50 hover:text-red-500 hover:border-red-300 transition-colors z-10 opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoFile}
            />

            <div className="flex-1 min-w-0 py-1">
              {isEditing ? (
                <input
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  className="text-[27px] font-semibold font-heading bg-transparent border-b-2 border-brand-blue outline-none w-full leading-tight"
                  placeholder="Account name"
                  data-testid="account-detail-name-input"
                />
              ) : (
                <h2
                  className="text-[27px] font-semibold font-heading text-foreground leading-tight truncate"
                  data-testid="account-detail-name"
                >
                  {account.name || "Unnamed Account"}
                </h2>
              )}

              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: displayBadgeStyle.bg, color: displayBadgeStyle.text }}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", getStatusDotCls(displayStatus))} />
                  {getStatusIcon(displayStatus)}
                  {displayStatus}
                </span>
                {leadCount !== null && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-black/[0.06] text-foreground/55">
                    {leadCount} {leadCount === 1 ? "lead" : "leads"}
                  </span>
                )}
                {(isEditing ? draft.type : account.type) && (
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border",
                    (isEditing ? draft.type : account.type) === "Agency"
                      ? "bg-brand-blue/[0.08] border-brand-blue/20 text-brand-blue"
                      : "border-border/50 text-foreground/60"
                  )}>
                    {isEditing ? draft.type : account.type}
                  </span>
                )}
                {account.business_niche && !isEditing && (
                  <span className="text-[11px] text-foreground/50 truncate">{account.business_niche}</span>
                )}
                <span className="text-[11px] text-foreground/40">#{accountId}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Body: scrollable ── */}
      <div className="relative flex-1 overflow-y-auto min-h-0 p-[3px] flex flex-col gap-[3px]">

        {/* Top row: Overview | Campaigns & Contracts | Users */}
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>

          {/* Column 1: Overview */}
          <div className="overflow-y-auto rounded-xl" style={{ height: "48vh" }}>
            <div className="bg-white/60 rounded-xl p-4 flex flex-col min-h-full" data-testid="account-widget-basic">
              <p className="text-[17px] font-semibold font-heading text-foreground mb-3">Overview</p>

              <InfoRow
                label="Status"
                value={val("status")}
                editChild={isEditing ? <EditSelect value={val("status")} onChange={(v) => set("status", v)} options={STATUS_OPTIONS} /> : undefined}
              />
              <InfoRow
                label="Type"
                value={val("type")}
                editChild={isEditing ? <EditSelect value={val("type")} onChange={(v) => set("type", v)} options={TYPE_OPTIONS} /> : undefined}
              />
              <InfoRow
                label="Niche"
                value={val("business_niche")}
                editChild={isEditing ? <EditText value={val("business_niche")} onChange={(v) => set("business_niche", v)} placeholder="e.g. Real Estate" /> : undefined}
              />

              <SectionHeader label="Contact" icon={Phone} />

              <InfoRow
                label="Email"
                value={val("owner_email")}
                editChild={isEditing ? <EditText value={val("owner_email")} onChange={(v) => set("owner_email", v)} type="email" placeholder="owner@example.com" /> : undefined}
              />
              <InfoRow
                label="Phone"
                value={val("phone")}
                editChild={isEditing ? <EditText value={val("phone")} onChange={(v) => set("phone", v)} type="tel" placeholder="+1 555 000 0000" /> : undefined}
              />
              <InfoRow
                label="Website"
                value={val("website")}
                editChild={isEditing ? <EditText value={val("website")} onChange={(v) => set("website", v)} type="url" placeholder="https://..." /> : undefined}
              />
              <InfoRow
                label="Address"
                value={val("address")}
                editChild={isEditing ? <EditText value={val("address")} onChange={(v) => set("address", v)} placeholder="Street, City, Country" /> : undefined}
              />
              <InfoRow
                label="Tax ID / KVK / CNPJ"
                value={val("tax_id")}
                editChild={isEditing ? <EditText value={val("tax_id")} onChange={(v) => set("tax_id", v)} placeholder="Tax identifier" /> : undefined}
              />

              <SectionHeader label="Notes" icon={FileText} />

              <InfoRow
                label="Description"
                value={val("business_description")}
                editChild={isEditing ? <EditTextarea value={val("business_description")} onChange={(v) => set("business_description", v)} placeholder="Business description…" rows={3} /> : undefined}
              />
              <InfoRow
                label="Notes"
                value={val("notes")}
                editChild={isEditing ? <EditTextarea value={val("notes")} onChange={(v) => set("notes", v)} placeholder="Internal notes…" rows={3} /> : undefined}
              />
              <InfoRow
                label="Service Categories"
                value={
                  serviceCategories.length > 0 ? (
                    <span className="flex flex-wrap gap-1 mt-0.5">
                      {serviceCategories.map((cat, i) => (
                        <span key={i} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
                          {cat}
                        </span>
                      ))}
                    </span>
                  ) : undefined
                }
                editChild={isEditing ? <EditText value={val("service_categories")} onChange={(v) => set("service_categories", v)} placeholder="Comma-separated list" /> : undefined}
              />
            </div>
          </div>

          {/* Column 2: Campaigns & Contracts */}
          <div className="overflow-y-auto rounded-xl" style={{ height: "48vh" }}>
            <div className="bg-white/60 rounded-xl p-4 min-h-full" data-testid="account-widget-campaigns">
              <p className="text-[17px] font-semibold font-heading text-foreground mb-3">Campaigns & Contracts</p>
              <AccountCampaignsPanel accountId={accountId} />
            </div>
          </div>

          {/* Column 3: Users */}
          <div className="overflow-y-auto rounded-xl" style={{ height: "48vh" }}>
            <div className="bg-white/60 rounded-xl p-4 min-h-full" data-testid="account-widget-users">
              <p className="text-[17px] font-semibold font-heading text-foreground mb-3">Users</p>
              <AccountUsersPanel accountId={accountId} />
            </div>
          </div>

        </div>

        {/* Bottom row: AI & Schedule | Twilio | Placeholder */}
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>

          {/* Bottom Col 1: AI & Schedule */}
          <div className="overflow-y-auto rounded-xl" style={{ height: "48vh" }}>
            <div className="bg-white/60 rounded-xl p-4 flex flex-col min-h-full" data-testid="account-widget-ai">
              <p className="text-[17px] font-semibold font-heading text-foreground mb-3">AI & Schedule</p>

              <SectionHeader label="AI Config" icon={Bot} />

              <InfoRow
                label="AI Name"
                value={val("default_ai_name")}
                editChild={isEditing ? <EditText value={val("default_ai_name")} onChange={(v) => set("default_ai_name", v)} placeholder="e.g. Alex" /> : undefined}
              />
              <InfoRow
                label="AI Role"
                value={val("default_ai_role")}
                editChild={isEditing ? <EditText value={val("default_ai_role")} onChange={(v) => set("default_ai_role", v)} placeholder="e.g. Sales Assistant" /> : undefined}
              />
              <InfoRow
                label="AI Style"
                value={val("default_ai_style")}
                editChild={isEditing ? <EditText value={val("default_ai_style")} onChange={(v) => set("default_ai_style", v)} placeholder="e.g. Friendly, Professional" /> : undefined}
              />
              <InfoRow
                label="Typo Frequency"
                value={val("default_typo_frequency")}
                editChild={isEditing ? <EditText value={val("default_typo_frequency")} onChange={(v) => set("default_typo_frequency", v)} placeholder="e.g. Low" /> : undefined}
              />
              <InfoRow
                label="Opt-out Keyword"
                value={val("opt_out_keyword")}
                editChild={isEditing ? <EditText value={val("opt_out_keyword")} onChange={(v) => set("opt_out_keyword", v)} placeholder="e.g. STOP" /> : undefined}
              />
              <InfoRow
                label="Terminology"
                value={val("preferred_terminology")}
                editChild={isEditing ? <EditText value={val("preferred_terminology")} onChange={(v) => set("preferred_terminology", v)} placeholder="e.g. prospects, clients" /> : undefined}
              />

              <SectionHeader label="Schedule" icon={Clock} />

              <InfoRow
                label="Timezone"
                value={val("timezone")}
                editChild={isEditing ? <EditSelect value={val("timezone")} onChange={(v) => set("timezone", v)} options={TIMEZONE_OPTIONS} /> : undefined}
              />
              <InfoRow
                label="Hours Open"
                value={formatTimeDisplay(val("business_hours_start")) || val("business_hours_start")}
                editChild={isEditing ? <EditText value={val("business_hours_start")} onChange={(v) => set("business_hours_start", v)} type="time" /> : undefined}
              />
              <InfoRow
                label="Hours Close"
                value={formatTimeDisplay(val("business_hours_end")) || val("business_hours_end")}
                editChild={isEditing ? <EditText value={val("business_hours_end")} onChange={(v) => set("business_hours_end", v)} type="time" /> : undefined}
              />
              <InfoRow
                label="Daily Sends"
                value={val("max_daily_sends")}
                editChild={isEditing ? <EditText value={val("max_daily_sends")} onChange={(v) => set("max_daily_sends", v)} type="number" placeholder="0" /> : undefined}
              />
            </div>
          </div>

          {/* Bottom Col 2: Twilio */}
          <div className="overflow-y-auto rounded-xl" style={{ height: "48vh" }}>
            <div className="bg-white/60 rounded-xl p-4 flex flex-col min-h-full" data-testid="account-widget-twilio">
              <p className="text-[17px] font-semibold font-heading text-foreground mb-3">Twilio</p>

              <SectionHeader label="Integration" icon={Globe} />

              <InfoRow
                label="Account SID"
                value={<MonoValue value={val("twilio_account_sid")} />}
                editChild={isEditing ? <EditText value={val("twilio_account_sid")} onChange={(v) => set("twilio_account_sid", v)} placeholder="ACxxxxxxxxxxxxxxxx" /> : undefined}
              />
              <InfoRow
                label="Auth Token"
                value={<SecretDisplay value={val("twilio_auth_token")} />}
                editChild={isEditing ? <EditText value={val("twilio_auth_token")} onChange={(v) => set("twilio_auth_token", v)} type="password" placeholder="Auth token" /> : undefined}
              />
              <InfoRow
                label="Service SID"
                value={<MonoValue value={val("twilio_messaging_service_sid")} />}
                editChild={isEditing ? <EditText value={val("twilio_messaging_service_sid")} onChange={(v) => set("twilio_messaging_service_sid", v)} placeholder="MGxxxxxxxxxxxxxxxx" /> : undefined}
              />
              <InfoRow
                label="From Number"
                value={<MonoValue value={val("twilio_default_from_number")} />}
                editChild={isEditing ? <EditText value={val("twilio_default_from_number")} onChange={(v) => set("twilio_default_from_number", v)} placeholder="+1xxxxxxxxxx" /> : undefined}
              />
              <InfoRow
                label="Webhook URL"
                value={<MonoValue value={val("webhook_url")} />}
                editChild={isEditing ? <EditText value={val("webhook_url")} onChange={(v) => set("webhook_url", v)} type="url" placeholder="https://..." /> : undefined}
              />
            </div>
          </div>

          {/* Bottom Col 3: Placeholder */}
          <div className="overflow-y-auto rounded-xl" style={{ height: "48vh" }}>
            <div className="bg-white/60 rounded-xl p-4 min-h-full" data-testid="account-widget-placeholder">
              <p className="text-[17px] font-semibold font-heading text-foreground mb-3">Activity</p>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-[12px] text-foreground/30 italic">Coming soon</p>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Logo crop modal */}
      {cropSrc && (
        <LogoCropModal
          srcUrl={cropSrc}
          onSave={handleCropSave}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
