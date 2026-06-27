// Mock workspace data for the Missed-Call Text-Back inbox (first page).
// Replaced by real Interactions/Leads data when the page is wired to the API.
import type { MissedCall } from "./types";

const w = (n: number) => Array.from({ length: n }, () => 0.25 + Math.random() * 0.75);

export const VOICE_CALLS: MissedCall[] = [
  {
    id: "c1",
    name: "James Smith",
    phone: "(415) 555-0123",
    ini: "JS",
    status: "recovered",
    ago: "2 min",
    time: "9:42 AM",
    day: "Today",
    ageHours: 0.1,
    voicemail: {
      duration: "0:18",
      wave: w(44),
      transcript:
        "Hi, I was calling about getting a quote for solar panels on my roof. Could you give me a call back? Thanks.",
    },
    thread: [
      { id: "m1", from: "ai", auto: true, time: "9:42 AM", text: "Sorry we missed your call! This is Solar Co. How can we help?" },
      { id: "m2", from: "lead", time: "9:45 AM", text: "Yes I wanted a quote for solar" },
    ],
  },
  {
    id: "c2",
    name: "Maria Rodriguez",
    phone: "(415) 555-0188",
    ini: "MR",
    status: "booked",
    ago: "21 min",
    time: "9:23 AM",
    day: "Today",
    ageHours: 0.4,
    voicemail: {
      duration: "0:11",
      wave: w(34),
      transcript: "Hoi, ik wilde graag een afspraak inplannen voor volgende week. Bel me even terug alsjeblieft.",
    },
    thread: [
      { id: "m1", from: "ai", auto: true, time: "9:23 AM", text: "Sorry we missed your call! This is Solar Co. How can we help?" },
      { id: "m2", from: "lead", time: "9:31 AM", text: "I'd like to book a site visit" },
      { id: "m3", from: "ai", time: "9:31 AM", text: "Great — I have Thursday 14:00 or Friday 10:00 open. Which works?" },
      { id: "m4", from: "lead", time: "9:40 AM", text: "Thursday works" },
    ],
  },
  {
    id: "c3",
    name: "David Wilson",
    phone: "(415) 555-0142",
    ini: "DW",
    status: "recovered",
    ago: "1h",
    time: "8:30 AM",
    day: "Today",
    ageHours: 1.2,
    thread: [
      { id: "m1", from: "ai", auto: true, time: "8:30 AM", text: "Sorry we missed your call! This is Solar Co. How can we help?" },
      { id: "m2", from: "lead", time: "8:52 AM", text: "Just checking your opening hours" },
    ],
  },
  {
    id: "c4",
    name: "Sarah Lee",
    phone: "(415) 555-0177",
    ini: "SL",
    status: "texted",
    ago: "2h",
    time: "7:48 AM",
    day: "Today",
    ageHours: 2.3,
    voicemail: {
      duration: "0:24",
      wave: w(50),
      transcript: "Hello, I think there might be an issue with my last invoice, can someone reach out to me about it?",
    },
    thread: [
      { id: "m1", from: "ai", auto: true, time: "7:48 AM", text: "Sorry we missed your call! This is Solar Co. How can we help?" },
    ],
  },
  {
    id: "c5",
    name: "Brian Chen",
    phone: "(415) 555-0150",
    ini: "BC",
    status: "noreply",
    ago: "5h",
    time: "5:05 AM",
    day: "Today",
    ageHours: 5,
    thread: [
      { id: "m1", from: "ai", auto: true, time: "5:05 AM", text: "Sorry we missed your call! This is Solar Co. How can we help?" },
    ],
  },
  {
    id: "c6",
    name: "Amanda King",
    phone: "(415) 555-0199",
    ini: "AK",
    status: "recovered",
    ago: "Yesterday",
    time: "4:12 PM",
    day: "Yesterday",
    ageHours: 30,
    voicemail: {
      duration: "0:09",
      wave: w(28),
      transcript: "Hi, do you also install batteries with the panels? Call me back when you can.",
    },
    thread: [
      { id: "m1", from: "ai", auto: true, time: "4:12 PM", text: "Sorry we missed your call! This is Solar Co. How can we help?" },
      { id: "m2", from: "lead", time: "5:01 PM", text: "Do you do battery storage too?" },
    ],
  },
  {
    id: "c7",
    name: null,
    phone: "(415) 555-0164",
    ini: "?",
    status: "noreply",
    ago: "Yesterday",
    time: "11:20 AM",
    day: "Yesterday",
    ageHours: 35,
    thread: [
      { id: "m1", from: "ai", auto: true, time: "11:20 AM", text: "Sorry we missed your call! This is Solar Co. How can we help?" },
    ],
  },
];

export const VOICE_SUMMARY = {
  total: VOICE_CALLS.length,
  recovered: VOICE_CALLS.filter((c) => c.status === "recovered" || c.status === "booked").length,
  awaiting: VOICE_CALLS.filter((c) => c.status === "texted").length,
};

export const VOICE_BUSINESS = "Solar Co.";

// ── Dashboard (mock analytics for the 30-day window) ─────────────────
export const VOICE_DASH = {
  range: "Last 30 days",
  kpis: {
    missed:    { value: "128", delta: "12%", dir: "down" as const },
    recovered: { value: "86",  delta: "18%", dir: "up" as const },
    rate:      { value: "67",  suffix: "%", delta: "12%", dir: "up" as const },
    bookings:  { value: "19",  delta: "27%", dir: "up" as const },
  },
  // Two daily series across the window — recovered tracks below missed.
  daily: {
    axis: ["Apr 27", "May 1", "May 5", "May 9", "May 13", "May 19"],
    missed:    [4, 3, 6, 5, 7, 4, 6, 8, 5, 4, 6, 7, 9, 6, 5, 7, 4, 6, 8, 5, 7, 6, 4, 5],
    recovered: [3, 2, 4, 4, 5, 3, 4, 6, 3, 3, 4, 5, 6, 4, 4, 5, 3, 4, 6, 4, 5, 4, 3, 4],
  },
  weekly: {
    axis: ["Wk 1", "Wk 2", "Wk 3", "Wk 4"],
    missed:    [31, 28, 38, 31],
    recovered: [20, 19, 26, 21],
  },
  funnel: [
    { key: "call",   label: "Call",            value: 128, pct: null },
    { key: "text",   label: "Text-back sent",  value: 112, pct: 88 },
    { key: "reply",  label: "Reply",           value: 86,  pct: 67 },
    { key: "booked", label: "Booked",          value: 19,  pct: 22 },
  ] as { key: string; label: string; value: number; pct: number | null }[],
};

// Recent recoveries on the dashboard reuse the inbox calls (recovered + booked).
export const VOICE_RECENT_RECOVERIES = VOICE_CALLS
  .filter((c) => c.status === "recovered" || c.status === "booked")
  .slice(0, 4);
