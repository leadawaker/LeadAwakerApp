import * as React from "react";

/**
 * Home-hub inline icon set (stroke 1.6, 24-box) — ported from the Claude Design
 * mockup so the hub keeps its custom glyphs (handoff, bolt, calbook…) without
 * pulling a second icon library. All strokes use `currentColor`, so color comes
 * from the parent via CSS tokens (dark-mode safe).
 */
export type HomeIconName =
  | "home"
  | "refresh"
  | "star"
  | "bolt"
  | "mail"
  | "chat"
  | "users"
  | "alert"
  | "handoff"
  | "clock"
  | "send"
  | "import"
  | "phone"
  | "branch"
  | "arrow"
  | "trendUp"
  | "trendDn"
  | "cal"
  | "calbook"
  | "plus";

const PATHS: Record<HomeIconName, React.ReactNode> = {
  home: <><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></>,
  refresh: <><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8" /><path d="M20 4v4h-4" /><path d="M20 12a8 8 0 0 1-13.7 5.6L4 16" /><path d="M4 20v-4h4" /></>,
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z" />,
  bolt: <path d="M13 3 5 13h6l-1 8 8-10h-6z" />,
  mail: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m4 7 8 5 8-5" /></>,
  chat: <path d="M4 5h16v11H8l-4 4z" />,
  users: <><circle cx="9" cy="9" r="3.2" /><path d="M3 19c1.2-3 3.6-4.4 6-4.4s4.8 1.4 6 4.4" /><circle cx="17.5" cy="7.5" r="2.2" /><path d="M15 15c.8-1.4 2.2-2 3.5-2s2.4.5 3.2 1.4" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5" /><circle cx="12" cy="16" r=".7" fill="currentColor" stroke="none" /></>,
  handoff: <><circle cx="8" cy="8" r="3" /><path d="M2.5 19c.8-3 3-4.4 5.5-4.4 1.2 0 2.3.3 3.2.9" /><path d="M14 13h6m0 0-2.5-2.5M20 13l-2.5 2.5" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  send: <><path d="M21 4 3 11l6 2.5L21 4z" /><path d="m9 13.5 2.5 6L21 4" /></>,
  import: <><path d="M12 3v11m0 0 4-4m-4 4-4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>,
  phone: <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 14l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  branch: <><circle cx="6" cy="6" r="2.4" /><circle cx="6" cy="18" r="2.4" /><circle cx="18" cy="12" r="2.4" /><path d="M6 8.4v7.2M8.2 6.6c4 0 4 5.4 7.6 5.4M8.2 17.4c4 0 4-5.4 7.6-5.4" /></>,
  arrow: <path d="M5 12h14m0 0-5-5m5 5-5 5" />,
  trendUp: <><path d="M4 16 10 10l3 3 7-7" /><path d="M20 6v5h-5" /></>,
  trendDn: <><path d="M4 8 10 14l3-3 7 7" /><path d="M20 18v-5h-5" /></>,
  cal: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M8 2v4M16 2v4" /></>,
  calbook: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M8 2v4M16 2v4" /><rect x="9.5" y="12" width="5" height="4" rx="0.8" fill="currentColor" stroke="none" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
};

export function HomeIcon({
  name,
  size = 18,
  sw = 1.6,
}: {
  name: HomeIconName;
  size?: number;
  sw?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
      aria-hidden="true"
    >
      {PATHS[name] ?? PATHS.home}
    </svg>
  );
}
