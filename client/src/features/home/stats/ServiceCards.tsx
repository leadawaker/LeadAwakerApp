import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { AudioLines, Clapperboard, Globe, MessageCircle, RefreshCw, Star } from "lucide-react";
import { readLastTab, writeLastTab } from "@/lib/lastTab";
import { useWorkspace } from "@/hooks/useWorkspace";
import { openAccountReactivation } from "@/features/accounts/components/workspace/reactivation/reactivationLink";
import type { Compared, HomePeriod, HomeServices } from "@shared/homeTypes";
import {
  useHomePhone, useHomeReactivation, useHomeReputation, useHomeSocial, useHomeWebsite, useHomeWhatsapp, type HomeScope,
} from "../api/homeApi";
import { ServiceCard, type CardTrend } from "../components/ServiceCard";
import { rateOf, trendOf } from "../lib/homeFormat";
import phoneArt from "@/assets/home/phone.webp";
import whatsappArt from "@/assets/home/whatsapp.webp";
import websiteArt from "@/assets/home/website.webp";
import reactivationArt from "@/assets/home/reactivation.webp";
import reputationArt from "@/assets/home/reputation.webp";
import socialArt from "@/assets/home/social.webp";

export type ServiceKey = "phone" | "whatsapp" | "website" | "reactivation" | "reputation" | "social";
const ORDER: ServiceKey[] = ["phone", "whatsapp", "website", "reactivation", "reputation", "social"];

/** Anchor ids, so a "By channel" row (or an old ?tab= link) can scroll to its card. */
export const SERVICE_ANCHOR: Record<ServiceKey, string> = {
  phone: "stats-phone", whatsapp: "stats-whatsapp", website: "stats-website",
  reactivation: "stats-reactivation", reputation: "stats-reputation", social: "stats-social",
};

type T = (key: string, opts?: Record<string, unknown>) => string;
const DASH = "…";
const pct = (n: number | null) => (n === null ? "-" : `${n}%`);

/** "+20% vs last month", or null when there is nothing to compare with ("All time" never has). */
function trendText(c: Compared | undefined, period: HomePeriod, t: T): CardTrend | null {
  const tr = c && period !== "all" ? trendOf(c) : null;
  if (!tr) return null;
  return { dir: tr.dir, text: `${tr.dir === "up" ? "+" : tr.dir === "down" ? "-" : ""}${tr.pct}% ${t(`vs.${period}`)}` };
}

type CardProps = { scope: HomeScope; t: T; go: (to: string) => void; showTrend: boolean };

function PhoneCard({ scope, t, go, showTrend }: CardProps) {
  const { data } = useHomePhone(scope);
  // Open the Calls list, also when the page was last left on Settings.
  const open = () => {
    if (readLastTab<string>("calls", ["settings"], "") === "settings") writeLastTab("calls", readLastTab<string>("calls.list", ["people", "calls"], "people"));
    go("/platform/voice-calls");
  };
  return (
    <ServiceCard id={SERVICE_ANCHOR.phone} testId="stats-card-phone" art={phoneArt} artPos="100% 50%" color="var(--wine)" icon={AudioLines}
      title={t("tabs.phone")} mainLabel={t("cards.phone.main")} mainValue={data?.calls.value ?? DASH}
      corner={{ label: t("cards.phone.minutes"), value: data?.minutes ?? DASH }}
      trend={trendText(data?.calls, scope.period, t)} spark={data?.perDay}
      stats={[
        { key: "booked", label: t("phone.tiles.booked"), value: data?.booked.value ?? DASH },
        { key: "transferred", label: t("phone.tiles.transferred"), value: data?.transferred.value ?? DASH },
      ]}
      showTrend={showTrend} onOpen={open} />
  );
}

/** Chats opens on its list, not on Settings. */
const openChats = (go: (to: string) => void) => () => { writeLastTab("chats", "chats"); go("/platform/chat"); };

