// A folded row: only its title (and a short note beside it) shows until it is clicked open.
// The call review, the change cards and the coach are three of these in one card under the
// prompt, so the section stays a few lines tall until something is opened. Whether a row is
// open is remembered in this browser (`rememberAs`), never needed: storage may be unavailable.
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

const KEY_PREFIX = "voice-fold:";

function readOpen(key: string | undefined): boolean {
  if (!key) return false;
  try { return window.localStorage.getItem(KEY_PREFIX + key) === "1"; } catch { return false; }
}

function writeOpen(key: string | undefined, open: boolean) {
  if (!key) return;
  try { window.localStorage.setItem(KEY_PREFIX + key, open ? "1" : "0"); } catch { /* per-viewer convenience only */ }
}

export function Fold({ title, note, icon, rememberAs, size = "section", testId, children }: {
  title: ReactNode; note?: ReactNode; icon?: ReactNode; rememberAs?: string;
  size?: "section" | "item"; testId?: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen(rememberAs));
  const toggle = () => setOpen((v) => { writeOpen(rememberAs, !v); return !v; });
  const section = size === "section";
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }} data-testid={testId} data-open={open}>
      <button
        type="button" onClick={toggle} aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: section ? 44 : 36, padding: 0,
          background: "none", border: 0, cursor: "pointer", textAlign: "left", color: "var(--ink)",
        }}
      >
        <span style={{ color: "var(--mute)", display: "flex", flexShrink: 0 }}>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        {icon && <span style={{ color: "var(--wine)", display: "flex", flexShrink: 0 }}>{icon}</span>}
        <span style={{ fontSize: section ? 14.5 : 13.5, fontWeight: 700, lineHeight: 1.3, minWidth: 0, overflowWrap: "anywhere" }}>{title}</span>
        {note != null && (
          <span style={{ marginLeft: "auto", paddingLeft: 8, fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.06em", color: "var(--mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
            {note}
          </span>
        )}
      </button>
      {open && <div style={{ padding: section ? "6px 0 14px" : "2px 0 8px 22px", minWidth: 0 }}>{children}</div>}
    </div>
  );
}
