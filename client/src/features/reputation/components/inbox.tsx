import { useState, useEffect, useMemo } from "react";
import { Layers, ListFilter } from "lucide-react";
import type { AutoRule, InboxSelection, Review } from "../types";
import { repAutoPosts, repAgeHours, repDelayLabel } from "../utils";
import { REP_DATA } from "../data";
import {
  IconSpark, IconSort, IconChev,
  RepListCard,
} from "./atoms";
import { RepReviewDetail } from "./reviewDetail";
import { RepFeedbackListCard, RepFeedbackDetail } from "./feedback";

export type RepView = { key: string; label: string; count: number | null; spark?: boolean };

// ── Derived lists (single source of truth for auto-post split) ───
export function getRepInboxLists(auto: AutoRule, autoMode: boolean) {
  const needsAll = REP_DATA.reviews.filter((r) => r.status === "needs");
  const autoList = needsAll.filter((r) => autoMode && repAutoPosts(r, auto));
  const heldList = needsAll.filter((r) => !autoMode || !repAutoPosts(r, auto));
  return { needsAll, autoList, heldList, heldCount: heldList.length, autoCount: autoList.length };
}

export function getRepViews(autoMode: boolean, heldCount: number, autoCount: number): RepView[] {
  const S = REP_DATA.summary;
  return autoMode
    ? [
        { key: "needs", label: "Needs attention", count: heldCount },
        { key: "autoreplied", label: "Auto-replied", count: autoCount, spark: true },
        { key: "all", label: "All activity", count: null },
      ]
    : [
        { key: "needs", label: "Needs reply", count: S.needsReply },
        { key: "replied", label: "Replied", count: S.replied },
        { key: "all", label: "All activity", count: null },
      ];
}

// ── Grouping / filter option sets ────────────────────────────────
export const REP_GROUPS = [
  { key: "recent", label: "Most recent" },
  { key: "rating", label: "Rating" },
  { key: "status", label: "Status" },
  { key: "none", label: "None" },
] as const;

export const REP_FILTERS = [
  { key: "all", label: "All ratings" },
  { key: "neg", label: "Negative · 1–2★" },
  { key: "neu", label: "Neutral · 3★" },
  { key: "pos", label: "Positive · 4–5★" },
] as const;

const REP_SORTS = [
  { key: "lowest", label: "Lowest rating first" },
  { key: "newest", label: "Newest first" },
] as const;

// ── List item shape + grouping ───────────────────────────────────
type RepItem = { kind: "review" | "feedback"; id: string; ref: Review | (typeof REP_DATA.feedback.intercepted)[0]; age: number };
const ratingOf = (it: RepItem): number | null => ("rating" in it.ref ? it.ref.rating : null);

function groupRepItems(items: RepItem[], group: string): { key: string; label: string | null; items: RepItem[] }[] {
  if (group === "none") return [{ key: "all", label: null, items }];
  const make = (defs: { key: string; label: string; test: (it: RepItem) => boolean }[]) => {
    const sections = defs.map((d) => ({ key: d.key, label: d.label, items: [] as RepItem[] }));
    items.forEach((it) => {
      const idx = defs.findIndex((d) => d.test(it));
      if (idx >= 0) sections[idx].items.push(it);
    });
    return sections.filter((s) => s.items.length > 0);
  };
  if (group === "rating")
    return make([
      { key: "neg", label: "Negative · 1–2★", test: (it) => (ratingOf(it) ?? 0) <= 2 },
      { key: "neu", label: "Neutral · 3★", test: (it) => ratingOf(it) === 3 },
      { key: "pos", label: "Positive · 4–5★", test: (it) => (ratingOf(it) ?? 0) >= 4 },
    ]);
  if (group === "status")
    return make([
      { key: "needs", label: "Needs reply", test: (it) => it.kind === "feedback" || ("status" in it.ref && it.ref.status === "needs") },
      { key: "replied", label: "Replied", test: (it) => "status" in it.ref && it.ref.status === "replied" },
    ]);
  // recent (default): bucket by age of the review
  return make([
    { key: "today", label: "Today", test: (it) => it.age < 24 },
    { key: "week", label: "This week", test: (it) => it.age < 168 },
    { key: "earlier", label: "Earlier", test: () => true },
  ]);
}

