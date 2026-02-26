import { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Search, List, Table2, SlidersHorizontal, Layers, ArrowUpDown,
  Filter, Check, UserPlus, Mail,
  Users, Clock,
  AlertTriangle, XCircle, X, Plus, User, KeyRound, Building2, Camera, Trash2, Copy,
} from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { IconBtn } from "@/components/ui/icon-btn";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
import { ToolbarPill } from "@/components/ui/toolbar-pill";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AppUser, AccountMap } from "../pages/UsersPage";

// ── Types ─────────────────────────────────────────────────────────────────────
export type UsersViewMode  = "list" | "table";
export type UsersGroupBy   = "role" | "status" | "account" | "none";
export type UsersSortBy    = "name_asc" | "name_desc" | "recent";

export const USERS_GROUP_LABELS: Record<UsersGroupBy, string> = {
  role:    "Role",
  status:  "Status",
  account: "Account",
  none:    "None",
};
export const USERS_SORT_LABELS: Record<UsersSortBy, string> = {
  name_asc:  "Name A \u2192 Z",
  name_desc: "Name Z \u2192 A",
  recent:    "Last Active",
};

const ROLE_GROUP_ORDER = ["Admin", "Operator", "Manager", "Agent", "Viewer"];
const STATUS_GROUP_ORDER = ["Active", "Invited", "Inactive"];
const ROLE_OPTIONS = ["Admin", "Operator", "Manager", "Agent", "Viewer"];
const STATUS_OPTIONS = ["Active", "Inactive", "Invited"];

/* ── Card stagger animation variants ── */
const staggerContainerVariants = {
  hidden: {},
  visible: (count: number) => ({
    transition: {
      staggerChildren: Math.min(1 / Math.max(count, 1), 0.08),
    },
  }),
};
const staggerItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

// ── Color maps ────────────────────────────────────────────────────────────────
const ROLE_AVATAR: Record<string, { bg: string; text: string }> = {
  Admin:    { bg: "#FEF9C3", text: "#854D0E" },
  Operator: { bg: "#FFEDD5", text: "#9A3412" },
  Manager:  { bg: "#DBEAFE", text: "#1E40AF" },
  Agent:    { bg: "#EDE9FE", text: "#5B21B6" },
  Viewer:   { bg: "#E5E7EB", text: "#374151" },
};

const ROLE_BADGE: Record<string, string> = {
  Admin:    "bg-brand-yellow/20 text-brand-deep-blue dark:bg-amber-900/30 dark:text-amber-400",
  Operator: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Manager:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Agent:    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Viewer:   "bg-muted text-muted-foreground dark:bg-zinc-800/60 dark:text-zinc-400",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}
function getUserName(u: AppUser): string { return u.fullName1 || u.email || `User #${u.id}`; }
function isActive(s: string | null | undefined): boolean { return (s || "").toLowerCase() === "active"; }
function isInvited(s: string | null | undefined): boolean { return (s || "").toLowerCase() === "invited"; }

function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const diff = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    if (diff === 0) { const h = Math.floor((Date.now() - d.getTime()) / 3_600_000); return h === 0 ? "Just now" : `${h}h ago`; }
    if (diff === 1) return "Yesterday";
    if (diff < 7) return `${diff}d ago`;
    if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
    return `${Math.floor(diff / 30)}mo ago`;
  } catch { return ""; }
}

function formatMediumDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2014";
  try { return new Date(dateStr).toLocaleDateString([], { dateStyle: "medium" }); } catch { return "\u2014"; }
}

function formatFullDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never logged in";
  try { return new Date(dateStr).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); } catch { return "\u2014"; }
}

async function resizeImageTo80(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new globalThis.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const SIZE = 80;
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("No canvas context")); return; }
      const scale = Math.max(SIZE / img.width, SIZE / img.height);
      const x = (SIZE - img.width * scale) / 2;
      const y = (SIZE - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load error")); };
    img.src = url;
  });
}

// ── Invite helpers (inlined) ──────────────────────────────────────────────────
function getInviteSentAt(u: AppUser): Date | null {
  if (!u.preferences) return null;
  try {
    const parsed = typeof u.preferences === "string" ? JSON.parse(u.preferences) : u.preferences;
    if (parsed?.invite_sent_at) return new Date(parsed.invite_sent_at);
  } catch {}
  return null;
}

function isInviteExpired(u: AppUser): boolean {
  const sentAt = getInviteSentAt(u);
  return sentAt ? (Date.now() - sentAt.getTime()) / (1000 * 60 * 60 * 24) > 7 : false;
}

