import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { CheckCheck } from "lucide-react";
import { openLead } from "@/lib/leadLink";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Pill } from "@/components/crm/primitives/Pill";
import { PanelShell, SectionHead } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";
import type { AttentionRow, HomeChannel, HomeChannelFilter, RecentItem } from "@shared/homeTypes";
import { RowList, type RowListItem } from "../components/RowList";
import { ATTENTION_COLOR, CHANNEL_ICON, OUTCOME_COLOR } from "../components/activityIcons";
import { openCall } from "../lib/openCall";
import { dismissAttention, restoreAttention, type AttentionRef, type HomeScope } from "../api/homeApi";

const TITLE = 22;
const EMPTY_KEY: Record<HomeChannelFilter, string> = {
  all: "overview.activityEmpty", sms: "overview.activityEmpty",
  phone: "phone.recentEmpty", whatsapp: "whatsapp.recentEmpty", website: "website.recentEmpty",
};

/** A list panel with a fixed height (`home-list-panel`, about 5 rows): the rows scroll inside. */
function ListPanel({ testId, title, action, children }: {
  testId: string; title: string; action?: ReactNode; children: ReactNode;
}) {
  return (
    <PanelShell className="home-list-panel min-w-0" testId={testId}>
      <SectionHead title={<span className="home-panel-title">{title}</span>} titleSize={TITLE} action={action} marginBottom={10} />
      <div className="home-panel-scroll min-h-0 flex-1 overflow-y-auto" style={{ marginRight: -8, paddingRight: 8 }}>{children}</div>
    </PanelShell>
  );
}

function useNameOf() {
  const { t } = useTranslation("home");
  return (name: string | null, channel: HomeChannel) =>
    name || t(channel === "phone" ? "overview.unknownCaller" : channel === "website" ? "overview.visitor" : "unknownContact");
}

/** Same text once spaces, dashes and brackets are ignored (a phone number written two ways). */
const sameText = (a: string, b: string) => a.replace(/[\s\-().]/g, "") === b.replace(/[\s\-().]/g, "");

/** Calls and chats of the period, newest first, for the channel picked in By channel. */
export function RecentActivityPanel({ items, channel }: { items: RecentItem[]; channel: HomeChannelFilter }) {
  const { t } = useTranslation("home");
  const [, setLocation] = useLocation();
  const nameOf = useNameOf();
  const rows: RowListItem[] = items.map((r, i) => {
    const title = r.channel === "phone" ? (r.name || r.callerNumber || t("overview.unknownCaller")) : nameOf(r.name, r.channel);
    const meta = r.text ?? (r.channel === "phone" ? r.callerNumber ?? undefined : undefined);
    return {
      key: `${r.channel}-${r.callId ?? r.leadId ?? i}`,
      title,
      // A caller without a name shows the number as the title: no second copy below it.
      meta: meta && sameText(meta, title) ? undefined : meta,
      // "Questions answered" is the normal case: no tag.
      tag: r.outcome && r.outcome !== "answered"
        ? <Pill color={OUTCOME_COLOR[r.outcome]}>{t(`phone.outcome.${r.outcome}`)}</Pill>
        : undefined,
      icon: CHANNEL_ICON[r.channel],
      time: r.at,
      onClick: r.callId ? () => openCall(r.callId as string, setLocation)
        : r.leadId ? () => openLead(setLocation, r.leadId as number) : undefined,
    };
  });
  return (
    <ListPanel testId="stats-recent" title={t("overview.activity")}>
      <RowList rows={rows} empty={t(EMPTY_KEY[channel])} />
    </ListPanel>
  );
}

const refOf = (r: AttentionRow): AttentionRef | null => (r.ref ? { kind: r.kind, refId: r.ref } : null);

/**
 * Open to-dos (not tied to the period) for the picked channel. About 5 rows, then it scrolls inside.
 * A row can be marked as handled (the x, or a double-click on its icon); "Clear all" handles the whole list.
 * Both are per account, with an undo toast.
 */