// ── Google not connected ─────────────────────────────────────────
function RepConnectCard() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div className="neu-raised" style={{ maxWidth: 440, borderRadius: "var(--r-panel)", background: "var(--card)", padding: "36px 34px", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, margin: "0 auto 20px", borderRadius: "var(--r-card)", background: "var(--surface)", boxShadow: "var(--sh-raised-medium)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontWeight: 700, fontSize: 26, color: "var(--wine)" }}>G</div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 26, color: "var(--ink)", lineHeight: 1.15, marginBottom: 10 }}>Connect Google Business Profile</div>
        <p style={{ margin: "0 0 22px", fontSize: 13.5, lineHeight: 1.6, color: "var(--mute)" }}>
          Link your Google Business Profile to monitor incoming reviews and reply to them — with AI-drafted, human-approved responses — without leaving Lead Awaker.
        </p>
        <button className="la-btn la-btn--wine la-btn--lg" style={{ margin: "0 auto" }}>Connect with Google</button>
        <div style={{ marginTop: 16, fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mute-2)" }}>Read &amp; reply access · revoke anytime</div>
      </div>
    </div>
  );
}

// ── All caught up ────────────────────────────────────────────────
function RepCaughtUp() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 40 }}>
      <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--good-tint)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--good)" }}>
        <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M20 6 9 17l-5-5" /></svg>
      </div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 26, color: "var(--ink)" }}>All caught up</div>
      <p style={{ margin: 0, fontSize: 13.5, color: "var(--mute)", textAlign: "center", maxWidth: 320, lineHeight: 1.6 }}>Every review has a reply. New ones will appear here the moment they land on Google.</p>
    </div>
  );
}

// ── Small popover ────────────────────────────────────────────────
function RepPopover({ open, children, width = 200 }: { open: boolean; children: React.ReactNode; width?: number }) {
  if (!open) return null;
  return (
    <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 40, width, background: "var(--card)", borderRadius: "var(--r-card)", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: "1px solid var(--line)", padding: 6 }}>
      {children}
    </div>
  );
}

function RepMenuItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", border: "none", cursor: "pointer", borderRadius: "var(--r-button)", background: active ? "var(--wine-tint)" : "transparent", fontFamily: "var(--sans)", fontSize: 13, fontWeight: active ? 600 : 500, color: active ? "var(--wine)" : "var(--ink-soft)" }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg)"; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
      {children}
    </button>
  );
}

// ── Generic dropdown control (group / sort / filter) ─────────────
function RepDropdown<T extends { key: string; label: string }>({ icon, options, value, onSelect, width = 210 }: { icon: React.ReactNode; options: readonly T[]; value: string; onSelect: (k: string) => void; width?: number }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.key === value);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} className="la-btn la-btn--inset" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <span style={{ display: "flex", color: "var(--mute)" }}>{icon}</span>
        <span style={{ fontSize: 12, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>{current?.label}</span>
        <IconChev size={12} style={{ color: "var(--mute-2)" }} />
      </button>
      <RepPopover open={open} width={width}>
        {options.map((o) => (
          <RepMenuItem key={o.key} active={value === o.key} onClick={() => { onSelect(o.key); setOpen(false); }}>{o.label}</RepMenuItem>
        ))}
      </RepPopover>
    </div>
  );
}

