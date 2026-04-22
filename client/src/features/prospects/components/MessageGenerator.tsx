import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check, Loader2, Wand2, Heart, X, ChevronDown, Sparkles, Pencil, Plus, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { SimpleSelect } from "@/components/ui/simple-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/apiUtils";

interface SavedMessage {
  title: string;
  text: string;
  saved?: boolean;
}

interface OutreachTemplate {
  id: number;
  name: string;
  niche: string;
  body: string;
  channel: string;
  language: string;
}

interface MessageGeneratorProps {
  prospectId: number;
  offerIdeas?: Array<{ text: string; checked?: boolean }>;
  contactName?: string;
  contact2Name?: string;
  niche?: string;
  savedMessages?: SavedMessage[];
  onRefresh?: () => void;
}

const STYLES = ["hormozi", "saraev", "cashvertising", "professional"] as const;
const FORMATS = [
  "whatsapp",
  "linkedin_note",
  "linkedin_message",
  "company_message",
  "email",
  "cold_call",
] as const;
const LANGUAGES = ["en", "nl", "pt"] as const;
const LANGUAGE_LABELS: Record<string, string> = { en: "English", nl: "Dutch", pt: "Portuguese" };

const INSTRUCTION_PRESETS = [
  "mention their recent post",
  "tie to a specific pain point",
  "shorter",
  "more direct",
  "add a soft CTA",
  "reference their company mission",
] as const;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="shrink-0 p-1 rounded hover:bg-muted transition-colors" title="Copy">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
    </button>
  );
}

