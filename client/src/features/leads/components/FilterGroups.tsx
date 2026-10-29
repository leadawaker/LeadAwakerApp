// Collapsible categories for the Leads and Chats topbar menus (Filter, Group,
// Settings). Every group starts folded and opens on click, so a long menu shows
// only its categories. A group can show a small wine count (active filters) or
// a muted value (the picked option, e.g. "8/14" fields or the current grouping).
// MenuGroup: inside a DropdownMenuContent (desktop topbars).
// MobileMenuGroup: inside a phone drawer or sheet.
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

function ActiveCount({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span
      className="tabular-nums shrink-0"
      style={{ minWidth: 16, height: 16, padding: "0 5px", borderRadius: "var(--r-pill)", background: "var(--wine)", color: "var(--on-wine)", fontSize: 10, fontWeight: 700, lineHeight: "16px", textAlign: "center" }}
    >
      {count}
    </span>
  );
}

function HeaderValue({ value }: { value?: string }) {
  if (!value) return null;
  return (
    <span className="tabular-nums shrink-0 truncate" style={{ maxWidth: 96, color: "var(--mute)", fontSize: 11, fontWeight: 500 }}>
      {value}
    </span>
  );
}

function Chevron({ open, size }: { open: boolean; size: number }) {
  return (
    <ChevronRight
      aria-hidden="true"
      className="shrink-0 transition-transform duration-150"
      style={{ width: size, height: size, color: "var(--mute)", transform: open ? "rotate(90deg)" : undefined }}
    />
  );
}

/** One folded category in a dropdown menu. The header toggles it without closing the menu. */
export function MenuGroup({ label, count, value, children, testId }: {
  label: string;
  /** Active filters in this group (0 or undefined: no badge). */
  count?: number;
  /** Muted text after the label, e.g. the picked option or "8/14". */
  value?: string;
  children: React.ReactNode;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DropdownMenuItem
        onSelect={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-[12px] font-semibold"
        data-testid={testId}
      >
        <Chevron open={open} size={13} />
        <span className="flex-1 truncate">{label}</span>
        <HeaderValue value={value} />
        <ActiveCount count={count} />
      </DropdownMenuItem>
      {open && <div className="pl-3">{children}</div>}
    </>
  );
}

/** One folded category in a phone drawer or sheet (44px tap row). */
export function MobileMenuGroup({ label, count, value, children, testId }: {
  label: string;
  count?: number;
  value?: string;
  children: React.ReactNode;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-testid={testId}
        className="flex items-center gap-2 w-full text-left"
        style={{ minHeight: 44, padding: "8px 4px", border: "none", background: "transparent", cursor: "pointer", color: "var(--ink)", fontSize: 13, fontWeight: 700, borderBottom: "1px solid var(--line)" }}
      >
        <Chevron open={open} size={15} />
        <span className="flex-1 truncate">{label}</span>
        <HeaderValue value={value} />
        <ActiveCount count={count} />
      </button>
      {open && <div style={{ display: "flex", flexDirection: "column", paddingLeft: 8 }}>{children}</div>}
    </>
  );
}