function WhatsappCard({ scope, t, go, showTrend }: CardProps) {
  const { data } = useHomeWhatsapp(scope);
  return (
    <ServiceCard id={SERVICE_ANCHOR.whatsapp} testId="stats-card-whatsapp" art={whatsappArt} artPos="95% 60%" color="var(--stage-multi)" icon={MessageCircle}
      title={t("tabs.whatsapp")} mainLabel={t("cards.whatsapp.main")} mainValue={data?.conversations.value ?? DASH}
      trend={trendText(data?.conversations, scope.period, t)} spark={data?.perDay}
      stats={[
        { key: "bookings", label: t("whatsapp.tiles.bookings"), value: data?.bookings.value ?? DASH },
        { key: "handedOff", label: t("whatsapp.tiles.handedOff"), value: data?.handedOff.value ?? DASH },
      ]}
      showTrend={showTrend} onOpen={openChats(go)} />
  );
}

function WebsiteCard({ scope, t, go, showTrend }: CardProps) {
  const { data } = useHomeWebsite(scope);
  return (
    <ServiceCard id={SERVICE_ANCHOR.website} testId="stats-card-website" art={websiteArt} artPos="100% 20%" color="var(--stage-contacted)" icon={Globe}
      title={t("tabs.website")} mainLabel={t("cards.website.main")} mainValue={data?.chats.value ?? DASH}
      trend={trendText(data?.chats, scope.period, t)} spark={data?.perDay}
      stats={[
        { key: "contacts", label: t("website.tiles.contacts"), value: data?.contacts.value ?? DASH },
        { key: "bookings", label: t("website.tiles.bookings"), value: data?.bookings.value ?? DASH },
      ]}
      showTrend={showTrend} onOpen={openChats(go)} />
  );
}

function ReactivationCard({ scope, t, go, isAgency, showTrend }: CardProps & { isAgency: boolean }) {
  const { data } = useHomeReactivation(scope);
  const [, setLocation] = useLocation();
  // The agency opens the campaigns in Accounts > Reactivation; a client reads the replies in Chats.
  const open = isAgency ? () => openAccountReactivation(setLocation, scope.accountId) : openChats(go);
  return (
    <ServiceCard id={SERVICE_ANCHOR.reactivation} testId="stats-card-reactivation" art={reactivationArt} artPos="100% 60%" color="var(--stage-booked)" icon={RefreshCw}
      title={t("tabs.reactivation")} mainLabel={t("cards.reactivation.main")} mainValue={data?.bookings.value ?? DASH}
      trend={trendText(data?.bookings, scope.period, t)} spark={data?.perDay.map((p) => ({ day: p.day, value: p.bookings }))}
      stats={[
        { key: "replyRate", label: t("reactivation.tiles.replyRate"), value: data ? pct(rateOf(data.replied.value, data.contacted.value)) : DASH },
        { key: "campaigns", label: t("cards.reactivation.campaigns"), value: data?.campaigns.length ?? DASH },
      ]}
      showTrend={showTrend} onOpen={open} />
  );
}

function ReputationCard({ scope, t, go, isAgency, showTrend }: CardProps & { isAgency: boolean }) {
  const { data } = useHomeReputation(scope);
  const avg = data?.avgRating.value ?? null;
  const prev = data?.avgRating.previous ?? null;
  // The rating moves in tenths, not percent: "+0.2 vs last month".
  const diff = avg !== null && prev !== null ? Math.round((avg - prev) * 10) / 10 : null;
  const trend: CardTrend | null = diff === null || scope.period === "all" ? null : {
    dir: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
    text: `${diff > 0 ? "+" : ""}${diff.toFixed(1)} ${t(`vs.${scope.period}`)}`,
  };
  return (
    <ServiceCard id={SERVICE_ANCHOR.reputation} testId="stats-card-reputation" art={reputationArt} artPos="100% 45%" color="var(--stage-booked)" icon={Star}
      title={t("tabs.reputation")} mainLabel={t("reputation.tiles.avgRating")} mainValue={!data ? DASH : avg === null ? "-" : avg.toFixed(1)}
      trend={trend} spark={data?.perDay}
      stats={[
        { key: "reviews", label: t("cards.reputation.reviews"), value: data?.reviews.value ?? DASH },
        { key: "awaiting", label: t("cards.reputation.awaiting"), value: data?.awaitingReply ?? DASH },
      ]}
      // The Reputation page is agency-only.
      showTrend={showTrend} onOpen={isAgency ? () => go("/platform/reputation") : undefined} />
  );
}

