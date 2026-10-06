// Scratch notes for the onboarding call, pinned to the bottom of the screen so
// they stay in view while the wizard moves. They live in the account's own
// internal `notes` field (the one the account dialog and table already edit),
// so they never reach the knowledge base or the AI, and autosave as you type.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Check, Loader2, NotebookPen } from "lucide-react";
import type { AccountRow } from "../types";

const COLLAPSE_KEY = "la.callNotes.collapsed";
const SAVE_DELAY_MS = 800;

function readCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
}

export function CallNotes({ account, onSave }: { account: AccountRow; onSave: (field: string, value: string, opts?: { silent?: boolean }) => Promise<void> }) {
  const { t } = useTranslation("communicationProfile");
  const saved = String((account as { notes?: string | null }).notes ?? "");
  const [text, setText] = useState(saved);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const lastSaved = useRef(saved);
  const latest = useRef(text);
  latest.current = text;

  // Another account selected: start from its notes, drop any pending save.
  useEffect(() => {
    clearTimeout(timer.current);
    setText(saved);
    lastSaved.current = saved;
    setState("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id]);

  const flush = async () => {
    clearTimeout(timer.current);
    const value = latest.current;
    if (value === lastSaved.current) return;
    setState("saving");
    try {
      await onSave("notes", value, { silent: true });
      lastSaved.current = value;
      setState("saved");
    } catch {
      setState("idle");
    }
  };

  // Leaving the tab mid-sentence must not lose the last words.
  useEffect(() => () => { void flush(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (value: string) => {
    setText(value);
    setState("idle");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, SAVE_DELAY_MS);
  };

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch { /* storage blocked: fine */ }
  };

  return (
    <div
      className="neu-raised"
      style={{ position: "sticky", bottom: 12, zIndex: 5, borderRadius: "var(--r-card)", background: "var(--bone)", padding: "12px 18px" }}
    >
      <button
        onClick={toggle}
        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "transparent", border: 0, cursor: "pointer", padding: 0 }}
      >
        <NotebookPen size={15} style={{ color: "var(--ink-soft)" }} />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{t("callNotes.title")}</span>
        <span style={{ flex: 1, textAlign: "left", fontSize: 11.5, color: "var(--mute-2)" }}>{t("callNotes.hint")}</span>
        {state === "saving" && <Loader2 size={13} className="animate-spin" style={{ color: "var(--mute-2)" }} />}
        {state === "saved" && <Check size={13} style={{ color: "var(--mute-2)" }} />}
        <ChevronDown size={15} style={{ color: "var(--mute-2)", transform: collapsed ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
      </button>
      {!collapsed && (
        <textarea
          value={text}
          onChange={(e) => change(e.target.value)}
          onBlur={() => { void flush(); }}
          placeholder={t("callNotes.placeholder")}
          rows={5}
          style={{ marginTop: 10, width: "100%", resize: "vertical", padding: "10px 13px", borderRadius: "var(--r-button)", border: "none", background: "var(--bg)", color: "var(--ink-soft)", fontSize: 13.5, lineHeight: 1.5, fontFamily: "inherit" }}
        />
      )}
    </div>
  );
}
