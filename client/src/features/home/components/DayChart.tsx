import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DayPoint } from "@shared/homeTypes";

export function DayChart({ data, label, secondary }: {
  data: DayPoint[];
  label: string;
  secondary?: { data: DayPoint[]; label: string };
}) {
  const gradId = useId();
  const secondaryByDay = new Map((secondary?.data ?? []).map((p) => [p.day, p.value]));
  const rows = data.map((p) => ({
    day: p.day,
    [label]: p.value,
    ...(secondary ? { [secondary.label]: secondaryByDay.get(p.day) ?? 0 } : {}),
  }));
  const tick = { fontSize: 10, fill: "var(--mute-2)" };
  return (
    <div role="img" aria-label={label} style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 15, right: 4, bottom: 0, left: -39 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--wine)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--wine)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(8)} tick={tick} tickLine={false} axisLine={false} />
          <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid var(--line)", backgroundColor: "var(--card)", color: "var(--ink)", fontSize: "11px", padding: "6px 10px" }} />
          <Area type="monotone" dataKey={label} stroke="var(--wine)" strokeWidth={2} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 3 }} />
          {secondary && (
            <Area type="monotone" dataKey={secondary.label} stroke="var(--mute-2)" strokeWidth={1.25} fill="none" dot={false} activeDot={{ r: 3 }} />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
