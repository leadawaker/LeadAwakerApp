import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Loader2, MessageCircle, Plus } from "lucide-react";
import { createDemoLink, DEMO_SESSIONS_KEY, type DemoSession } from "../api/demoSessionsApi";
import { serviceCopyUrl, serviceOpenUrl, type ServiceDef } from "../services";
import type { ProspectRow } from "../prospectRows";
import type { DemoLang } from "@/features/campaigns/api/demoClientsApi";

const ICON = { color: "var(--mute-2)" } as const;

function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
      style={ICON}
    >
      {children}
    </button>
  );
}

function IconLink({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      aria-label={title}
      className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
      style={ICON}
    >
      {children}
    </a>
  );
}

/** How far this one demo got, over both of its surfaces. The row's job is "did
 *  they look at it", and which surface they looked at it on is a detail the
 *  presenter panel can answer. */
function status(session: DemoSession) {
  const opened = session.browser.opened || session.whatsapp.opened;
  const replies = session.browser.replies + session.whatsapp.replies;
  const moments = [session.browser.lastAt, session.whatsapp.lastAt, session.browser.openedAt, session.whatsapp.openedAt]
    .filter((x): x is string => !!x)
    .sort();
  return { opened, replies, at: moments.length ? moments[moments.length - 1]! : null };
}

/**
 * One prospect's link for one service.
 *
 * Three states: a link that exists (how far it got, plus the ways to send it
 * again), no link yet (mint one right here, wearing this row's persona), and a
 * service with no campaign behind it (visible, plainly not offered).
 */
export function ServiceCell({
  svc,
  row,
  session,
  fmt,
}: {
  svc: ServiceDef;
  row: ProspectRow;
  session: DemoSession | undefined;
  fmt: Intl.DateTimeFormat;
}) {
  const { t } = useTranslation("demos");
  const qc = useQueryClient();
  const [copied, setCopied] = useState("");

  const mint = useMutation({
    mutationFn: () =>
      createDemoLink({
        firstName: row.firstName || "there",
        language: (row.language || "en") as DemoLang,
        campaignId: svc.campaignId!,
        scenario: svc.scenario,
        service: svc.key,
        prospectGroup: row.key,
        ...(row.clientNiche ? { clientNiche: row.clientNiche } : {}),
        ...(row.companyName ? { companyName: row.companyName } : {}),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: DEMO_SESSIONS_KEY }),
  });

  const copy = (which: string, value: string) => {
    void navigator.clipboard.writeText(value);
    setCopied(which);
    setTimeout(() => setCopied(""), 1500);
  };

  if (!svc.campaignId) {
    return (
      <span title={t("services.soon")} style={{ fontSize: 12, color: "var(--mute-2)", opacity: 0.5 }}>
        —
      </span>
    );
  }

  if (!session) {
    return (
      <button
        type="button"
        title={mint.error ? t("new.failed") : t("services.create")}
        aria-label={t("services.create")}
        onClick={() => mint.mutate()}
        disabled={mint.isPending}
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-border hover:bg-muted"
        style={{ color: mint.error ? "var(--danger, #9A3B2E)" : "var(--mute-2)" }}
      >
        {mint.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
      </button>
    );
  }

  const s = status(session);
  return (
    <div className="flex flex-col gap-0.5 leading-tight">
      <span
        style={{
          fontSize: 10.5,
          fontWeight: s.replies > 0 ? 600 : 400,
          color: s.opened ? (s.replies > 0 ? "var(--ink)" : "var(--mute)") : "var(--mute-2)",
        }}
      >
        {!s.opened
          ? t("status.unopened")
          : s.replies > 0
            ? t("status.replies", { count: s.replies })
            : t("status.opened")}
        {s.opened && s.at ? ` · ${fmt.format(new Date(s.at))}` : ""}
      </span>
      <div className="flex items-center">
        <IconButton title={t("services.copy")} onClick={() => copy("link", serviceCopyUrl(svc, session))}>
          {copied === "link" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        </IconButton>
        <IconLink title={t("services.open")} href={serviceOpenUrl(svc, session)}>
          <ExternalLink className="h-3.5 w-3.5" />
        </IconLink>
        {/* Voice is a browser call, not a chat thread: it has no WhatsApp side
            at all, so the button is absent rather than disabled. */}
        {!svc.voice && (
          <a
            href={session.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={t("services.whatsapp")}
            aria-label={t("services.whatsapp")}
            onContextMenu={(e) => {
              e.preventDefault();
              copy("wa", session.whatsappUrl);
            }}
            className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
            style={ICON}
          >
            {copied === "wa" ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <MessageCircle className="h-3.5 w-3.5" />
            )}
          </a>
        )}
      </div>
    </div>
  );
}
