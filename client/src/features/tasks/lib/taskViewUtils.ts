import { useEffect } from "react";
import type { Task } from "../types";

// ── Desktop/mobile quick filter ──────────────────────────────────────
export type DesktopFilter = 'all' | 'next7' | 'overdue' | 'waiting' | 'completed';

// Assignee avatar backgrounds (shown behind transparent profile photos).
// First user (Gabriel) dark red, second (Finn) dark purple, then fallbacks.
export const AVATAR_BG = ['#5E2230', '#3D2A66', '#2F5E4A', '#5E4A22'];

// ── localStorage helpers ─────────────────────────────────────────────
export function loadLocal<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveLocal(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

// One-time deep-link consume: reads a raw (non-JSON) id set by e.g. a notification
// click, then clears it so it doesn't keep reopening on later visits.
export function consumeSelectedId(key: string): number | null {
  try {
    const v = localStorage.getItem(key);
    if (v) localStorage.removeItem(key);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

// Live counterpart to consumeSelectedId: catches a "selected-task-id" set while
// this view is already mounted (e.g. clicking a task notification while already
// on the Tasks page), since a same-route navigation doesn't remount the component
// and so never re-runs the lazy useState(() => consumeSelectedId(...)) initializer.
export function useSelectedTaskListener(key: string, onSelect: (id: number) => void) {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.key !== key) return;
      try { localStorage.removeItem(key); } catch {}
      onSelect(Number(detail.id));
    };
    window.addEventListener("persisted-selection", handler);
    return () => window.removeEventListener("persisted-selection", handler);
  }, [key, onSelect]);
}

// ── Today as YYYY-MM-DD (local) ──────────────────────────────────────
export function getTodayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// ── Quick-filter logic shared by desktop + mobile ────────────────────
export function applyDesktopFilter(tasks: Task[], filter: DesktopFilter, todayISO: string): Task[] {
  const [ty, tm, td] = todayISO.split('-').map(Number);
  const today = new Date(Date.UTC(ty, tm - 1, td));
  const in7 = new Date(Date.UTC(ty, tm - 1, td + 7));
  const dueUTC = (raw: any) => { const d = new Date(raw); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); };

  return tasks.filter(t => {
    switch (filter) {
      case 'next7':
        return t.status !== 'done' && !!t.dueDate && dueUTC(t.dueDate) >= today && dueUTC(t.dueDate) < in7;
      case 'overdue':
        return t.status !== 'done' && !!t.dueDate && dueUTC(t.dueDate) < today;
      case 'waiting':   return t.status === 'waiting';
      case 'completed': return t.status === 'done';
      default:          return true;
    }
  });
}
