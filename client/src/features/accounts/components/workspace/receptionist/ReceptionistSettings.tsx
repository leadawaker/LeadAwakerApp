// The receptionist's settings for one account, shown as the Settings view of
// the Calls page (channel "voice": the old Accounts > Phone tab) and of the
// Chats page ("chat": the old Accounts > Chat tab). House rule: tune the AI
// where you see its work. Owner/Admin edit; clients read their own account
// with the "Request a change" note. The agency's account: the one in the URL
// or picked here, else the page's own account filter, else the one last picked
// here (remembered in this browser), else the nav bar's account; with none of
// those a chooser is shown.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { Building2, Check, ChevronDown, Link2, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getQueryFn } from "@/lib/queryClient";
import { useWorkspace, type Account } from "@/hooks/useWorkspace";
import { useIsMobile } from "@/hooks/useIsMobile";
import { setPersistedSelection, usePersistedSelection } from "@/hooks/usePersistedSelection";
import { useVoiceCapabilities } from "@/features/voiceCalls/api/voiceCallsApi";
import { VoiceTab } from "../voice/VoiceTab";
import { CARD_SECTION, VOICE_SECTIONS, type VoiceCard, type VoiceSection } from "../voice/readiness";
import { CHAT_SECTIONS, ChatTab, type ChatSection } from "../chat/ChatTab";
import { PAGE_PATH, nextLinkedAccount, readSettingsParams, receptionistSettingsHref, syncSettingsParams, type ReceptionistChannel, type SettingsTarget } from "./settingsLink";

interface AccountRecord { id?: number; Id?: number; name?: string; inbound_campaign_id?: unknown }

const pick = <T extends string>(list: readonly T[], v: string | undefined): T | undefined =>
  (list as readonly string[]).includes(v ?? "") ? (v as T) : undefined;

