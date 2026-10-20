/**
 * ClientGuide: the in-app guide for a receptionist client (phone and website
 * chat). Written for the business owner, in the receptionist's own name.
 * Strings: docs.json > clientGuide.*
 */

import { useTranslation } from "react-i18next";
import {
  BookOpen,
  PhoneCall,
  MessageSquare,
  BellRing,
  CalendarCheck,
  SlidersHorizontal,
  Smartphone,
  HelpCircle,
} from "lucide-react";
import { DocSection, Step, Tip } from "./docParts";

export interface ClientGuideProps {
  /** The receptionist's name (campaign agent_name), or null when none is set. */
  agentName: string | null;
  companyName: string;
  hasPhone: boolean;
  hasWebsite: boolean;
}

const FAQ_KEYS = ["1", "2", "3", "4", "5", "6"] as const;

// The name is interpolated into strings that Step/Tip render as HTML.
const plain = (s: string) => s.replace(/[<>&"]/g, "");

/** A paragraph or list item whose string may carry <strong> markup. */
function Html({ as: Tag = "p", children }: { as?: "p" | "li"; children: string }) {
  return <Tag dangerouslySetInnerHTML={{ __html: children }} />;
}

export function ClientGuide({ agentName, companyName, hasPhone, hasWebsite }: ClientGuideProps) {
  const { t } = useTranslation("docs");
  const name = plain(agentName?.trim() || t("clientGuide.yourReceptionist"));
  const Name = name.charAt(0).toUpperCase() + name.slice(1);
  const company = plain(companyName);
  const vars = { name, Name, company };
  const k = (key: string) => t(`clientGuide.${key}`, vars);

  return (
    <div className="space-y-6 pb-8" data-testid="client-guide">
      {/* 1 Welcome */}
      <DocSection id="sec-welcome" icon={BookOpen} title={k("welcome.title")}>
        <Html>{k("welcome.intro")}</Html>
        <ul className="space-y-2 list-disc pl-5">
          <Html as="li">{k("welcome.home")}</Html>
          <Html as="li">{k("welcome.calls")}</Html>
          <Html as="li">{k("welcome.leads")}</Html>
          <Html as="li">{k("welcome.calendar")}</Html>
          <Html as="li">{k("welcome.receptionist")}</Html>
        </ul>
        <Tip>{k("welcome.tip")}</Tip>
      </DocSection>

      {/* 2 Phone */}
      {hasPhone && (
        <DocSection id="sec-phone" icon={PhoneCall} title={k("phone.title")}>
          <Html>{k("phone.intro")}</Html>
          <Step n={1}>{k("phone.calls")}</Step>
          <Step n={2}>{k("phone.transfers")}</Step>
          <Step n={3}>{k("phone.callbacks")}</Step>
          <Step n={4}>{k("phone.bookings")}</Step>
          <Tip>{k("phone.tip")}</Tip>
        </DocSection>
      )}

      {/* 3 Website chat */}
      {hasWebsite && (
        <DocSection id="sec-chat" icon={MessageSquare} title={k("chat.title")}>
          <Html>{k("chat.p1")}</Html>
          <Html>{k("chat.p2")}</Html>
        </DocSection>
      )}

      {/* 4 Recap and alerts */}
      <DocSection id="sec-recap" icon={BellRing} title={k("recap.title")}>
        <Html>{k("recap.intro")}</Html>
        <Html>{k("recap.recap")}</Html>
        <Html>{k("recap.alerts")}</Html>
        <p className="font-semibold text-foreground">{k("recap.addTitle")}</p>
        <Step n={1}>{k("recap.add1")}</Step>
        <Step n={2}>{k("recap.add2")}</Step>
        <Step n={3}>{k("recap.add3")}</Step>
      </DocSection>

      {/* 5 Calendar */}
      <DocSection id="sec-calendar" icon={CalendarCheck} title={k("calendar.title")}>
        <Html>{k("calendar.p1")}</Html>
        <Html>{k("calendar.p2")}</Html>
        <Html>{k("calendar.p3")}</Html>
        <Tip>{k("calendar.tip")}</Tip>
      </DocSection>

      {/* 6 What you can change */}
      <DocSection id="sec-change" icon={SlidersHorizontal} title={k("change.title")}>
        <Html>{k("change.intro")}</Html>
        <ul className="space-y-2 list-disc pl-5">
          <Html as="li">{k("change.hours")}</Html>
          <Html as="li">{k("change.alerts")}</Html>
          <Html as="li">{k("change.replies")}</Html>
          <Html as="li">{k("change.bookings")}</Html>
          <Html as="li">{k("change.busy")}</Html>
        </ul>
        <Html>{k("change.request")}</Html>
      </DocSection>

      {/* 7 Put the CRM on your phone */}
      <DocSection id="sec-install" icon={Smartphone} title={k("install.title")}>
        <Html>{k("install.intro")}</Html>
        <p className="font-semibold text-foreground">{k("install.iosTitle")}</p>
        <Step n={1}>{k("install.ios1")}</Step>
        <Step n={2}>{k("install.ios2")}</Step>
        <Step n={3}>{k("install.ios3")}</Step>
        <p className="font-semibold text-foreground">{k("install.androidTitle")}</p>
        <Step n={1}>{k("install.android1")}</Step>
        <Step n={2}>{k("install.android2")}</Step>
        <Step n={3}>{k("install.android3")}</Step>
      </DocSection>

      {/* 8 FAQ */}
      <DocSection id="sec-faq" icon={HelpCircle} title={k("faq.title")}>
        <div className="space-y-3">
          {FAQ_KEYS.map((n) => (
            <div key={n} className="rounded-[var(--r-button)] bg-popover px-4 py-3">
              <p className="font-semibold text-xs mb-1">{k(`faq.items.${n}.q`)}</p>
              <p className="text-xs text-muted-foreground">{k(`faq.items.${n}.a`)}</p>
            </div>
          ))}
        </div>
      </DocSection>
    </div>
  );
}