// ── Avatar Crop Modal ─────────────────────────────────────────────────────────
function CropModal({
  srcUrl,
  onSave,
  onCancel,
}: {
  srcUrl: string;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const PREVIEW = 240;
  const OUTPUT  = 80;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom]         = useState(1);
  const [fitZoom, setFitZoom]   = useState(1);
  const [offset, setOffset]     = useState({ x: 0, y: 0 });
  const dragging  = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  useEffect(() => {
    const img = new globalThis.Image();
    img.onload = () => {
      imgRef.current = img;
      // Fit the entire image inside the preview circle (no crop initially)
      const fz = Math.min(PREVIEW / img.width, PREVIEW / img.height);
      setFitZoom(fz);
      setZoom(fz);
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
          <DialogTitle>Crop Photo</DialogTitle>
          <DialogDescription>Drag to reposition · scroll slider to zoom</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-full overflow-hidden ring-2 ring-brand-indigo/20" style={{ width: PREVIEW, height: PREVIEW }}>
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
            <button
              type="button"
              onClick={() => setZoom((z) => parseFloat(Math.max(fitZoom * 0.5, z - 0.01).toFixed(2)))}
              className="h-6 w-6 rounded-full flex items-center justify-center text-[14px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors select-none shrink-0"
            >−</button>
            <input
              type="range"
              min={(fitZoom * 0.5).toFixed(2)}
              max={(fitZoom + 0.30).toFixed(2)}
              step="0.01"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-brand-indigo"
            />
            <button
              type="button"
              onClick={() => setZoom((z) => parseFloat(Math.min(fitZoom + 0.30, z + 0.01).toFixed(2)))}
              className="h-6 w-6 rounded-full flex items-center justify-center text-[14px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors select-none shrink-0"
            >+</button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSave}>Save Photo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Inline edit field ─────────────────────────────────────────────────────────
function InlineEditField({
  value,
  label,
  onSave,
  mono,
  type = "text",
}: {
  value: string;
  label: string;
  onSave: (val: string) => void;
  mono?: boolean;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const save = () => {
    if (draft.trim() !== value) onSave(draft.trim());
    setEditing(false);
  };

  if (!editing) {
    return (
      <div
        className={cn(
          "text-[12px] text-foreground truncate cursor-pointer hover:bg-white/40 rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-colors",
          mono && "font-mono"
        )}
        onClick={() => setEditing(true)}
        title={`Click to edit ${label}`}
      >
        {value || <span className="text-muted-foreground/50 italic">Click to set</span>}
      </div>
    );
  }

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") { setDraft(value); setEditing(false); }
      }}
      type={type}
      autoFocus
      className={cn(
        "text-[12px] text-foreground bg-white/80 rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 outline-none ring-1 ring-brand-indigo/40 w-full",
        mono && "font-mono"
      )}
    />
  );
}

// ── Virtual list item ─────────────────────────────────────────────────────────
type VirtualItem =
  | { kind: "header"; label: string; count: number }
  | { kind: "user";   user: AppUser };

// ── Group header ──────────────────────────────────────────────────────────────
function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="sticky top-0 z-20 bg-muted px-3 pt-1.5 pb-1.5">
      <div className="flex items-center gap-0">
        <div className="flex-1 h-px bg-foreground/15 mx-[8px]" />
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest shrink-0">{label}</span>
        <span className="ml-1 text-[9px] text-muted-foreground/45 font-semibold shrink-0">{count}</span>
        <div className="flex-1 h-px bg-foreground/15 mx-[8px]" />
      </div>
    </div>
  );
}