export function ReceptionistSettings({ channel, fallbackAccountId, pickerSlot }: {
  channel: ReceptionistChannel;
  /** Agency: the account the page itself is narrowed to (the Calls account filter, the Chats list filter). */
  fallbackAccountId?: number;
  /**
   * Where the agency's account picker goes: a spot in the page's topbar, right after the tabs. Null
   * while that spot is not mounted yet (the picker waits); left out, the picker gets its own row here.
   */
  pickerSlot?: HTMLElement | null;
}) {
  const { t } = useTranslation("accounts");
  const { isAgencyUser, isAdmin, accounts, isLoadingAccounts, currentAccountId } = useWorkspace();
  const stacked = useIsMobile(1024);
  const [, setLocation] = useLocation();
  const path = PAGE_PATH[channel];

  // Where the link pointed (account, section, card): read once, when the view opens.
  const [entry] = useState(() => readSettingsParams(window.location.search));
  const [picked, setPicked] = useState<number | undefined>(isAgencyUser ? entry.accountId : undefined);
  // The last account picked here, kept in this browser so the next visit opens on it. It has its own
  // key: the Accounts page and several links rewrite "selected-account-id". An id that is no longer
  // in the account list comes back as null.
  const [remembered, setRemembered] = usePersistedSelection<Account>("receptionist-settings-account", (a) => a.id, accounts);
  const workspaceId = currentAccountId > 0 ? currentAccountId : undefined;
  // A switch in the nav bar's account picker wins over an earlier pick here, remembered or not.
  const seenWorkspace = useRef(workspaceId);
  useEffect(() => {
    if (seenWorkspace.current === workspaceId) return;
    seenWorkspace.current = workspaceId;
    setPicked(undefined);
    setRemembered(null);
  }, [workspaceId, setRemembered]);
  // Agency only: a client (or an Owner viewing as one) never gets a remembered account.
  const accountId = isAgencyUser ? picked ?? fallbackAccountId ?? remembered?.id ?? workspaceId : workspaceId;

  // The link's section/focus open the first account only: after a switch the
  // remembered section wins (the tabs remount per account and would re-apply it).
  const [linkedAccount, setLinkedAccount] = useState<number | null | undefined>(undefined);
  const nextLinked = nextLinkedAccount(linkedAccount, accountId);
  if (nextLinked !== linkedAccount) setLinkedAccount(nextLinked);
  const linked: SettingsTarget = nextLinked !== null && nextLinked === accountId ? entry : {};

  // ?view=settings (+ the agency's account) while open, so a reload or a shared link comes back here.
  useEffect(() => { syncSettingsParams(path, true, isAgencyUser ? accountId : undefined); }, [path, isAgencyUser, accountId]);
  useEffect(() => () => syncSettingsParams(path, false), [path]);

  // Same cache entry as the workspace's own-account query.
  const { data: account, isLoading, error } = useQuery<AccountRecord | null>({
    queryKey: [`/api/accounts/${accountId}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!accountId,
    staleTime: 60_000,
  });

  // A pick is shown now and kept for the next visit.
  const choose = (id: number) => {
    setPicked(id);
    const chosen = accounts.find((a) => a.id === id);
    if (chosen) setRemembered(chosen);
  };

  const options = [...accounts].sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
  const picker = isAgencyUser ? (
    <AccountPicker
      accounts={options}
      value={accountId}
      label={options.find((a) => a.id === accountId)?.name ?? account?.name}
      onChange={choose}
    />
  ) : null;
  // The same picker in the page's topbar, level with the tabs.
  const topbarPicker = isAgencyUser && accountId && pickerSlot ? createPortal(
    <AccountPicker
      accounts={options}
      value={accountId}
      label={options.find((a) => a.id === accountId)?.name ?? account?.name}
      onChange={choose}
      height={38}
    />,
    pickerSlot,
  ) : null;

  const openIntegrations = () => {
    if (accountId) setPersistedSelection("selected-account-id", accountId);
    setLocation("/platform/accounts?tab=integrations");
  };

  let body: ReactNode;
  if (!accountId) {
    body = isAgencyUser && !isLoadingAccounts ? <ChooseAccount picker={picker} /> : <Spinner />;
  } else if (isLoading) {
    body = <Spinner />;
  } else if (error || !account) {
    body = <ChooseAccount picker={picker} failed />;
  } else if (channel === "voice") {
    const focus = pick(Object.keys(CARD_SECTION) as VoiceCard[], linked.focus);
    body = (
      <VoiceTab
        key={accountId}
        accountId={accountId}
        readOnly={!isAdmin}
        stacked={stacked}
        onOpenIntegrations={openIntegrations}
        initialSection={pick<VoiceSection>(VOICE_SECTIONS, linked.section)}
        focus={focus}
        knowledgeNote={<SharedNote channel="voice" accountId={accountId} />}
      />
    );
  } else {
    body = (
      <ChatTab
        key={accountId}
        accountId={accountId}
        inboundCampaignId={account.inbound_campaign_id}
        readOnly={!isAdmin}
        stacked={stacked}
        onOpenIntegrations={openIntegrations}
        initialSection={pick<ChatSection>(CHAT_SECTIONS, linked.section)}
        knowledgeNote={<SharedNote channel="chat" accountId={accountId} />}
      />
    );
  }

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto"
      data-testid={`receptionist-settings-${channel}`}
      // The section menu sticks 24px under the top of this scroller (SectionLayout adds 32px).
      style={{ background: "var(--bg)", ["--ws-sticky-top" as string]: "-8px" }}
    >
      <div className="la-page-center flex flex-col gap-5 px-4 pb-11 pt-4 md:px-9 md:pt-6">
        {isAgencyUser && accountId && pickerSlot === undefined ? <div className="flex items-center gap-3">{picker}</div> : null}
        {topbarPicker}
        {body}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center" style={{ padding: 48, color: "var(--mute)" }}>
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

/** Agency without an account yet (or one that could not be loaded): pick one. */
function ChooseAccount({ picker, failed = false }: { picker: ReactNode; failed?: boolean }) {
  const { t } = useTranslation("accounts");
  return (
    <div
      className="neu-inset"
      style={{ borderRadius: "var(--r-card)", padding: "36px 28px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
      data-testid="receptionist-settings-choose"
    >
      <Building2 size={26} style={{ color: "var(--mute-2)" }} />
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
        {t(failed ? "receptionistSettings.loadFailed" : "receptionistSettings.chooseTitle")}
      </div>
      <p style={{ margin: 0, maxWidth: 460, fontSize: 13, color: "var(--mute)", lineHeight: 1.5 }}>{t("receptionistSettings.chooseHelp")}</p>
      {picker}
    </div>
  );
}

function AccountPicker({ accounts, value, label, onChange, height = 32 }: {
  accounts: { id: number; name: string }[];
  value: number | undefined;
  label: string | undefined;
  onChange: (id: number) => void;
  /** 38 in the page's topbar, level with the Stats | Calls | Settings tabs. */
  height?: number;
}) {
  const { t } = useTranslation("accounts");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("receptionistSettings.account")}
          title={t("receptionistSettings.account")}
          data-testid="receptionist-settings-account"
          className={`la-btn la-btn--soft${value ? " on" : ""}`}
          style={{ height, flexShrink: 0, maxWidth: 280 }}
        >
          <Building2 className="h-4 w-4 shrink-0" />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label ?? t("receptionistSettings.choose")}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto glass-strong border-none">
        {accounts.length === 0 && (
          <div className="px-2 py-1.5 text-[12px]" style={{ color: "var(--mute)" }}>{t("receptionistSettings.noAccounts")}</div>
        )}
        {accounts.map((a) => (
          <DropdownMenuItem key={a.id} className="flex items-center gap-2 text-[12px]" onClick={() => onChange(a.id)} style={{ fontWeight: value === a.id ? 600 : 400 }}>
            <span className="flex-1 truncate">{a.name}</span>
            {value === a.id && <Check className="h-3 w-3 ml-auto shrink-0" style={{ color: "var(--wine)" }} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Opening hours and Company Intel belong to the account, so the phone and the
 * chat receptionist share them. One line says so; from Chats it links to where
 * they are edited (Calls > Settings) when this viewer can open the Calls page.
 */
function SharedNote({ channel, accountId }: { channel: ReceptionistChannel; accountId: number }) {
  const { t } = useTranslation("accounts");
  const { isAgencyUser } = useWorkspace();
  const { data: caps } = useVoiceCapabilities();
  const canOpenCalls = !!(caps?.live || caps?.demo);
  const href = channel === "chat" && canOpenCalls
    ? receptionistSettingsHref("voice", { accountId: isAgencyUser ? accountId : undefined, section: "knowledge" })
    : null;
  return (
    <p
      data-testid="receptionist-shared-note"
      style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--mute)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
    >
      <Link2 size={13} style={{ flexShrink: 0 }} />
      <span>{t(channel === "voice" ? "receptionistSettings.sharedVoice" : "receptionistSettings.sharedChat")}</span>
      {href && <Link href={href} className="font-semibold" style={{ color: "var(--wine)" }}>{t("receptionistSettings.openCalls")}</Link>}
    </p>
  );
}