function SocialCard({ scope, t, go, showTrend }: CardProps) {
  const { data } = useHomeSocial(scope);
  return (
    <ServiceCard id={SERVICE_ANCHOR.social} testId="stats-card-social" art={socialArt} artPos="100% 55%" color="var(--stage-new)" icon={Clapperboard}
      title={t("tabs.social")} mainLabel={t("cards.social.main")} mainValue={data?.conversations.value ?? DASH}
      trend={trendText(data?.conversations, scope.period, t)} spark={data?.perDay}
      stats={[
        { key: "bookings", label: t("social.tiles.bookings"), value: data?.bookings.value ?? DASH },
        { key: "rate", label: t("social.tiles.bookingRate"), value: data ? pct(rateOf(data.bookings.value, data.conversations.value)) : DASH },
      ]}
      showTrend={showTrend} onOpen={() => go("/platform/social")} />
  );
}

/** True while the row has cards hidden past its right edge: that is when the fade shows. */
function useMoreToTheRight() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [more, setMore] = useState(false);
  const measure = useCallback(() => {
    const el = ref.current;
    if (el) setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);
  return { ref, more, measure };
}

/**
 * Click and drag the row sideways with a mouse (touch scrolls by itself). A drag
 * never opens the card it started on; a plain click still does.
 */
function useDragScroll(ref: React.RefObject<HTMLDivElement | null>) {
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const end = () => {
    ref.current?.classList.remove("is-dragging");
    window.setTimeout(() => { drag.current = null; }); // After the click this drag may have caused.
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      const el = ref.current;
      if (el && e.pointerType === "mouse" && e.button === 0) drag.current = { x: e.clientX, left: el.scrollLeft, moved: false };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const el = ref.current, d = drag.current;
      if (!el || !d) return;
      const dx = e.clientX - d.x;
      if (!d.moved) {
        if (Math.abs(dx) < 5) return;
        d.moved = true;
        el.setPointerCapture(e.pointerId);
        el.classList.add("is-dragging");
      }
      el.scrollLeft = d.left - dx;
    },
    onPointerUp: end,
    onPointerCancel: end,
    onClickCapture: (e: React.MouseEvent) => {
      if (drag.current?.moved) { e.preventDefault(); e.stopPropagation(); }
    },
  };
}

/**
 * One card per switched-on service, in a single row that scrolls sideways
 * (snapping card by card on a phone). The period picked on the page drives them.
 */
export function ServiceCards({ scope, services }: { scope: HomeScope; services: HomeServices }) {
  const { t } = useTranslation("home");
  const [, setLocation] = useLocation();
  const { isAgencyUser } = useWorkspace();
  const row = useMoreToTheRight();
  const dragProps = useDragScroll(row.ref);
  const tt: T = (key, opts) => String(t(key, opts));
  const props: CardProps = { scope, t: tt, go: setLocation, showTrend: scope.period !== "all" };
  const isAgency = !!isAgencyUser;
  const on = ORDER.filter((k) => services[k]);
  if (on.length === 0) return null;
  return (
    <div ref={row.ref} onScroll={row.measure} {...dragProps} className={row.more ? "home-cards home-cards--more" : "home-cards"} data-testid="stats-service-cards">
      {on.map((k) => (
        k === "phone" ? <PhoneCard key={k} {...props} />
          : k === "whatsapp" ? <WhatsappCard key={k} {...props} />
          : k === "website" ? <WebsiteCard key={k} {...props} />
          : k === "reactivation" ? <ReactivationCard key={k} {...props} isAgency={isAgency} />
          : k === "reputation" ? <ReputationCard key={k} {...props} isAgency={isAgency} />
          : <SocialCard key={k} {...props} />
      ))}
    </div>
  );
}