export function AttentionPanel({ items, waiting, scope, channel }: {
  items: AttentionRow[]; waiting: number; scope: HomeScope; channel: HomeChannelFilter;
}) {
  const { t } = useTranslation("home");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const nameOf = useNameOf();
  // Hidden at once while the server catches up; `cleared` is the list "Clear all" emptied.
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [cleared, setCleared] = useState<AttentionRow[] | null>(null);
  const keyOf = (x: AttentionRef) => `${x.kind}:${x.refId}`;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/home", "overview"] });
  const unhide = (refs: AttentionRef[]) => setHidden((h) => {
    const next = new Set(h);
    refs.forEach((x) => next.delete(keyOf(x)));
    return next;
  });

  const undo = async (refs: AttentionRef[]) => {
    try {
      await restoreAttention({ accountId: scope.accountId, channel, items: refs });
    } catch {
      toast({ title: t("overview.handledFailed"), variant: "destructive" });
    }
    unhide(refs);
    setCleared(null);
    await refresh();
  };
  const handled = (refs: AttentionRef[]) => toast({
    title: t("overview.handled", { count: refs.length }),
    duration: 6000,
    action: <ToastAction altText={t("overview.undo")} onClick={() => { void undo(refs); }}>{t("overview.undo")}</ToastAction>,
  });

  const dismissOne = async (ref: AttentionRef) => {
    setHidden((h) => new Set(h).add(keyOf(ref)));
    try {
      const res = await dismissAttention({ accountId: scope.accountId, channel, items: [ref] });
      handled(res.items.length ? res.items : [ref]);
    } catch {
      unhide([ref]);
      toast({ title: t("overview.handledFailed"), variant: "destructive" });
    }
    await refresh();
  };
  const clearAll = async () => {
    const shown = items.map(refOf).filter((x): x is AttentionRef => x !== null);
    setCleared(items);
    try {
      const res = await dismissAttention({ accountId: scope.accountId, channel, all: true });
      if (res.items.length) handled(res.items);
    } catch {
      setCleared(null);
      unhide(shown);
      toast({ title: t("overview.handledFailed"), variant: "destructive" });
    }
    await refresh();
  };

  const visible = cleared === items ? [] : items.filter((r) => !r.ref || !hidden.has(keyOf({ kind: r.kind, refId: r.ref })));
  const shownWaiting = cleared === items ? 0 : Math.max(0, waiting - (items.length - visible.length));
  const label = t("overview.markHandled");
  const rows: RowListItem[] = visible.map((r, i) => {
    const ref = refOf(r);
    return {
      key: `${r.kind}-${r.callId ?? r.leadId ?? "x"}-${i}`,
      title: nameOf(r.name, r.channel),
      meta: t(`overview.attentionKind.${r.kind}`),
      tag: <Pill color={ATTENTION_COLOR[r.kind]}>{t(`overview.attentionTag.${r.kind}`)}</Pill>,
      icon: CHANNEL_ICON[r.channel] ?? CHANNEL_ICON.whatsapp,
      time: r.at,
      onClick: r.callId ? () => openCall(r.callId as string, setLocation) : r.leadId ? () => openLead(setLocation, r.leadId as number) : undefined,
      onDismiss: ref ? () => { void dismissOne(ref); } : undefined,
      dismissLabel: label,
    };
  });
  return (
    <ListPanel testId="stats-attention" title={t("overview.attention")}
      action={shownWaiting > 0 ? (
        <span className="home-attn-actions flex items-center gap-2 max-md:gap-1">
          <Pill>{t("stats.waiting", { count: shownWaiting })}</Pill>
          {/* Phones show the icon only (home.css); the label stays for screen readers. */}
          <button type="button" className="home-clear-all" onClick={() => { void clearAll(); }} data-testid="attention-clear-all"
            aria-label={t("overview.clearAll")} title={t("overview.clearAll")}>
            <span className="home-clear-all-text">{t("overview.clearAll")}</span>
            <CheckCheck size={18} className="home-clear-all-icon" aria-hidden="true" />
          </button>
        </span>
      ) : undefined}>
      <RowList rows={rows} empty={t("overview.attentionEmpty")} />
    </ListPanel>
  );
}