export function MessageGenerator({ prospectId, offerIdeas, contactName, contact2Name, niche, savedMessages, onRefresh }: MessageGeneratorProps) {
  const { t } = useTranslation("prospects");
  const [style, setStyle] = useState("hormozi");
  const [format, setFormat] = useState("whatsapp");
  const [language, setLanguage] = useState("en");
  const [selectedOffer, setSelectedOffer] = useState("any");
  const [selectedContact, setSelectedContact] = useState("1");
  const [selectedTemplate, setSelectedTemplate] = useState("none");
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [customInstructions, setCustomInstructions] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [messages, setMessages] = useState<SavedMessage[]>(savedMessages || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editInstructions, setEditInstructions] = useState<Record<number, string>>({});
  const [editingMsg, setEditingMsg] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState<Record<number, boolean>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<Record<number, boolean>>({});

  // Fetch templates
  useEffect(() => {
    apiFetch("/api/outreach-templates")
      .then(async (res) => {
        if (res.ok) setTemplates(await res.json());
      })
      .catch(() => {});
  }, []);

  const checkedOffers = offerIdeas?.filter(o => o.checked) || [];
  const offerTexts = offerIdeas?.map(o => o.text) || [];

  function getOfferParam(): string | undefined {
    if (selectedOffer !== "any") return selectedOffer;
    if (checkedOffers.length > 0) return checkedOffers.map(o => o.text).join("; ");
    return undefined;
  }

  const generate = async () => {
    setLoading(true);
    setError(null);
    setMessages(prev => prev.filter(m => m.saved));
    try {
      const tpl = selectedTemplate !== "none" ? templates.find(t => String(t.id) === selectedTemplate) : null;
      const res = await apiFetch(
        `/api/prospects/${prospectId}/generate-messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            style,
            format,
            language,
            offer: getOfferParam(),
            contact: selectedContact,
            customInstructions: customInstructions || undefined,
            templateBody: tpl?.body || undefined,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to generate");
      }
      const data = await res.json();
      setMessages(data.messages);
      onRefresh?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  async function toggleSaved(index: number) {
    const updated = messages.map((m, i) => i === index ? { ...m, saved: !m.saved } : m);
    setMessages(updated);
    try {
      await apiFetch(`/api/prospects/${prospectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generated_messages: JSON.stringify(updated) }),
      });
    } catch {}
  }

  async function applyEditInstruction(index: number) {
    const instruction = editInstructions[index]?.trim();
    if (!instruction || editingMsg === index) return;
    setEditingMsg(index);
    try {
      const res = await apiFetch(`/api/prospects/${prospectId}/edit-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageText: messages[index].text, instruction }),
      });
      if (!res.ok) throw new Error("Edit failed");
      const data = await res.json();
      const updated = messages.map((m, i) => i === index ? { ...m, text: data.text } : m);
      setMessages(updated);
      setEditInstructions(prev => ({ ...prev, [index]: "" }));
      await apiFetch(`/api/prospects/${prospectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generated_messages: JSON.stringify(updated) }),
      });
    } catch {}
    finally { setEditingMsg(null); }
  }

  async function deleteMessage(index: number) {
    if (!deleteConfirm[index]) {
      setDeleteConfirm(prev => ({ ...prev, [index]: true }));
      setTimeout(() => setDeleteConfirm(prev => ({ ...prev, [index]: false })), 2000);
      return;
    }
    const updated = messages.filter((_, i) => i !== index);
    setMessages(updated);
    setDeleteConfirm(prev => ({ ...prev, [index]: false }));
    try {
      await apiFetch(`/api/prospects/${prospectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generated_messages: JSON.stringify(updated) }),
      });
    } catch {}
  }

  const favorites = messages.filter(m => m.saved);
  const others = messages.filter(m => !m.saved);

  return (
    <div className="mb-16">
      <div className="h-px bg-border/40" />
      <div className="flex w-full items-center gap-2 py-2 px-1 select-none">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex flex-1 items-center gap-2 min-w-0"
        >
          <Sparkles className={cn("h-4 w-4", open ? "text-brand-indigo/60" : "text-foreground/50")} />
          <span className={cn("text-sm font-medium", open ? "text-foreground/80" : "text-foreground/60")}>{t("outreach.title")}</span>
          {favorites.length > 0 && (
            <span className="text-[10px] text-emerald-600 font-normal">{favorites.length} saved</span>
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); if (!open) setOpen(true); generate(); }}
          disabled={loading}
          className="inline-flex items-center gap-1 h-6 px-2 rounded-full border border-brand-indigo/30 text-brand-indigo hover:bg-brand-indigo/5 transition-colors disabled:opacity-50 text-[11px] font-medium"
          title={t("outreach.generate")}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
          {loading ? t("outreach.generating") : t("outreach.generate")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="p-0.5"
          aria-label={open ? "Collapse" : "Expand"}
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200 text-foreground/40", !open && "-rotate-90")} />
        </button>
      </div>

      <div className={cn("grid transition-[grid-template-rows] duration-200", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
      <div className="overflow-hidden">
      <div className="space-y-2 pb-2">

        {/* Offer + Template row (primary — what the message is about) */}
        <div className="grid grid-cols-2 gap-1.5">
          {/* Offer selector */}
          <SimpleSelect
            value={selectedOffer}
            onValueChange={setSelectedOffer}
            options={[
              {
                value: "any",
                label: checkedOffers.length > 0 ? `Checked offers (${checkedOffers.length})` : t("outreach.anyOffer", "Any offer"),
                className: "text-xs"
              },
              ...offerTexts.map((idea) => ({
                value: idea,
                label: idea.length > 40 ? idea.slice(0, 40) + "..." : idea,
                className: "text-xs"
              }))
            ]}
            className={cn(
              "h-7 text-[11px] rounded-md px-2 border transition-colors w-full",
              selectedOffer !== "any"
                ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                : "bg-transparent shadow-none border-border/40"
            )}
          />

          {/* Template selector */}
          <SimpleSelect
            value={selectedTemplate}
            onValueChange={setSelectedTemplate}
            placeholder="Template"
            options={(() => {
              const universal = templates.filter(t => !t.niche);
              const nicheMatch = niche ? templates.filter(t => t.niche && t.niche.toLowerCase() === niche.toLowerCase()) : [];
              return [
                { value: "none", label: "No template", className: "text-xs" },
                ...universal.map(t => ({ value: String(t.id), label: `#${t.id} ${t.name}`, className: "text-xs" })),
                ...nicheMatch.map(t => ({ value: String(t.id), label: `#${t.id} ${t.name}`, className: "text-xs" }))
              ];
            })()}
            className={cn(
              "h-7 text-[11px] rounded-md px-2 border transition-colors w-full",
              selectedTemplate !== "none"
                ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                : "bg-transparent shadow-none border-border/40"
            )}
          />
        </div>

        {/* Template preview */}
        {selectedTemplate !== "none" && (() => {
          const tpl = templates.find(t => String(t.id) === selectedTemplate);
          if (!tpl) return null;
          return (
            <div className="rounded-md border border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/20 px-2.5 py-2">
              <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mb-1">#{tpl.id} {tpl.name}</p>
              <p className="text-[11px] text-foreground/60 leading-relaxed whitespace-pre-wrap">{tpl.body}</p>
            </div>
          );
        })()}

        {/* Format + Contact row (who & where) */}
        <div className="grid grid-cols-2 gap-1.5">
          <SimpleSelect
            value={format}
            onValueChange={setFormat}
            options={FORMATS.map((f) => ({
              value: f,
              label: t(`outreach.formats.${f}`, f.replace("_", " ")),
              className: "text-xs"
            }))}
            className="h-7 text-[11px] bg-transparent shadow-none border-border/40 rounded-md px-2 w-full"
          />

          <SimpleSelect
            value={selectedContact}
            onValueChange={setSelectedContact}
            options={[
              {
                value: "1",
                label: contactName ? `C1 · ${contactName}` : "Contact 1",
                className: "text-xs"
              },
              {
                value: "2",
                label: contact2Name ? `C2 · ${contact2Name}` : "Contact 2",
                className: "text-xs"
              },
              {
                value: "generic",
                label: t("outreach.contactGeneric", "Company only"),
                className: "text-xs"
              }
            ]}
            className="h-7 text-[11px] bg-transparent shadow-none border-border/40 rounded-md px-2 w-full"
          />
        </div>

        {/* Advanced disclosure — style, language, custom instructions */}
        <button
          type="button"
          onClick={() => setShowCustom(v => !v)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          <ChevronDown className={cn("h-3 w-3 transition-transform duration-150", !showCustom && "-rotate-90")} />
          Advanced
          {(style !== "hormozi" || language !== "en" || customInstructions) && (
            <span className="h-1 w-1 rounded-full bg-brand-indigo/70 ml-1" />
          )}
        </button>
        {showCustom && (
          <div className="space-y-2">
            {/* Style + Language row */}
            <div className="grid grid-cols-2 gap-1.5">
              <SimpleSelect
                value={style}
                onValueChange={setStyle}
                options={STYLES.map((s) => ({
                  value: s,
                  label: t(`outreach.styles.${s}`),
                  className: "text-xs"
                }))}
                className="h-7 text-[11px] bg-transparent shadow-none border-border/40 rounded-md px-2 w-full"
              />

              <SimpleSelect
                value={language}
                onValueChange={setLanguage}
                options={LANGUAGES.map((l) => ({
                  value: l,
                  label: LANGUAGE_LABELS[l],
                  className: "text-xs"
                }))}
                className="h-7 text-[11px] bg-transparent shadow-none border-border/40 rounded-md px-2 w-full"
              />
            </div>

            {/* Custom instructions textarea with inline preset "+" menu */}
            <div className="relative">
              <textarea
                value={customInstructions}
                onChange={(e) => { setCustomInstructions(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                placeholder={t("outreach.customInstructionsPlaceholder", "Custom instructions for this message (e.g. mention their recent launch)")}
                rows={3}
                className="w-full text-[11px] border border-border/50 rounded-md pl-2.5 pr-8 py-1.5 bg-white dark:bg-card resize-none overflow-hidden min-h-[72px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-brand-indigo/40"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="absolute bottom-1.5 right-1.5 h-5 w-5 rounded-full border border-border/50 bg-white dark:bg-card text-muted-foreground hover:text-foreground hover:border-brand-indigo/40 hover:bg-brand-indigo/5 transition-colors flex items-center justify-center"
                    title="Add instruction preset"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="w-56 z-[60]">
                  {INSTRUCTION_PRESETS.map((preset) => (
                    <DropdownMenuItem
                      key={preset}
                      onSelect={() => setCustomInstructions((prev) => prev ? `${prev.trim()} ${preset}` : preset)}
                      className="text-[11px]"
                    >
                      {preset}
                    </DropdownMenuItem>
                  ))}
                  {customInstructions && (
                    <DropdownMenuItem
                      onSelect={() => setCustomInstructions("")}
                      className="text-[11px] text-destructive/80 focus:text-destructive"
                    >
                      Clear
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-destructive/10 border border-destructive/30 text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[11px] font-medium flex-1 truncate" title={error}>{error}</span>
            <button
              onClick={() => generate()}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-destructive/20 hover:bg-destructive/30 transition-colors shrink-0"
              title="Retry"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}

        {loading && (
          <>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-brand-indigo/5 border border-brand-indigo/20 text-brand-indigo text-[11px] font-medium">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Generating outreach messages (this can take 20-40s)...</span>
            </div>
            <div className="space-y-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`msg-skel-${i}`} className="rounded-lg p-2.5 border border-dashed border-brand-indigo/30 bg-brand-indigo/5 animate-pulse">
                  <div className="h-2.5 w-1/4 rounded bg-brand-indigo/20 mb-2" />
                  <div className="h-2 w-full rounded bg-brand-indigo/10 mb-1" />
                  <div className="h-2 w-5/6 rounded bg-brand-indigo/10 mb-1" />
                  <div className="h-2 w-2/3 rounded bg-brand-indigo/10" />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Favorites */}
        {favorites.length > 0 && (
          <div className="space-y-1.5">
            {messages.map((msg, i) => {
              if (!msg.saved) return null;
              return (
                <div key={`msg-${i}`} className="relative rounded-lg p-2.5 bg-emerald-500/5 border border-emerald-500/20 group">
                  {/* Top-right: heart, copy, delete */}
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => toggleSaved(i)} className="p-1 rounded hover:bg-muted transition-colors" title="Unsave">
                      <Heart className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" />
                    </button>
                    <CopyButton text={msg.text} />
                    <button onClick={() => deleteMessage(i)} className={cn("p-1 rounded transition-colors", deleteConfirm[i] ? "bg-destructive/10" : "hover:bg-destructive/10")} title={deleteConfirm[i] ? "Click again to confirm" : "Delete"}>
                      <X className={cn("h-3.5 w-3.5 transition-colors", deleteConfirm[i] ? "text-destructive" : "text-muted-foreground hover:text-destructive")} />
                    </button>
                  </div>
                  <span className="font-normal text-blue-600 dark:text-blue-400 text-[11px]">{msg.title}</span>
                  <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed break-words w-full">{msg.text}</p>
                  {/* Bottom: char count + AI edit pen */}
                  <div className="flex items-center gap-1 mt-1.5 -ml-1">
                    <span className="text-[10px] text-muted-foreground/40 px-1">{msg.text.length}</span>
                    <button onClick={() => setEditOpen(prev => ({ ...prev, [i]: !prev[i] }))} className="p-1 rounded hover:bg-muted transition-colors shrink-0" title="Edit with AI">
                      <Pencil className={cn("h-3.5 w-3.5 transition-colors", editOpen[i] ? "text-brand-indigo" : "text-muted-foreground/50 hover:text-brand-indigo")} />
                    </button>
                    {editOpen[i] && (
                      <>
                        <input
                          autoFocus
                          value={editInstructions[i] ?? ""}
                          onChange={e => setEditInstructions(prev => ({ ...prev, [i]: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter") applyEditInstruction(i); if (e.key === "Escape") setEditOpen(prev => ({ ...prev, [i]: false })); }}
                          placeholder="e.g. make it shorter..."
                          className="flex-1 h-6 px-2 rounded bg-white dark:bg-slate-900 border border-border/40 text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-brand-indigo/30"
                        />
                        <button onClick={() => applyEditInstruction(i)} disabled={editingMsg === i || !editInstructions[i]?.trim()} className="p-1 rounded hover:bg-muted transition-colors shrink-0 disabled:opacity-40" title="Apply">
                          {editingMsg === i ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : <Check className="h-3.5 w-3.5 text-brand-indigo" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {others.length > 0 && <div className="h-px bg-border/30" />}
          </div>
        )}

        {/* Others */}
        {others.length > 0 && (
          <div className="space-y-1.5">
            {messages.map((msg, i) => {
              if (msg.saved) return null;
              return (
                <div key={`msg-${i}`} className="relative bg-white dark:bg-slate-900 border border-border/60 shadow-sm rounded-lg p-2.5 group">
                  {/* Top-right: heart, copy, delete */}
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => toggleSaved(i)} className="p-1 rounded hover:bg-muted transition-colors" title="Save">
                      <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <CopyButton text={msg.text} />
                    <button onClick={() => deleteMessage(i)} className={cn("p-1 rounded transition-colors", deleteConfirm[i] ? "bg-destructive/10" : "hover:bg-destructive/10")} title={deleteConfirm[i] ? "Click again to confirm" : "Delete"}>
                      <X className={cn("h-3.5 w-3.5 transition-colors", deleteConfirm[i] ? "text-destructive" : "text-muted-foreground hover:text-destructive")} />
                    </button>
                  </div>
                  <span className="font-normal text-blue-600 dark:text-blue-400 text-[11px]">{msg.title}</span>
                  <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed break-words w-full">{msg.text}</p>
                  {/* Bottom: char count + AI edit pen */}
                  <div className="flex items-center gap-1 mt-1.5 -ml-1">
                    <span className="text-[10px] text-muted-foreground/40 px-1">{msg.text.length}</span>
                    <button onClick={() => setEditOpen(prev => ({ ...prev, [i]: !prev[i] }))} className="p-1 rounded hover:bg-muted transition-colors shrink-0" title="Edit with AI">
                      <Pencil className={cn("h-3.5 w-3.5 transition-colors", editOpen[i] ? "text-brand-indigo" : "text-muted-foreground/50 hover:text-brand-indigo")} />
                    </button>
                    {editOpen[i] && (
                      <>
                        <input
                          autoFocus
                          value={editInstructions[i] ?? ""}
                          onChange={e => setEditInstructions(prev => ({ ...prev, [i]: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter") applyEditInstruction(i); if (e.key === "Escape") setEditOpen(prev => ({ ...prev, [i]: false })); }}
                          placeholder="e.g. make it shorter..."
                          className="flex-1 h-6 px-2 rounded bg-white dark:bg-slate-900 border border-border/40 text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-brand-indigo/30"
                        />
                        <button onClick={() => applyEditInstruction(i)} disabled={editingMsg === i || !editInstructions[i]?.trim()} className="p-1 rounded hover:bg-muted transition-colors shrink-0 disabled:opacity-40" title="Apply">
                          {editingMsg === i ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : <Check className="h-3.5 w-3.5 text-brand-indigo" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
      </div>
      </div>
    </div>
  );
}
