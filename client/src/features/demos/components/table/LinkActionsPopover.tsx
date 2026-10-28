import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Copy, ExternalLink, Loader2, MessageCircle, Phone, RefreshCw, Trash2 } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { DemoSession } from "../../api/demoSessionsApi";
import { DemoApiError, useDeleteLink, useRemintLink } from "../../api/demoProspectsApi";
import type { ProspectRow } from "../../prospectRows";
import { serviceCopyUrl, serviceOpenUrl, type ServiceDef } from "../../services";
import { TOUCH } from "../../touchTargets";
import { ClientLogoSwatch } from "../ClientLogoSwatch";
import { DeleteConfirmDialog } from "../DeleteConfirmDialog";
import { DemoCallControls } from "../DemoCallControls";
import { WidgetColorSwatch } from "../WidgetColorSwatch";
import { copyText } from "./linkActions";

/** One menu row: a round button (or swatch) and its label. The whole row is the click target. */
function ActionRow({ label, onClick, danger, children }: {
  label: string;
  onClick?: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      role="presentation"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-[var(--r-button)] pr-2 max-md:min-h-11",
        onClick && "cursor-pointer hover:bg-[var(--wine-tint)]",
      )}
    >
      {children}
      <span className="min-w-0 flex-1 truncate" style={{ fontSize: 13, color: danger ? "hsl(var(--destructive))" : "var(--ink)" }}>
        {label}
      </span>
    </div>
  );
}

/** What can be done to one minted link. The trigger (the status pill) is the caller's. */
export function LinkActionsPopover({ row, svc, session, trigger }: {
  row: ProspectRow;
  svc: ServiceDef;
  session: DemoSession;
  trigger: ReactNode;
}) {
  const { t } = useTranslation("demos");
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [callsOpen, setCallsOpen] = useState(false);
  const remint = useRemintLink();
  const del = useDeleteLink();

  const openUrl = (url: string) => {
    setOpen(false);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyUrl = async (url: string) => {
    setOpen(false);
    toast(
      (await copyText(url))
        ? { variant: "success", title: t("links.copied") }
        : { variant: "destructive", title: t("links.actionFailed") },
    );
  };

  // The popover and its trigger can be gone by the time these settle (the row refetches),
  // so they report through toast() and never through state.
  const doRemint = async () => {
    setOpen(false);
    if (remint.isPending) return;
    try {
      const res = await remint.mutateAsync({ token: session.token });
      const url = serviceCopyUrl(svc, { ...session, demoUrl: res.demoUrl });
      toast({ variant: "success", title: t("links.remintDone"), description: (await copyText(url)) ? t("links.copied") : url });
    } catch (e) {
      // `revoked`: this link was already replaced (the list was stale, or a second click raced the first).
      const replaced = e instanceof DemoApiError && e.code === "revoked";
      toast({ variant: "destructive", title: t(replaced ? "links.remintRevoked" : "links.actionFailed") });
    }
  };

  const doDelete = async () => {
    try {
      await del.mutateAsync({ token: session.token });
      setConfirmOpen(false);
      toast({ variant: "success", title: t("links.deleted") });
    } catch {
      setConfirmOpen(false);
      toast({ variant: "destructive", title: t("links.actionFailed") });
    }
  };

  // Voice is a browser call and reviews are a two-phone page: neither has a WhatsApp side.
  const hasWhatsapp = !svc.voice && !svc.reviewPage;
  const showWidget = svc.widgetPage && !!row.clientNiche;
  const showLogo = (svc.socialPage || svc.reviewPage) && !!row.clientNiche;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent align="start" className="flex w-[min(300px,calc(100vw-32px))] flex-col gap-0.5 p-2">
          <ActionRow label={t("links.open")} onClick={() => openUrl(serviceOpenUrl(svc, session))}>
            <IconBtn aria-label={t("links.open")} className={TOUCH}><ExternalLink className="h-4 w-4" /></IconBtn>
          </ActionRow>
          <ActionRow label={t("links.copy")} onClick={() => void copyUrl(serviceCopyUrl(svc, session))}>
            <IconBtn aria-label={t("links.copy")} className={TOUCH}><Copy className="h-4 w-4" /></IconBtn>
          </ActionRow>
          {hasWhatsapp && (
            <>
              <ActionRow label={t("links.whatsapp")} onClick={() => openUrl(session.whatsappUrl)}>
                <IconBtn aria-label={t("links.whatsapp")} className={TOUCH}><MessageCircle className="h-4 w-4" /></IconBtn>
              </ActionRow>
              <ActionRow label={t("links.copyWhatsapp")} onClick={() => void copyUrl(session.whatsappUrl)}>
                <IconBtn aria-label={t("links.copyWhatsapp")} className={TOUCH}><Copy className="h-4 w-4" /></IconBtn>
              </ActionRow>
            </>
          )}
          {svc.voice && (
            <>
              <ActionRow label={t("links.call")} onClick={() => setCallsOpen((v) => !v)}>
                <IconBtn aria-label={t("links.call")} active={callsOpen} className={TOUCH}><Phone className="h-4 w-4" /></IconBtn>
              </ActionRow>
              {callsOpen && (
                <div className="px-1 pb-1 pt-1">
                  <DemoCallControls token={session.token} defaultPhone={session.phone || undefined} />
                </div>
              )}
            </>
          )}
          {showWidget && (
            <ActionRow label={t("widgetColor.title")}><WidgetColorSwatch niche={row.clientNiche} /></ActionRow>
          )}
          {showLogo && (
            <ActionRow label={t("clientLogo.title")}><ClientLogoSwatch niche={row.clientNiche} /></ActionRow>
          )}
          <div className="my-1 border-t" style={{ borderColor: "var(--line)" }} />
          {/* A visitor's own website demo cannot be re-minted (the server answers 409 public_demo); it can still be deleted. */}
          {!session.publicDemo && (
            <ActionRow label={t("links.remint")} onClick={() => void doRemint()}>
              <IconBtn aria-label={t("links.remint")} disabled={remint.isPending} className={TOUCH}>
                {remint.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </IconBtn>
            </ActionRow>
          )}
          <ActionRow
            label={t("links.delete")}
            danger
            onClick={() => {
              setOpen(false);
              setConfirmOpen(true);
            }}
          >
            <IconBtn aria-label={t("links.delete")} className={TOUCH} style={{ color: "hsl(var(--destructive))" }}>
              <Trash2 className="h-4 w-4" />
            </IconBtn>
          </ActionRow>
        </PopoverContent>
      </Popover>
      <DeleteConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("links.deleteTitle")}
        body={t("links.deleteBody")}
        confirmLabel={t("links.delete")}
        onConfirm={() => void doDelete()}
        pending={del.isPending}
      />
    </>
  );
}
