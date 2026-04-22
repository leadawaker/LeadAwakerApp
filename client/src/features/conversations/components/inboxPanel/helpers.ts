import type { Lead, Interaction } from "./types";

export function getLeadTagNames(lead: Lead): string[] {
  const raw = lead.tags;
  if (!raw) return [];
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return []; }
  }
  if (Array.isArray(raw)) {
    return raw.map((t: any) => typeof t === "string" ? t : t?.name ?? "").filter(Boolean);
  }
  return [];
}

export function getLastMessageDisplay(last: Interaction | undefined): string {
  if (!last) return "";
  const content = last.content ?? last.Content ?? "";
  const attachment = last.attachment ?? last.Attachment;
  if (attachment && !content) {
    if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)/i.test(attachment)) return "Image";
    if (/\.(mp4|mov|avi|webm)/i.test(attachment)) return "Video";
    if (/\.(mp3|wav|ogg|aac)/i.test(attachment)) return "🎵 Voice message";
    return "File";
  }
  return content;
}

export function getDateGroupLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return "No Activity";
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
    if (diff <= 0)  return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7)   return "This Week";
    if (diff < 30)  return "This Month";
    if (diff < 90)  return "Last 3 Months";
    return "Older";
  } catch { return "No Activity"; }
}
