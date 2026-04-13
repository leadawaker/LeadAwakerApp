import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Phone,
  FileText,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Mail,
  MessageSquare,
  Pencil,
  Paperclip,
} from "lucide-react";
import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";

// ── Types ────────────────────────────────────────────────────────────────────

interface EmailMetadata {
  gmailMessageId?: string;
  gmailThreadId?: string;
  subject?: string;
  from?: string;
  to?: string;
  cc?: string;
  snippet?: string;
  labels?: string[];
  attachmentCount?: number;
  fromEmail?: string;
  toEmail?: string;
}

interface Interaction {
  id: number;
  prospect_id: number;
  type: "email" | "sms" | "call" | "note" | "whatsapp";
  direction: "inbound" | "outbound";
  content: string;
  metadata?: EmailMetadata & Record<string, unknown>;
  created_at: string;
  sent_at?: string;
  conversation_thread_id?: string;
  status?: string;
}

interface InteractionTimelineProps {
  prospectId: number;
  onReply?: (context: { messageId: string; threadId: string; subject: string }) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDirectionIcon(type: string, direction: string) {
  if (type === "call") return Phone;
  if (type === "note") return FileText;
  if (type === "whatsapp") return MessageSquare;
  if (type === "email") return Mail;
  if (direction === "outbound") return ArrowUpRight;
  return ArrowDownLeft;
}

function getTypeBadgeStyle(type: string): { bg: string; text: string } {
  switch (type) {
    case "email": return { bg: "bg-blue-100/80 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400" };
    case "sms":   return { bg: "bg-emerald-100/80 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-400" };
    case "call":  return { bg: "bg-violet-100/80 dark:bg-violet-900/30", text: "text-violet-600 dark:text-violet-400" };
    case "note":     return { bg: "bg-amber-100/80 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400" };
    case "whatsapp": return { bg: "bg-green-100/80 dark:bg-green-900/30", text: "text-green-600 dark:text-green-400" };
    default:         return { bg: "bg-muted", text: "text-muted-foreground" };
  }
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins <= 1 ? "just now" : `${diffMins}m ago`;
    }
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function getTimestamp(item: Interaction): string {
  return item.sent_at || item.created_at;
}

/** Strip HTML to plain text for snippet preview */
function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

const INTERACTION_TYPES = ["email", "sms", "call", "note", "whatsapp"] as const;
const DIRECTIONS = ["outbound", "inbound"] as const;
const PAGE_SIZE = 20;

// ── Email Card ───────────────────────────────────────────────────────────────

function EmailCard({
  item,
  isExpanded,
  isSelected,
  onToggleExpand,
  onToggleSelect,
  onReply,
  t,
}: {
  item: Interaction;
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onReply?: () => void;
  t: ReturnType<typeof import("react-i18next").useTranslation>["t"];
}) {
  const meta = item.metadata as EmailMetadata | undefined;
  const subject = meta?.subject || t("slidePanel.email.noSubject");
  const isOut = item.direction === "outbound";
  const snippet = meta?.snippet || stripHtml(item.content).slice(0, 140);
  const attachments = meta?.attachmentCount || 0;

  return (
    <div
      className={cn(
        "group rounded-xl border bg-card transition-shadow duration-150 overflow-hidden",
        isSelected && "ring-1 ring-brand-indigo/30 bg-highlight-selected",
      )}
    >
      {/* Header row */}
      <div
        className="flex items-start gap-3 p-3 cursor-pointer"
        onClick={onToggleExpand}
      >
        {/* Checkbox */}
        <label
          className="flex items-center justify-center h-5 w-5 mt-0.5 shrink-0 cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="h-4 w-4 rounded border-border accent-brand-indigo"
          />
        </label>

        {/* Icon */}
        <div className={cn(
          "shrink-0 h-8 w-8 rounded-full flex items-center justify-center mt-0.5",
          isOut ? "bg-blue-100/80 dark:bg-blue-900/30" : "bg-muted",
        )}>
          <Mail className={cn("h-4 w-4", isOut ? "text-blue-600 dark:text-blue-400" : "text-foreground/50")} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {/* Direction badge */}
            <span className={cn(
              "text-[10px] font-semibold px-2 py-0.5 rounded-full",
              isOut
                ? "bg-brand-indigo/10 text-brand-indigo"
                : "bg-muted text-muted-foreground",
            )}>
              {isOut ? t("slidePanel.email.sent") : t("slidePanel.email.received")}
            </span>
            {attachments > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-foreground/40">
                <Paperclip className="h-3 w-3" />
                {attachments}
              </span>
            )}
            <span className="text-[10px] text-foreground/30 ml-auto shrink-0">
              {formatTimestamp(getTimestamp(item))}
            </span>
            <ChevronDown className={cn(
              "h-3.5 w-3.5 text-foreground/30 transition-transform duration-150 shrink-0",
              isExpanded && "rotate-180",
            )} />
          </div>

          {/* Subject */}
          <p className="text-[12px] font-medium text-foreground truncate">
            {subject}
          </p>

          {/* Snippet (collapsed only) */}
          {!isExpanded && (
            <p className="text-[11px] text-foreground/50 line-clamp-1 mt-0.5">
              {snippet}
            </p>
          )}
        </div>
      </div>

      {/* Expanded: full email body */}
      {isExpanded && (
        <div className="border-t border-border/30">
          {/* From/To info */}
          <div className="px-4 pt-3 pb-2 text-[11px] text-foreground/50 space-y-0.5">
            <div><span className="font-medium text-foreground/70">{t("slidePanel.email.from")}:</span> {meta?.from || "..."}</div>
            <div><span className="font-medium text-foreground/70">{t("slidePanel.email.to")}:</span> {meta?.to || "..."}</div>
            {meta?.cc && (
              <div><span className="font-medium text-foreground/70">{t("slidePanel.email.cc")}:</span> {meta.cc}</div>
            )}
          </div>

          {/* Email body */}
          <div
            className="px-4 pb-3 text-[12px] text-foreground/80 leading-relaxed overflow-x-auto"
            dangerouslySetInnerHTML={{
              __html: item.content.includes("<")
                ? DOMPurify.sanitize(item.content, {
                    ALLOWED_TAGS: ["p", "br", "b", "strong", "i", "em", "a", "ul", "ol", "li", "div", "span", "table", "tr", "td", "th", "thead", "tbody", "img", "h1", "h2", "h3", "h4", "blockquote", "hr"],
                    ALLOWED_ATTR: ["href", "target", "style", "src", "alt", "width", "height", "cellpadding", "cellspacing", "class"],
                    ADD_ATTR: ["target"],
                    FORCE_BODY: true,
                  }).replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ')
                : `<p>${item.content.replace(/\n/g, "<br>")}</p>`,
            }}
          />

          {/* Reply button */}
          {item.direction === "inbound" && onReply && (
            <div className="px-4 pb-3">
              <button
                onClick={(e) => { e.stopPropagation(); onReply(); }}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-brand-indigo text-brand-indigo text-[11px] font-medium hover:bg-brand-indigo/5 transition-colors"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
                {t("slidePanel.email.reply")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function InteractionTimeline({ prospectId, onReply }: InteractionTimelineProps) {
  const { t } = useTranslation("prospects");

  // ── Data state ──
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // ── Selection state ──
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // ── Expanded items ──
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // ── Inline edit state ──
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // ── Add form state ──
  const [showAddForm, setShowAddForm] = useState(false);
  const [formType, setFormType] = useState<typeof INTERACTION_TYPES[number]>("email");
  const [formDirection, setFormDirection] = useState<typeof DIRECTIONS[number]>("outbound");
  const [formContent, setFormContent] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Fetch interactions ──
  const fetchInteractions = useCallback(
    async (offsetVal: number, append = false) => {
      setLoading(true);
      try {
        const res = await apiFetch(
          `/api/interactions?prospect_id=${prospectId}&limit=${PAGE_SIZE}&offset=${offsetVal}`,
        );
        if (res.ok) {
          const json = await res.json();
          // API returns { interactions, total } for prospect queries
          const data: Interaction[] = json.interactions ?? json;
          setInteractions((prev) => (append ? [...prev, ...data] : data));
          setHasMore(data.length >= PAGE_SIZE);
          setOffset(offsetVal + data.length);
        }
      } catch (err) {
        console.error("Failed to fetch interactions", err);
      } finally {
        setLoading(false);
      }
    },
    [prospectId],
  );

  useEffect(() => {
    if (prospectId) {
      setInteractions([]);
      setOffset(0);
      setSelectedIds(new Set());
      fetchInteractions(0);
    }
  }, [prospectId, fetchInteractions]);

  // ── Handlers ──
  const handleLoadMore = useCallback(() => {
    fetchInteractions(offset, true);
  }, [offset, fetchInteractions]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleExpand = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      const promises = Array.from(selectedIds).map((id) =>
        apiFetch(`/api/interactions/${id}`, { method: "DELETE" }),
      );
      await Promise.all(promises);
      setInteractions((prev) => prev.filter((i) => !selectedIds.has(i.id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Failed to delete interactions", err);
    }
  }, [selectedIds]);

  const handleAddInteraction = useCallback(async () => {
    if (!formContent.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospect_id: prospectId,
          type: formType,
          direction: formDirection,
          content: formContent.trim(),
        }),
      });
      if (res.ok) {
        const created: Interaction = await res.json();
        setInteractions((prev) => [created, ...prev]);
        setFormContent("");
        setShowAddForm(false);
      }
    } catch (err) {
      console.error("Failed to add interaction", err);
    } finally {
      setSaving(false);
    }
  }, [prospectId, formType, formDirection, formContent]);

  const startEditing = useCallback((item: Interaction) => {
    setEditingId(item.id);
    setEditContent(item.content);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditContent("");
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (editingId === null || !editContent.trim()) return;
    setEditSaving(true);
    try {
      const res = await apiFetch(`/api/interactions/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      });
      if (res.ok) {
        setInteractions((prev) =>
          prev.map((i) => (i.id === editingId ? { ...i, content: editContent.trim() } : i)),
        );
        setEditingId(null);
        setEditContent("");
      }
    } catch (err) {
      console.error("Failed to update interaction", err);
    } finally {
      setEditSaving(false);
    }
  }, [editingId, editContent]);

  // ── Group emails by thread ──
  const groupedItems = (() => {
    const threadMap = new Map<string, Interaction[]>();
    const nonEmail: Interaction[] = [];

    for (const item of interactions) {
      if (item.type === "email" && item.conversation_thread_id) {
        const thread = threadMap.get(item.conversation_thread_id) || [];
        thread.push(item);
        threadMap.set(item.conversation_thread_id, thread);
      } else {
        nonEmail.push(item);
      }
    }

    // Merge: keep chronological order based on first item in each group
    const allItems: { sortKey: string; item: Interaction | { threadId: string; emails: Interaction[] } }[] = [];

    for (const item of nonEmail) {
      allItems.push({ sortKey: getTimestamp(item), item });
    }

    for (const [threadId, emails] of threadMap) {
      if (emails.length === 1) {
        allItems.push({ sortKey: getTimestamp(emails[0]), item: emails[0] });
      } else {
        // Sort within thread by date ascending
        emails.sort((a, b) => new Date(getTimestamp(a)).getTime() - new Date(getTimestamp(b)).getTime());
        allItems.push({ sortKey: getTimestamp(emails[emails.length - 1]), item: { threadId, emails } });
      }
    }

    // Sort all by most recent first
    allItems.sort((a, b) => new Date(b.sortKey).getTime() - new Date(a.sortKey).getTime());
    return allItems.map((a) => a.item);
  })();

  // ── Render ──
  return (
    <div className="flex flex-col h-full">
      {/* Top action bar */}
      <div className="shrink-0 flex items-center gap-2 px-5 py-3 border-b border-border/20">
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-brand-indigo text-brand-indigo text-[12px] font-medium transition-colors duration-150 hover:bg-brand-indigo/5"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("slidePanel.addInteraction")}
        </button>

        {selectedIds.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-red-300 text-red-600 text-[12px] font-medium transition-colors duration-150 hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("slidePanel.deleteSelected")} ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="shrink-0 border-b border-border/20 px-5 py-4 bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as typeof INTERACTION_TYPES[number])}
              className="h-9 rounded-lg border border-border bg-card px-2.5 text-[12px] font-medium"
            >
              {INTERACTION_TYPES.map((typ) => (
                <option key={typ} value={typ}>
                  {t(`slidePanel.interactionType.${typ}`)}
                </option>
              ))}
            </select>

            <select
              value={formDirection}
              onChange={(e) => setFormDirection(e.target.value as typeof DIRECTIONS[number])}
              className="h-9 rounded-lg border border-border bg-card px-2.5 text-[12px] font-medium"
            >
              {DIRECTIONS.map((dir) => (
                <option key={dir} value={dir}>
                  {t(`slidePanel.direction.${dir}`)}
                </option>
              ))}
            </select>
          </div>

          <textarea
            value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
            placeholder={t("slidePanel.interactionContentPlaceholder")}
            rows={3}
            className="w-full text-[12px] bg-card border border-border rounded-lg px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-brand-indigo/40 placeholder:text-foreground/25 leading-relaxed"
          />

          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleAddInteraction}
              disabled={saving || !formContent.trim()}
              className="h-9 px-4 rounded-full bg-brand-indigo text-white text-[12px] font-medium disabled:opacity-50 transition-opacity duration-150"
            >
              {saving ? t("detail.saving") : t("slidePanel.saveInteraction")}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setFormContent(""); }}
              className="h-9 px-4 rounded-full border border-border text-foreground/60 text-[12px] font-medium transition-colors duration-150 hover:text-foreground"
            >
              {t("detail.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Timeline list */}
      <div className="flex-1 overflow-y-auto min-h-0 px-5 py-3">
        {interactions.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-[13px] font-medium text-foreground/50">
              {t("slidePanel.emptyInteractions")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {groupedItems.map((entry) => {
              // Email thread group
              if ("threadId" in entry && "emails" in entry) {
                return (
                  <EmailThread
                    key={`thread-${entry.threadId}`}
                    emails={entry.emails}
                    expandedIds={expandedIds}
                    selectedIds={selectedIds}
                    onToggleExpand={toggleExpand}
                    onToggleSelect={toggleSelect}
                    onReply={onReply}
                    t={t}
                  />
                );
              }

              // Single email
              const item = entry as Interaction;
              if (item.type === "email") {
                return (
                  <EmailCard
                    key={item.id}
                    item={item}
                    isExpanded={expandedIds.has(item.id)}
                    isSelected={selectedIds.has(item.id)}
                    onToggleExpand={() => toggleExpand(item.id)}
                    onToggleSelect={() => toggleSelect(item.id)}
                    onReply={
                      onReply && item.direction === "inbound"
                        ? () => onReply({
                            messageId: (item.metadata as EmailMetadata)?.gmailMessageId || "",
                            threadId: (item.metadata as EmailMetadata)?.gmailThreadId || "",
                            subject: (item.metadata as EmailMetadata)?.subject || "",
                          })
                        : undefined
                    }
                    t={t}
                  />
                );
              }

              // Non-email interaction (original card)
              return (
                <GenericInteractionCard
                  key={item.id}
                  item={item}
                  isExpanded={expandedIds.has(item.id)}
                  isSelected={selectedIds.has(item.id)}
                  isEditing={editingId === item.id}
                  editContent={editContent}
                  editSaving={editSaving}
                  onToggleExpand={() => toggleExpand(item.id)}
                  onToggleSelect={() => toggleSelect(item.id)}
                  onStartEditing={() => startEditing(item)}
                  onCancelEditing={cancelEditing}
                  onSaveEdit={handleSaveEdit}
                  onEditContentChange={setEditContent}
                  t={t}
                />
              );
            })}
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="flex justify-center py-4">
            <button
              onClick={handleLoadMore}
              disabled={loading}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border text-[12px] font-medium text-foreground/60 transition-colors duration-150 hover:text-foreground disabled:opacity-50"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              {t("slidePanel.loadMore")}
            </button>
          </div>
        )}

        {loading && interactions.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 border-2 border-brand-indigo/30 border-t-brand-indigo rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Email Thread Group ───────────────────────────────────────────────────────

function EmailThread({
  emails,
  expandedIds,
  selectedIds,
  onToggleExpand,
  onToggleSelect,
  onReply,
  t,
}: {
  emails: Interaction[];
  expandedIds: Set<number>;
  selectedIds: Set<number>;
  onToggleExpand: (id: number) => void;
  onToggleSelect: (id: number) => void;
  onReply?: (context: { messageId: string; threadId: string; subject: string }) => void;
  t: ReturnType<typeof import("react-i18next").useTranslation>["t"];
}) {
  const [collapsed, setCollapsed] = useState(true);
  const latest = emails[emails.length - 1];
  const meta = latest.metadata as EmailMetadata | undefined;
  const subject = meta?.subject || t("slidePanel.email.noSubject");
  const count = emails.length;

  if (collapsed) {
    return (
      <div
        className="group rounded-xl border bg-card p-3 cursor-pointer transition-shadow duration-150 hover:shadow-sm"
        onClick={() => setCollapsed(false)}
      >
        <div className="flex items-center gap-3">
          <div className="shrink-0 h-8 w-8 rounded-full bg-blue-100/80 dark:bg-blue-900/30 flex items-center justify-center">
            <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100/80 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                {count} {count === 1 ? "email" : "emails"}
              </span>
              <span className="text-[10px] text-foreground/30 ml-auto shrink-0">
                {formatTimestamp(getTimestamp(latest))}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-foreground/30 shrink-0" />
            </div>
            <p className="text-[12px] font-medium text-foreground truncate mt-0.5">
              {subject}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-200/50 dark:border-blue-800/30 overflow-hidden">
      {/* Thread header */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-blue-50/50 dark:bg-blue-950/20 cursor-pointer border-b border-blue-200/30 dark:border-blue-800/20"
        onClick={() => setCollapsed(true)}
      >
        <ChevronDown className="h-3.5 w-3.5 text-blue-600/50 shrink-0" />
        <Mail className="h-3.5 w-3.5 text-blue-600/50 shrink-0" />
        <span className="text-[11px] font-medium text-blue-700 dark:text-blue-400 truncate">
          {subject}
        </span>
        <span className="text-[10px] text-blue-600/40 ml-auto shrink-0">
          {count} {count === 1 ? "email" : "emails"}
        </span>
      </div>

      {/* Thread emails */}
      <div className="space-y-0 divide-y divide-border/20">
        {emails.map((item) => (
          <EmailCard
            key={item.id}
            item={item}
            isExpanded={expandedIds.has(item.id)}
            isSelected={selectedIds.has(item.id)}
            onToggleExpand={() => onToggleExpand(item.id)}
            onToggleSelect={() => onToggleSelect(item.id)}
            onReply={
              onReply && item.direction === "inbound"
                ? () => onReply({
                    messageId: (item.metadata as EmailMetadata)?.gmailMessageId || "",
                    threadId: (item.metadata as EmailMetadata)?.gmailThreadId || "",
                    subject: (item.metadata as EmailMetadata)?.subject || "",
                  })
                : undefined
            }
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

// ── Generic Interaction Card (non-email) ─────────────────────────────────────

function GenericInteractionCard({
  item,
  isExpanded,
  isSelected,
  isEditing,
  editContent,
  editSaving,
  onToggleExpand,
  onToggleSelect,
  onStartEditing,
  onCancelEditing,
  onSaveEdit,
  onEditContentChange,
  t,
}: {
  item: Interaction;
  isExpanded: boolean;
  isSelected: boolean;
  isEditing: boolean;
  editContent: string;
  editSaving: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onSaveEdit: () => void;
  onEditContentChange: (val: string) => void;
  t: ReturnType<typeof import("react-i18next").useTranslation>["t"];
}) {
  const Icon = getDirectionIcon(item.type, item.direction);
  const badge = getTypeBadgeStyle(item.type);
  const typeLabel = t(`slidePanel.interactionType.${item.type}`, item.type);

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-xl border bg-card p-3 transition-shadow duration-150",
        isSelected && "ring-1 ring-brand-indigo/30 bg-highlight-selected",
      )}
    >
      {/* Checkbox */}
      <label className="flex items-center justify-center h-5 w-5 mt-0.5 shrink-0 cursor-pointer">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="h-4 w-4 rounded border-border accent-brand-indigo"
        />
      </label>

      {/* Direction icon */}
      <div className="shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center mt-0.5">
        <Icon className="h-4 w-4 text-foreground/50" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", badge.bg, badge.text)}>
            {typeLabel}
          </span>
          <span className="text-[10px] text-foreground/40 font-medium">
            {t(`slidePanel.direction.${item.direction}`)}
          </span>
          <span className="text-[10px] text-foreground/30 ml-auto shrink-0">
            {formatTimestamp(getTimestamp(item))}
          </span>
          {!isEditing && (
            <button
              onClick={onStartEditing}
              className="shrink-0 h-7 w-7 rounded-md flex items-center justify-center text-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:text-foreground/70 hover:bg-muted"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {isEditing ? (
          <div>
            <textarea
              value={editContent}
              onChange={(e) => onEditContentChange(e.target.value)}
              rows={3}
              className="w-full text-[12px] bg-card border border-border rounded-lg px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-brand-indigo/40 placeholder:text-foreground/25 leading-relaxed"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={onSaveEdit}
                disabled={editSaving || !editContent.trim()}
                className="h-9 px-4 rounded-full bg-brand-indigo text-white text-[12px] font-medium disabled:opacity-50 transition-opacity duration-150"
              >
                {editSaving ? t("detail.saving") : t("detail.save")}
              </button>
              <button
                onClick={onCancelEditing}
                className="h-9 px-4 rounded-full border border-border text-foreground/60 text-[12px] font-medium transition-colors duration-150 hover:text-foreground"
              >
                {t("detail.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <p
            className={cn(
              "text-[12px] text-foreground/70 leading-relaxed cursor-pointer",
              !isExpanded && "line-clamp-2",
            )}
            onClick={onToggleExpand}
          >
            {item.content}
          </p>
        )}

        {item.metadata && Array.isArray((item.metadata as any).attachments) && (
          <div className="flex items-center gap-1 mt-1.5">
            {((item.metadata as any).attachments as string[]).map((att, i) => (
              <span
                key={i}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
              >
                {att}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