// ── Pending invites card (sticky above list) ───────────────────────────────────
function PendingInvitesCard({
  invites,
  resendingUserId,
  revokingUserId,
  resendResult,
  onResend,
  onRevoke,
}: {
  invites: AppUser[];
  resendingUserId: number | null;
  revokingUserId: number | null;
  resendResult: { userId: number; token: string } | null;
  onResend: (u: AppUser) => void;
  onRevoke: (u: AppUser) => void;
}) {
  if (invites.length === 0) return null;

  return (
    <div
      className="mx-[3px] mb-1 shrink-0 rounded-xl border border-amber-200/80 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/10 overflow-hidden"
      data-testid="section-pending-invites"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-200/60 dark:border-amber-700/30">
        <Mail className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-[12px] font-semibold text-amber-800 dark:text-amber-300 flex-1">Pending Invites</span>
        <span className="px-1.5 py-0.5 rounded-full bg-amber-200 dark:bg-amber-700/50 text-amber-800 dark:text-amber-300 text-[10px] font-bold tabular-nums">
          {invites.length}
        </span>
      </div>
      <div className={cn("divide-y divide-amber-100/80 dark:divide-amber-800/30", invites.length > 3 && "max-h-[176px] overflow-y-auto")}>
        {invites.map((u) => {
          const sentAt      = getInviteSentAt(u);
          const expired     = isInviteExpired(u);
          const resending   = resendingUserId === u.id;
          const revoking    = revokingUserId === u.id;
          const busy        = resending || revoking;
          const justResent  = resendResult?.userId === u.id;
          return (
            <div key={u.id} className="px-3 py-2" data-testid={`invite-row-${u.id}`}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-6 w-6 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                  <User className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-foreground truncate leading-tight">{u.email || "\u2014"}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {u.role && <span className={cn("px-1.5 py-px rounded text-[9px] font-semibold", ROLE_BADGE[u.role] ?? "bg-muted text-muted-foreground")}>{u.role}</span>}
                    {sentAt && <span className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{sentAt.toLocaleDateString(undefined, { dateStyle: "medium" })}</span>}
                    {expired && <span className="inline-flex items-center gap-0.5 px-1 py-px rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[9px] font-medium"><AlertTriangle className="w-2.5 h-2.5" />Expired</span>}
                    {justResent && <span className="inline-flex items-center gap-0.5 px-1 py-px rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[9px] font-medium"><Check className="w-2.5 h-2.5" />Resent</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <button onClick={() => onResend(u)} disabled={busy} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border border-amber-300 dark:border-amber-700 bg-amber-100/60 hover:bg-amber-200/60 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 disabled:opacity-50 disabled:cursor-not-allowed">
                  <Clock className={cn("w-2.5 h-2.5", resending && "animate-spin")} />{resending ? "Sending\u2026" : "Resend"}
                </button>
                <button onClick={() => onRevoke(u)} disabled={busy} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border border-red-200 dark:border-red-700/50 bg-red-50/60 hover:bg-red-100/60 dark:bg-red-900/10 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed">
                  <XCircle className={cn("w-2.5 h-2.5", revoking && "animate-spin")} />{revoking ? "Revoking\u2026" : "Revoke"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── User list card ─────────────────────────────────────────────────────────────
function UserCard({
  user, isSelected, onClick, accounts, onDeleteAvatar,
}: {
  user: AppUser; isSelected: boolean; onClick: () => void; accounts: AccountMap;
  onDeleteAvatar?: () => void;
}) {
  const name = getUserName(user);
  const initials = getInitials(name);
  const role = user.role || "Viewer";
  const avatarColor = ROLE_AVATAR[role] ?? ROLE_AVATAR.Viewer;
  const accountName = user.accountsId ? (accounts[user.accountsId] || `Account #${user.accountsId}`) : null;
  const lastActivity = user.lastLoginAt || user.createdAt;

  return (
    <div
      className={cn(
        "relative mx-[3px] my-0.5 rounded-xl cursor-pointer",
        "transition-all duration-150 ease-out",
        isSelected
          ? "bg-[#FFF1C8]"
          : "bg-[#F1F1F1] hover:bg-[#FAFAFA] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      data-testid={`card-user-${user.id}`}
    >
      <div className="px-3 pt-3 pb-2.5 flex flex-col gap-2">

        {/* Avatar + Name row */}
        <div className="flex items-start gap-2.5">
          <div className="relative shrink-0 mt-0.5 group/avatar">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-10 w-10">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={initials}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center text-[11px] font-bold"
                        style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
                      >
                        {initials}
                      </div>
                    )}
                  </div>
                </TooltipTrigger>
                {(user.email || user.phone) && (
                  <TooltipContent side="right" className="text-[11px]">
                    {user.email && <p>{user.email}</p>}
                    {user.phone && <p className="text-muted-foreground">{user.phone}</p>}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            {user.avatarUrl && onDeleteAvatar && (
              <button
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity z-10 shadow-sm"
                onClick={(e) => { e.stopPropagation(); onDeleteAvatar(); }}
                title="Remove photo"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Name + status on same row */}
            <div className="flex items-start justify-between gap-2">
              <p className="text-[15px] font-semibold font-heading leading-tight truncate text-foreground">
                {name}
              </p>
              {user.status && (
                <span className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-semibold uppercase shrink-0 mt-0.5",
                  isActive(user.status) ? "text-emerald-600 dark:text-emerald-400"
                  : isInvited(user.status) ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
                )}>
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                    isActive(user.status) ? "bg-emerald-500"
                    : isInvited(user.status) ? "bg-amber-400"
                    : "bg-muted-foreground"
                  )} />
                  {user.status}
                </span>
              )}
            </div>

            {/* Role badge */}
            {user.role && (
              <span className={cn("mt-1 inline-block px-1.5 py-px rounded-md text-[10px] font-semibold", ROLE_BADGE[user.role] ?? "bg-muted text-muted-foreground")}>
                {user.role}
              </span>
            )}
          </div>
        </div>

        {/* Bottom row: account + last activity */}
        {(accountName || lastActivity) && (
          <div className="flex items-center justify-between gap-2 pt-0.5">
            {accountName ? (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground truncate min-w-0">
                <Building2 className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                <span className="truncate">{accountName}</span>
              </span>
            ) : <span />}
            {lastActivity && (
              <span className="text-[10px] text-muted-foreground/70 shrink-0 tabular-nums">
                {formatRelative(lastActivity)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function ListSkeleton() {
  return (
    <div className="space-y-0 p-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3.5 rounded-lg animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="h-10 w-10 rounded-full bg-foreground/10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-foreground/10 rounded-full w-3/5" />
            <div className="h-2.5 bg-foreground/8 rounded-full w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Empty detail state ────────────────────────────────────────────────────────
function EmptyDetailState({ count, onInviteUser }: { count: number; onInviteUser?: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="relative">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 flex items-center justify-center ring-1 ring-blue-200/50 dark:ring-blue-800/30">
          <Users className="h-10 w-10 text-blue-400 dark:text-blue-500" />
        </div>
        <div className="absolute -top-2 -right-2 h-10 w-10 rounded-full bg-brand-indigo flex items-center justify-center shadow-md ring-2 ring-background">
          <span className="text-[10px] font-bold text-white">{count > 99 ? "99+" : count}</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">Select a user</p>
        <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">
          Click any user in the list to view their profile and manage their account.
        </p>
      </div>
      {onInviteUser && (
        <button
          onClick={onInviteUser}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border border-border/60 text-foreground hover:bg-muted/60 transition-colors"
        >
          <UserPlus className="h-3.5 w-3.5" /> Invite User
        </button>
      )}
    </div>
  );
}

// ── Invite User Panel ─────────────────────────────────────────────────────────
const ROLE_DESCRIPTIONS: Record<string, string> = {
  Admin:    "Full access — manages all accounts, users, and system settings",
  Operator: "Agency-level access to campaigns, leads, and conversations",
  Manager:  "Scoped to their account — can manage leads and campaigns",
  Agent:    "Scoped access — handles leads and conversations",
  Viewer:   "Read-only access to their assigned account",
};

function InviteUserPanel({
  accounts,
  onCreated,
  onClose,
}: {
  accounts: AccountMap;
  onCreated: (user: AppUser) => void;
  onClose: () => void;
}) {
  const [email, setEmail]             = useState("");
  const [role, setRole]               = useState("Viewer");
  const [lang, setLang]               = useState<"en" | "pt" | "nl">("en");
  const [accountId, setAccountId]     = useState("none");
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState<{ token: string; email: string } | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [emailError, setEmailError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setEmailError("Email is required"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setEmailError("Enter a valid email address"); return; }
    setEmailError("");
    setLoading(true);
    try {
      const body: Record<string, any> = { email: email.trim(), role };
      body.lang = lang;
      body.frontendOrigin = window.location.origin;
      if (accountId !== "none") body.accountsId = Number(accountId);
      const res = await apiFetch("/api/users/invite", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send invite");
      setResult({ token: data.invite_token, email: email.trim() });
      if (data.user) onCreated(data.user);
      toast({ title: "Invite created", description: `${email.trim()} invited as ${role}` });
    } catch (err: any) {
      toast({ title: "Invite failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyToken() {
    if (!result) return;
    await navigator.clipboard.writeText(result.token).catch(() => {});
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  }

  function handleInviteAnother() {
    setResult(null); setEmail(""); setRole("Viewer"); setLang("en"); setAccountId("none");
    setTokenCopied(false); setEmailError("");
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-card">

      {/* ── Header ── */}
      <div className="flex items-start justify-between px-5 pt-6 pb-4 border-b border-border/30 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-foreground font-heading leading-tight">Invite User</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {result ? "Token created — share it with the user to activate their account" : "Add a new member to the platform"}
          </p>
        </div>
        <button type="button" onClick={onClose} className="icon-circle-lg icon-circle-base mt-0.5" title="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">
        {result ? (
          /* Success state */
          <div className="px-5 py-6 space-y-5">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-800/50 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Invite created</p>
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-500 mt-0.5">
                    Sending to <span className="font-medium">{result.email}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Invite Token
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 rounded-lg border border-border/50 bg-muted/60 px-3 py-2.5 font-mono text-[11px] text-foreground truncate select-all cursor-text">
                  {result.token}
                </div>
                <button
                  onClick={handleCopyToken}
                  className={cn(
                    "icon-circle-lg shrink-0 transition-colors",
                    tokenCopied
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
                      : "icon-circle-base",
                  )}
                  title={tokenCopied ? "Copied!" : "Copy token"}
                >
                  {tokenCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Share this token with the user. They'll use it to complete their registration. Expires in 7 days.
              </p>
            </div>
          </div>
        ) : (
          /* Form state */
          <form id="invite-user-form" onSubmit={handleSubmit} className="px-5 py-6 space-y-5">

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="ip-email" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
                <Input
                  id="ip-email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
                  className={cn("pl-9", emailError && "border-destructive")}
                  autoFocus
                />
              </div>
              {emailError && <p className="text-[10px] text-destructive font-medium">{emailError}</p>}
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label htmlFor="ip-role" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Role <span className="text-destructive">*</span>
              </Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="ip-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              {role && (
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              )}
            </div>

            {/* Language */}
            <div className="space-y-1.5">
              <Label htmlFor="ip-lang" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Email Language
              </Label>
              <Select value={lang} onValueChange={(v) => setLang(v as "en" | "pt" | "nl")}>
                <SelectTrigger id="ip-lang"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">🇬🇧 English</SelectItem>
                  <SelectItem value="pt">🇧🇷 Português</SelectItem>
                  <SelectItem value="nl">🇳🇱 Nederlands</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Account */}
            <div className="space-y-1.5">
              <Label htmlFor="ip-account" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Account{" "}
                <span className="text-muted-foreground/50 font-normal normal-case tracking-normal">(optional)</span>
              </Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="ip-account"><SelectValue placeholder="No account assigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No account</SelectItem>
                  {Object.entries(accounts).map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </form>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-5 py-3 border-t border-border/30 shrink-0 flex items-center justify-between gap-2">
        {result ? (
          <>
            <button
              type="button"
              onClick={handleInviteAnother}
              className="text-sm text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              Invite another
            </button>
            <Button
              onClick={onClose}
              className="bg-foreground text-background hover:bg-foreground/90 h-9 px-5 text-sm"
            >
              Done
            </Button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              Cancel
            </button>
            <Button
              type="submit"
              form="invite-user-form"
              disabled={loading || !email.trim()}
              className="bg-foreground text-background hover:bg-foreground/90 h-9 px-5 text-sm"
            >
              {loading ? "Sending…" : "Send Invite"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── User detail panel ─────────────────────────────────────────────────────────
function UserDetailView({
  user,
  accounts,
  isAdmin,
  currentUserEmail,
  onStatusToggle,
  togglingUserId,
  onUpdateField,
  onPasswordReset,
  onInviteUser,
}: {
  user: AppUser;
  accounts: AccountMap;
  isAdmin: boolean;
  currentUserEmail: string;
  onStatusToggle: (u: AppUser, checked: boolean) => void;
  togglingUserId: number | null;
  onUpdateField: (userId: number, field: string, value: any) => void;
  onPasswordReset: (u: AppUser) => void;
  onInviteUser?: () => void;
}) {
  const name = getUserName(user);
  const initials = getInitials(name);
  const role = user.role || "Viewer";
  const avatarColor = ROLE_AVATAR[role] ?? ROLE_AVATAR.Viewer;
  const accountName = user.accountsId ? (accounts[user.accountsId] || `Account #${user.accountsId}`) : null;
  const canEdit = isAdmin || user.email === currentUserEmail;

  // Editable name state
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user.fullName1 || "");
  useEffect(() => setNameDraft(user.fullName1 || ""), [user.fullName1]);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropSrc(URL.createObjectURL(file));
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const handleCropSave = (dataUrl: string) => {
    onUpdateField(user.id, "avatarUrl", dataUrl);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const handleCropCancel = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const saveName = () => {
    if (nameDraft.trim() !== (user.fullName1 || "")) {
      onUpdateField(user.id, "fullName1", nameDraft.trim());
    }
    setEditingName(false);
  };

  // Delete confirmation (soft-delete → sets status to Inactive)
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleDeleteClick = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      deleteTimerRef.current = setTimeout(() => setDeleteConfirm(false), 3000);
    } else {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      setDeleteConfirm(false);
      onUpdateField(user.id, "status", "Inactive");
    }
  };
  const isSelf = user.email === currentUserEmail;

  return (
    <div className="relative flex flex-col h-full overflow-hidden">

      {/* ── Gradient background ── */}
      <div className="absolute inset-0 bg-[#F8F3EB]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_72%_56%_at_100%_0%,#FFFFFF_0%,rgba(255,255,255,0.80)_30%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_95%_80%_at_0%_0%,#FFF286_0%,rgba(255,242,134,0.60)_40%,rgba(255,242,134,0.25)_64%,transparent_80%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_62%_72%_at_100%_36%,rgba(241,218,162,0.62)_0%,transparent_64%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_92%_36%_at_48%_53%,rgba(210,188,130,0.22)_0%,transparent_72%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_98%_74%_at_50%_88%,rgba(105,170,255,0.60)_0%,transparent_74%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_54%_at_54%_60%,rgba(165,205,255,0.38)_0%,transparent_66%)]" />

      {/* ── Header ── */}
      <div className="relative shrink-0 px-4 pt-6 pb-10 space-y-3">

        {/* Toolbar: Activate switch + Password + Invite + Delete */}
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <button
              onClick={() => onStatusToggle(user, !isActive(user.status))}
              disabled={togglingUserId === user.id}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border transition-colors disabled:opacity-50",
                isActive(user.status)
                  ? "border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                  : "border-border/60 text-muted-foreground hover:bg-white/40"
              )}
              data-testid={`switch-user-status-${user.id}`}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", isActive(user.status) ? "bg-emerald-500" : "bg-muted-foreground")} />
              {togglingUserId === user.id ? "\u2026" : isActive(user.status) ? "Active" : "Inactive"}
            </button>
          )}
          {canEdit && user.email && (
            <button
              onClick={() => onPasswordReset(user)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-white/40 transition-colors"
            >
              <KeyRound className="h-3 w-3" /> Password
            </button>
          )}
          {isAdmin && onInviteUser && (
            <button
              onClick={onInviteUser}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-brand-indigo/30 text-brand-indigo hover:bg-brand-indigo/5 transition-colors"
            >
              <UserPlus className="h-3 w-3" /> Invite
            </button>
          )}
          {isAdmin && !isSelf && (
            <TooltipProvider delayDuration={0}>
              <Tooltip open={deleteConfirm} onOpenChange={(o) => { if (!o && deleteConfirm) { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); setDeleteConfirm(false); } }}>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleDeleteClick}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border transition-colors",
                      deleteConfirm
                        ? "border-red-400 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-700"
                        : "border-border/60 text-foreground/50 hover:text-red-500 hover:border-red-300 hover:bg-red-50/50"
                    )}
                  >
                    <Trash2 className="h-3 w-3" />
                    {deleteConfirm ? "Confirm" : "Delete"}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[11px]">
                  Click again to deactivate this user
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Avatar + name + badges + meta */}
        <div className="flex items-start gap-3">
          <div className="relative shrink-0 group/detailavatar">
            {/* Avatar circle — click to upload */}
            <div
              className={cn(
                "h-[72px] w-[72px] rounded-full overflow-hidden",
                canEdit && "cursor-pointer",
                !user.avatarUrl && "flex items-center justify-center text-xl font-bold"
              )}
              style={!user.avatarUrl ? { backgroundColor: avatarColor.bg, color: avatarColor.text } : {}}
              onClick={() => canEdit && avatarInputRef.current?.click()}
              title={canEdit ? "Click to upload photo" : undefined}
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={name} className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            {/* Camera overlay on hover */}
            {canEdit && (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover/detailavatar:opacity-100 transition-opacity pointer-events-none">
                <Camera className="w-5 h-5 text-white" />
              </div>
            )}
            {/* Remove button — hover-only, top-right */}
            {user.avatarUrl && canEdit && !cropSrc && (
              <button
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-white border border-border/50 flex items-center justify-center text-foreground/50 hover:text-red-500 hover:border-red-300 transition-colors z-10 opacity-0 group-hover/detailavatar:opacity-100"
                onClick={(e) => { e.stopPropagation(); onUpdateField(user.id, "avatarUrl", null); }}
                title="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFileChange}
          />
          <div className="flex-1 min-w-0 py-1">
            {/* Editable name */}
            {editingName ? (
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") { setNameDraft(user.fullName1 || ""); setEditingName(false); }
                }}
                autoFocus
                className="text-[27px] font-semibold font-heading text-foreground leading-tight bg-transparent outline-none ring-1 ring-brand-indigo/40 rounded px-1 -mx-1 w-full"
              />
            ) : (
              <h2
                className={cn(
                  "text-[27px] font-semibold font-heading text-foreground leading-tight truncate",
                  canEdit && "cursor-pointer hover:bg-white/20 rounded px-1 -mx-1"
                )}
                onClick={canEdit ? () => setEditingName(true) : undefined}
                title={canEdit ? "Click to edit name" : undefined}
              >
                {name}
              </h2>
            )}

            {/* Badges + meta strip on same row */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {/* Role badge (clickable to change if admin) */}
              {isAdmin ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <span className={cn("px-2.5 py-0.5 rounded-lg text-xs font-semibold cursor-pointer hover:ring-1 hover:ring-brand-indigo/30", ROLE_BADGE[user.role || ""] ?? "bg-muted text-muted-foreground")}>
                      {user.role || "Set role"}
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-36">
                    {ROLE_OPTIONS.map((r) => (
                      <DropdownMenuItem key={r} onClick={() => onUpdateField(user.id, "role", r)} className={cn("text-[12px]", user.role === r && "font-semibold text-brand-indigo")}>
                        {r}
                        {user.role === r && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : user.role ? (
                <span className={cn("px-2.5 py-0.5 rounded-lg text-xs font-semibold", ROLE_BADGE[user.role] ?? "bg-muted text-muted-foreground")}>
                  {user.role}
                </span>
              ) : null}

              {/* Status badge */}
              {user.status && (
                <span className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                  isActive(user.status) ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : isInvited(user.status) ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-muted text-muted-foreground"
                )}>
                  <span className={cn("w-1.5 h-1.5 rounded-full",
                    isActive(user.status) ? "bg-emerald-500"
                    : isInvited(user.status) ? "bg-amber-500"
                    : "bg-muted-foreground"
                  )} />
                  {user.status}
                </span>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="relative flex-1 min-h-0 p-[3px] overflow-y-auto">
        <div className="grid grid-cols-3 gap-[3px] h-full">

          {/* ── Contact ── */}
          <div className="bg-white/60 rounded-xl p-5 flex flex-col">
            <p className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading block mb-4">Contact</p>
            <div>
              {[
                { label: "Email",    field: "email",    value: user.email || "",    type: "email" },
                { label: "Phone",    field: "phone",    value: user.phone || "",    type: "tel",   mono: true },
                { label: "Timezone", field: "timezone", value: user.timezone || "",  type: "text" },
              ].map((row, i) => (
                <div key={row.field} className={cn("pb-3.5", i > 0 && "pt-3.5 border-t border-border/20")}>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">{row.label}</span>
                  <div className="mt-0.5">
                    {canEdit ? (
                      <InlineEditField
                        value={row.value}
                        label={row.label}
                        onSave={(val) => onUpdateField(user.id, row.field, val)}
                        type={row.type}
                        mono={row.mono}
                      />
                    ) : (
                      <span className={cn("text-[12px] font-semibold text-foreground block", row.mono && "font-mono")}>
                        {row.value || <span className="text-muted-foreground/50 italic">—</span>}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Settings ── */}
          <div className="bg-white/60 rounded-xl p-5 flex flex-col">
            <p className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading block mb-4">Settings</p>
            <div>
              {/* Account */}
              <div className="pb-3.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">Account</span>
                <div className="mt-0.5">
                  {isAdmin ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <div className="text-[12px] font-semibold text-foreground truncate cursor-pointer hover:bg-white/40 rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-colors" title="Click to change account">
                          {accountName || <span className="text-muted-foreground/50 italic">Click to set</span>}
                        </div>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-44 max-h-60 overflow-y-auto">
                        <DropdownMenuItem onClick={() => onUpdateField(user.id, "accountsId", null)} className={cn("text-[12px]", !user.accountsId && "font-semibold text-brand-indigo")}>
                          No account
                          {!user.accountsId && <Check className="h-3 w-3 ml-auto" />}
                        </DropdownMenuItem>
                        {Object.entries(accounts).map(([id, aName]) => (
                          <DropdownMenuItem key={id} onClick={() => onUpdateField(user.id, "accountsId", Number(id))} className={cn("text-[12px]", user.accountsId === Number(id) && "font-semibold text-brand-indigo")}>
                            {aName}
                            {user.accountsId === Number(id) && <Check className="h-3 w-3 ml-auto" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className="text-[12px] font-semibold text-foreground block">{accountName || <span className="text-muted-foreground/50 italic">—</span>}</span>
                  )}
                </div>
              </div>

              {/* n8n Webhook */}
              <div className="pb-3.5 pt-3.5 border-t border-border/20">
                <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">n8n Webhook</span>
                <div className="mt-0.5">
                  {canEdit ? (
                    <InlineEditField
                      value={user.n8nWebhookUrl || ""}
                      label="n8n Webhook"
                      onSave={(val) => onUpdateField(user.id, "n8nWebhookUrl", val)}
                    />
                  ) : (
                    <span className="text-[12px] font-semibold text-foreground block">{user.n8nWebhookUrl ? "Configured" : "—"}</span>
                  )}
                </div>
              </div>

              {/* Last Login */}
              <div className="pb-3.5 pt-3.5 border-t border-border/20">
                <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">Last Login</span>
                <span className="text-[12px] font-semibold text-foreground block mt-0.5">{formatFullDateTime(user.lastLoginAt)}</span>
              </div>

              {/* Member Since */}
              <div className="pb-3.5 pt-3.5 border-t border-border/20">
                <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">Member Since</span>
                <span className="text-[12px] font-semibold text-foreground block mt-0.5">{formatMediumDate(user.createdAt)}</span>
              </div>

              {/* Last Updated */}
              <div className="pt-3.5 border-t border-border/20">
                <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">Last Updated</span>
                <span className="text-[12px] font-semibold text-foreground block mt-0.5">{formatMediumDate(user.updatedAt)}</span>
              </div>
            </div>
          </div>

          {/* ── Notifications ── */}
          <div className="bg-white/60 rounded-xl p-5 flex flex-col">
            <p className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading block mb-4">Notifications</p>
            <div>
              <div className="pb-3.5 flex items-center">
                <div className="flex-1">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">Email</span>
                  <span className={cn("text-[12px] font-semibold block mt-0.5", user.notificationEmail ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground")}>
                    {user.notificationEmail ? "Enabled" : "Disabled"}
                  </span>
                </div>
                {canEdit && (
                  <Switch
                    checked={!!user.notificationEmail}
                    onCheckedChange={(checked) => onUpdateField(user.id, "notificationEmail", checked)}
                  />
                )}
              </div>
              <div className="pt-3.5 border-t border-border/20 flex items-center">
                <div className="flex-1">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">SMS</span>
                  <span className={cn("text-[12px] font-semibold block mt-0.5", user.notificationSms ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
                    {user.notificationSms ? "Enabled" : "Disabled"}
                  </span>
                </div>
                {canEdit && (
                  <Switch
                    checked={!!user.notificationSms}
                    onCheckedChange={(checked) => onUpdateField(user.id, "notificationSms", checked)}
                  />
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
      {cropSrc && (
        <CropModal srcUrl={cropSrc} onSave={handleCropSave} onCancel={handleCropCancel} />
      )}
    </div>
  );
}

// ── View tab definitions ──────────────────────────────────────────────────────
const VIEW_TABS: TabDef[] = [
  { id: "list",  label: "List",  icon: List  },
  { id: "table", label: "Table", icon: Table2 },
];

// ── Props ─────────────────────────────────────────────────────────────────────
interface UsersListViewProps {
  users: AppUser[];
  accounts: AccountMap;
  loading: boolean;
  selectedUser: AppUser | null;
  onSelectUser: (u: AppUser) => void;
  onStatusToggle: (u: AppUser, checked: boolean) => void;
  togglingUserId: number | null;
  isAdmin: boolean;
  currentUserEmail: string;
  onInviteCreated: (u: AppUser) => void;
  viewMode: UsersViewMode;
  onViewModeChange: (v: UsersViewMode) => void;
  listSearch: string;
  onListSearchChange: (v: string) => void;
  searchOpen: boolean;
  onSearchOpenChange: (v: boolean) => void;
  groupBy: UsersGroupBy;
  onGroupByChange: (v: UsersGroupBy) => void;
  sortBy: UsersSortBy;
  onSortByChange: (v: UsersSortBy) => void;
  filterRole: string[];
  onToggleFilterRole: (r: string) => void;
  filterStatus: string[];
  onToggleFilterStatus: (s: string) => void;
  hasNonDefaultControls: boolean;
  isGroupNonDefault: boolean;
  isSortNonDefault: boolean;
  onResetControls: () => void;
  pendingInvites: AppUser[];
  resendingUserId: number | null;
  revokingUserId: number | null;
  resendResult: { userId: number; token: string } | null;
  onResendInvite: (u: AppUser) => void;
  onRevokeInvite: (u: AppUser) => void;
  onUpdateField: (userId: number, field: string, value: any) => void;
  onPasswordReset: (u: AppUser) => void;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function UsersListView({
  users, accounts, loading, selectedUser, onSelectUser,
  onStatusToggle, togglingUserId, isAdmin, currentUserEmail, onInviteCreated,
  viewMode, onViewModeChange,
  listSearch, onListSearchChange, searchOpen, onSearchOpenChange,
  groupBy, onGroupByChange, sortBy, onSortByChange,
  filterRole, onToggleFilterRole, filterStatus, onToggleFilterStatus,
  hasNonDefaultControls, isGroupNonDefault, isSortNonDefault, onResetControls,
  pendingInvites, resendingUserId, revokingUserId, resendResult, onResendInvite, onRevokeInvite,
  onUpdateField, onPasswordReset,
}: UsersListViewProps) {

  const [inviteOpen, setInviteOpen] = useState(false);
  const isFilterActive = filterRole.length > 0 || filterStatus.length > 0;

  // Build flat items (filtered + sorted + grouped)
  const flatItems = useMemo((): VirtualItem[] => {
    let filtered = users;

    if (listSearch.trim()) {
      const q = listSearch.toLowerCase();
      filtered = filtered.filter((u) =>
        (u.fullName1 || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.phone || "").toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q) ||
        (accounts[u.accountsId ?? 0] || "").toLowerCase().includes(q)
      );
    }
    if (filterRole.length > 0) filtered = filtered.filter((u) => filterRole.includes(u.role || ""));
    if (filterStatus.length > 0) filtered = filtered.filter((u) => filterStatus.includes(u.status || ""));

    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name_asc":  return getUserName(a).localeCompare(getUserName(b));
        case "name_desc": return getUserName(b).localeCompare(getUserName(a));
        default: {
          const da = a.lastLoginAt || a.createdAt || "";
          const db = b.lastLoginAt || b.createdAt || "";
          return db.localeCompare(da);
        }
      }
    });

    if (groupBy === "none") return filtered.map((u) => ({ kind: "user", user: u }));

    const buckets = new Map<string, AppUser[]>();
    filtered.forEach((u) => {
      let key: string;
      switch (groupBy) {
        case "role":    key = u.role || "No Role"; break;
        case "status":  key = u.status || "Unknown"; break;
        case "account": key = accounts[u.accountsId ?? 0] || "No Account"; break;
        default:        key = u.role || "No Role";
      }
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(u);
    });

    const allKeys = Array.from(buckets.keys());
    const orderedKeys =
      groupBy === "role"
        ? ROLE_GROUP_ORDER.filter((k) => buckets.has(k)).concat(allKeys.filter((k) => !ROLE_GROUP_ORDER.includes(k)))
        : groupBy === "status"
        ? STATUS_GROUP_ORDER.filter((k) => buckets.has(k)).concat(allKeys.filter((k) => !STATUS_GROUP_ORDER.includes(k)))
        : allKeys.sort();

    const result: VirtualItem[] = [];
    orderedKeys.forEach((key) => {
      const group = buckets.get(key);
      if (!group || group.length === 0) return;
      result.push({ kind: "header", label: key, count: group.length });
      group.forEach((u) => result.push({ kind: "user", user: u }));
    });
    return result;
  }, [users, listSearch, groupBy, sortBy, filterRole, filterStatus, accounts]);

  return (
    <div className="flex h-full min-h-[600px] overflow-hidden gap-[3px]">

      {/* ── LEFT: User list pane ─────────────────────────────────────────────── */}
      <div className="flex flex-col bg-muted rounded-lg overflow-hidden w-[340px] flex-shrink-0">

        {/* Panel header */}
        <div className="px-3.5 pt-5 pb-1 shrink-0 flex items-center justify-between">
          <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">My Users</h2>
          <span className="w-10 text-center text-[12px] font-medium text-muted-foreground tabular-nums">{users.length}</span>
        </div>

        {/* Controls row */}
        <div className="px-3 pt-1.5 pb-3 shrink-0 flex items-center justify-between gap-2">

          {/* View tabs */}
          <ViewTabBar tabs={VIEW_TABS} activeId={viewMode} onTabChange={(id) => onViewModeChange(id as UsersViewMode)} />

          {/* Right controls: + / Search / Settings */}
          <div className="flex items-center gap-1.5 shrink-0">

            {/* Invite / new user */}
            {isAdmin && (
              <IconBtn title="Invite User" active={inviteOpen} onClick={() => setInviteOpen(true)}>
                <Plus className="h-4 w-4" />
              </IconBtn>
            )}

            {/* Search popup */}
            <Popover open={searchOpen} onOpenChange={(open) => { onSearchOpenChange(open); if (!open) onListSearchChange(""); }}>
              <PopoverTrigger asChild>
                <IconBtn active={searchOpen || !!listSearch} title="Search users">
                  <Search className="h-4 w-4" />
                </IconBtn>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-2" sideOffset={4}>
                <input
                  value={listSearch}
                  onChange={(e) => onListSearchChange(e.target.value)}
                  placeholder="Search users..."
                  autoFocus
                  className="w-full h-8 px-3 rounded-lg bg-muted/60 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand-indigo/30 placeholder:text-muted-foreground/60"
                />
              </PopoverContent>
            </Popover>

            {/* Settings */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconBtn active={hasNonDefaultControls} title="Group, Sort & Filter">
                  <SlidersHorizontal className="h-4 w-4" />
                </IconBtn>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-[12px]">
                    <Layers className="h-3.5 w-3.5 mr-2" />
                    Group
                    {isGroupNonDefault && <span className="ml-auto text-[10px] text-brand-indigo font-medium">{USERS_GROUP_LABELS[groupBy]}</span>}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-40">
                    {(["role", "status", "account", "none"] as UsersGroupBy[]).map((opt) => (
                      <DropdownMenuItem key={opt} onClick={() => onGroupByChange(opt)} className={cn("text-[12px]", groupBy === opt && "font-semibold text-brand-indigo")}>
                        {USERS_GROUP_LABELS[opt]}
                        {groupBy === opt && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-[12px]">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-2" />
                    Sort
                    {isSortNonDefault && <span className="ml-auto text-[10px] text-brand-indigo font-medium">{USERS_SORT_LABELS[sortBy]}</span>}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-44">
                    {(["name_asc", "name_desc", "recent"] as UsersSortBy[]).map((opt) => (
                      <DropdownMenuItem key={opt} onClick={() => onSortByChange(opt)} className={cn("text-[12px]", sortBy === opt && "font-semibold text-brand-indigo")}>
                        {USERS_SORT_LABELS[opt]}
                        {sortBy === opt && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-[12px]">
                    <Filter className="h-3.5 w-3.5 mr-2" />
                    Filter Role
                    {filterRole.length > 0 && <span className="ml-auto text-[10px] text-brand-indigo font-medium">{filterRole.length}</span>}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-44">
                    {ROLE_OPTIONS.map((r) => (
                      <DropdownMenuItem key={r} onClick={(e) => { e.preventDefault(); onToggleFilterRole(r); }} className="flex items-center gap-2 text-[12px]">
                        <span className="flex-1">{r}</span>
                        {filterRole.includes(r) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-[12px]">
                    <Filter className="h-3.5 w-3.5 mr-2" />
                    Filter Status
                    {filterStatus.length > 0 && <span className="ml-auto text-[10px] text-brand-indigo font-medium">{filterStatus.length}</span>}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-44">
                    {STATUS_OPTIONS.map((s) => (
                      <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); onToggleFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
                        <span className="flex-1">{s}</span>
                        {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {hasNonDefaultControls && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onResetControls} className="text-[12px] text-destructive">
                      Reset all settings
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Pending invites sticky card (admin only) */}
        {isAdmin && pendingInvites.length > 0 && (
          <PendingInvitesCard
            invites={pendingInvites}
            resendingUserId={resendingUserId}
            revokingUserId={revokingUserId}
            resendResult={resendResult}
            onResend={onResendInvite}
            onRevoke={onRevokeInvite}
          />
        )}

        {/* User list */}
        <div className="flex-1 overflow-y-auto pb-2">
          {loading ? (
            <ListSkeleton />
          ) : flatItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                {listSearch || isFilterActive ? "No users match your filters" : "No users found"}
              </p>
            </div>
          ) : (
            <motion.div
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              custom={flatItems.length}
            >
              {flatItems.map((item, i) => {
                if (item.kind === "header") {
                  return (
                    <motion.div key={`h-${item.label}-${i}`} variants={staggerItemVariants}>
                      <GroupHeader label={item.label} count={item.count} />
                    </motion.div>
                  );
                }
                const u = item.user;
                return (
                  <motion.div key={u.id} variants={staggerItemVariants}>
                    <UserCard
                      user={u}
                      isSelected={selectedUser?.id === u.id}
                      onClick={() => onSelectUser(u)}
                      accounts={accounts}
                      onDeleteAvatar={() => onUpdateField(u.id, "avatarUrl", null)}
                    />
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Detail / Invite panel ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-card rounded-lg">
        {inviteOpen ? (
          <InviteUserPanel
            accounts={accounts}
            onCreated={(u) => { onInviteCreated(u); }}
            onClose={() => setInviteOpen(false)}
          />
        ) : selectedUser ? (
          <UserDetailView
            user={selectedUser}
            accounts={accounts}
            isAdmin={isAdmin}
            currentUserEmail={currentUserEmail}
            onStatusToggle={onStatusToggle}
            togglingUserId={togglingUserId}
            onUpdateField={onUpdateField}
            onPasswordReset={onPasswordReset}
            onInviteUser={isAdmin ? () => setInviteOpen(true) : undefined}
          />
        ) : (
          <EmptyDetailState
            count={users.length}
            onInviteUser={isAdmin ? () => setInviteOpen(true) : undefined}
          />
        )}
      </div>
    </div>
  );
}
