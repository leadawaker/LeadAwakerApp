import i18n from "i18next";

/** Hour of day as a grid label: "09:00" for nl and pt, "9am" / "1pm" for English. */
export function hourLabel(h: number): string {
  const lang = (i18n.language || "en").slice(0, 2);
  if (lang === "nl" || lang === "pt") return `${String(h).padStart(2, "0")}:00`;
  return `${h === 0 ? 12 : h <= 12 ? h : h - 12}${h < 12 ? "am" : "pm"}`;
}
