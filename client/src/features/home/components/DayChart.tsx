import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DayPoint, HomeBucket } from "@shared/homeTypes";

const DATE_LOCALE: Record<string, string> = { en: "en-US", pt: "pt-BR", nl: "nl-NL" };

/** Bucket keys are YYYY-MM, YYYY-MM-DD or YYYY-MM-DD HH (see DayPoint). */
function bucketLabel(key: string, bucket: HomeBucket, locale: string, long: boolean, multiYear: boolean): string {
  if (bucket === "hour") return long ? `${key.slice(11, 13)}:00` : key.slice(11, 13);
  const [y, m, d] = key.split(/[- ]/).map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  if (bucket === "month") {
    return date.toLocaleDateString(locale, { month: long ? "long" : "short", ...(long || multiYear ? { year: "numeric" } : {}), timeZone: "UTC" });
  }
  return long ? date.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : String(d);
}

export function DayChart({ data, label, bucket = "day", secondary }: {
  data: DayPoint[];
  label: string;
  bucket?: HomeBucket;
  secondary?: { data: DayPoint[]; label: string };
}) {
  const gradId = useId();
  const { i18n } = useTranslation();
  const locale = DATE_LOCALE[i18n.language?.split("-")[0] ?? "en"] ?? "en-US";
  const multiYear = bucket === "month" && data.length > 0 && data[0].day.slice(0, 4) !== data[data.length - 1].day.slice(0, 4);
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
          <XAxis dataKey="day" tickFormatter={(d: string) => bucketLabel(d, bucket, locale, false, multiYear)}
            tick={tick} tickLine={false} axisLine={false} minTickGap={8} />
          <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip labelFormatter={(d) => bucketLabel(String(d), bucket, locale, true, multiYear)}
            contentStyle={{ borderRadius: "10px", border: "1px solid var(--line)", backgroundColor: "var(--card)", color: "var(--ink)", fontSize: "11px", padding: "6px 10px" }} />
          <Area type="monotone" dataKey={label} stroke="var(--wine)" strokeWidth={2} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 3 }} />
          {secondary && (
            <Area type="monotone" dataKey={secondary.label} stroke="var(--mute-2)" strokeWidth={1.25} fill="none" dot={false} activeDot={{ r: 3 }} />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