// ── Topbar view filters + group / sort / filter ──────────────────
export function RepInboxTopControls({ views, view, setView, group, setGroup, sort, setSort, filter, setFilter }: {
  views: RepView[]; view: string; setView: (v: string) => void;
  group: string; setGroup: (v: string) => void;
  sort: string; setSort: (v: string) => void;
  filter: string; setFilter: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {views.map((v) => {
        const on = view === v.key;
        return (
          <button key={v.key} onClick={() => setView(v.key)} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", border: "none", padding: "6px 11px", borderRadius: "var(--r-pill)", transition: "all 120ms", fontFamily: "var(--sans)", fontSize: 12, fontWeight: on ? 700 : 500, background: on ? "var(--card)" : "transparent", color: on ? "var(--wine)" : "var(--mute)", boxShadow: on ? "var(--sh-raised-crisp)" : "none", whiteSpace: "nowrap" }}>
            {v.spark && <IconSpark size={11} />}
            {v.label}
            {v.count != null && <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, padding: "0 5px", borderRadius: "var(--r-pill)", display: "inline-flex", alignItems: "center", justifyContent: "center", background: on ? "var(--wine-tint)" : "var(--bg)", boxShadow: on ? "none" : "var(--sh-inset-crisp)", color: on ? "var(--wine)" : "var(--mute)" }}>{v.count}</span>}
          </button>
        );
      })}

      <span style={{ width: 1, alignSelf: "stretch", margin: "4px 2px", background: "var(--line)" }} />

      <RepDropdown icon={<Layers size={13} />} options={REP_GROUPS} value={group} onSelect={setGroup} width={180} />
      <RepDropdown icon={<IconSort size={13} />} options={REP_SORTS} value={sort} onSelect={setSort} width={190} />
      <RepDropdown icon={<ListFilter size={13} />} options={REP_FILTERS} value={filter} onSelect={setFilter} width={190} />
    </div>
  );
}

// ── Group header (left list pane) ────────────────────────────────
function RepGroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 8px 5px" }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, color: "var(--mute-2)" }}>{count}</span>
      <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
    </div>
  );
}

// ── Inbox tab ────────────────────────────────────────────────────
export function RepInbox({ state, selection, setSelection, autoMode, auto, query, view, group, sort, filter }: { state: "connected" | "disconnected" | "caughtup"; selection: InboxSelection | null; setSelection: (s: InboxSelection | null) => void; autoMode: boolean; auto: AutoRule; query: string; view: string; group: string; sort: string; filter: string }) {
  const D = REP_DATA;

  const { autoList, heldList } = getRepInboxLists(auto, autoMode);

  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1600);
  useEffect(() => {
    const onR = () => setVw(window.innerWidth);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  const narrow = vw < 920;

  const items = useMemo<RepItem[]>(() => {
    const fbs = D.feedback.intercepted;
    let list: RepItem[] = [];
    if (view === "needs") list = heldList.map((r) => ({ kind: "review" as const, id: r.id, ref: r, age: repAgeHours(r.ago) }));
    else if (view === "autoreplied") list = autoList.map((r) => ({ kind: "review" as const, id: r.id, ref: r, age: repAgeHours(r.ago) }));
    else if (view === "replied") list = D.reviews.filter((r) => r.status === "replied").map((r) => ({ kind: "review" as const, id: r.id, ref: r, age: repAgeHours(r.ago) }));
    else {
      list = [
        ...heldList.map((r) => ({ kind: "review" as const, id: r.id, ref: r, age: repAgeHours(r.ago) })),
        ...autoList.map((r) => ({ kind: "review" as const, id: r.id, ref: r, age: repAgeHours(r.ago) })),
        ...fbs.map((f) => ({ kind: "feedback" as const, id: f.id, ref: f, age: repAgeHours(f.ago) })),
        ...D.reviews.filter((r) => r.status === "replied").map((r) => ({ kind: "review" as const, id: r.id, ref: r, age: repAgeHours(r.ago) })),
      ];
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((it) => it.ref.name.toLowerCase().includes(q) || (it.ref.text ?? "").toLowerCase().includes(q));
    }
    if (filter !== "all") {
      list = list.filter((it) => {
        const r = ratingOf(it) ?? 0;
        return filter === "neg" ? r <= 2 : filter === "neu" ? r === 3 : r >= 4;
      });
    }
    list.sort((a, b) => sort === "lowest"
      ? ((ratingOf(a) ?? 0) - (ratingOf(b) ?? 0)) || (a.age - b.age)
      : a.age - b.age);
    return list;
  }, [view, query, sort, filter, autoMode, JSON.stringify(auto)]);

  const sections = useMemo(() => groupRepItems(items, group), [items, group]);

  const resolved = selection
    ? (selection.kind === "review"
        ? D.reviews.find((r) => r.id === selection.id) ?? null
        : D.feedback.intercepted.find((f) => f.id === selection.id) ?? null)
    : null;
  const resolvedAutoPosted = !!(resolved && selection?.kind === "review" && "status" in resolved && resolved.status === "needs" && autoMode && repAutoPosts(resolved as Review, auto));

  // Open straight onto the first item — desktop only.
  useEffect(() => {
    if (narrow) return;
    if (!resolved && items.length > 0) {
      setSelection({ kind: items[0].kind, id: items[0].id });
    }
  }, [narrow, resolved, items, setSelection]);

  if (state === "disconnected") {
    return (
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "var(--bg)" }}>
        <RepConnectCard />
      </div>
    );
  }

  const listPane = (
    <div style={{ width: narrow ? "100%" : 348, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0, borderRight: narrow ? "none" : "1px solid var(--line)", background: "var(--surface)" }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "6px 10px 12px" }}>
        {state === "caughtup" && view === "needs"
          ? <RepCaughtUp />
          : items.length === 0
          ? <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)", padding: 40 }}>Nothing here</div>
          : sections.map((sec) => (
              <div key={sec.key}>
                {sec.label && <RepGroupHeader label={sec.label} count={sec.items.length} />}
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {sec.items.map((it) =>
                    it.kind === "review"
                      ? <RepListCard key={it.id} review={it.ref as Review} active={!!(selection && selection.kind === "review" && selection.id === it.id)} onClick={() => setSelection({ kind: "review", id: it.id })} autoPosted={autoMode && "status" in it.ref && it.ref.status === "needs" && repAutoPosts(it.ref as Review, auto)} />
                      : <RepFeedbackListCard key={it.id} item={it.ref as (typeof D.feedback.intercepted)[0]} active={!!(selection && selection.kind === "feedback" && selection.id === it.id)} onClick={() => setSelection({ kind: "feedback", id: it.id })} />
                  )}
                </div>
              </div>
            ))}
      </div>
    </div>
  );

  const rightPane = (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)" }}>
      {autoMode && (
        <div style={{ margin: "14px 20px 0", display: "flex", alignItems: "center", gap: 10, background: "var(--wine-tint)", borderRadius: "var(--r-surface)", padding: "9px 14px", flexShrink: 0 }}>
          <span style={{ display: "flex", color: "var(--wine)" }}><IconSpark size={15} /></span>
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}><strong>{auto.threshold}★+ replies post automatically</strong> after {repDelayLabel(auto.delay)}. Only held exceptions — low stars{auto.confidenceHold ? " and low-confidence drafts" : ""} — wait here for you.</span>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {narrow && resolved && (
          <button onClick={() => setSelection(null)} className="la-btn la-btn--soft" style={{ margin: "12px 0 0 14px", alignSelf: "flex-start" }}>‹ Back</button>
        )}
        {!resolved
          ? <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)" }}>Select a review</div>
          : selection?.kind === "review"
            ? <RepReviewDetail review={resolved as Review} autoPosted={resolvedAutoPosted} autoDelay={auto.delay} />
            : <RepFeedbackDetail item={resolved as (typeof D.feedback.intercepted)[0]} />}
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden", background: "var(--bg)" }}>
      {narrow ? (resolved ? rightPane : listPane) : <>{listPane}{rightPane}</>}
    </div>
  );
}
