import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Bell, SlidersHorizontal, UserRound, X, type LucideIcon } from "lucide-react";
import { SectionCard } from "@/components/crm/primitives";
import { useBackButtonClose } from "@/components/crm/mobile/MobileSheet";
import { MobileHeaderIconBtn } from "@/components/crm/mobile/MobileListHeader";
import { readLastTab, writeLastTab } from "@/lib/lastTab";
import { MyProfileGate } from "./MyProfileGate";
import { NotificationsSection } from "./NotificationsSection";
import { PreferencesTab } from "./PreferencesTab";
import { ProfileTab } from "./ProfileTab";

const TABS = ["profile", "notifications", "preferences"] as const;
type ProfilePageTab = (typeof TABS)[number];

const TAB_ICON: Record<ProfilePageTab, LucideIcon> = {
  profile: UserRound,
  notifications: Bell,
  preferences: SlidersHorizontal,
};

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/**
 * Phone "My profile": one full-screen page over the More page, with Profile,
 * Notifications and Preferences tabs (the last one is remembered per user).
 * Each tab is one surface whose sections are split by spacing and eyebrow
 * headings (the `flat` variants), not a stack of cards. Theme and language stay
 * out: they are More tiles. Desktop Settings renders the same tabs as cards.
 */
export function MobileProfilePage({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation("settings");
  const [tab, setTab] = useState<ProfilePageTab>(() => readLastTab("profile", TABS, "profile"));
  const bodyRef = useRef<HTMLDivElement>(null);
  useBackButtonClose(open, onClose);

  const selectTab = (next: ProfilePageTab) => {
    setTab(next);
    writeLastTab("profile", next);
    bodyRef.current?.scrollTo({ top: 0 });
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="md:hidden"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "tween", duration: 0.32, ease: EASE_OUT }}
          style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", background: "var(--bg)" }}
          data-testid="mobile-profile-page"
        >
          {/* ── Header: title + close, tabs below (sand chrome like the More page) ── */}
          <div
            className="la-m-chrome"
            style={{ flexShrink: 0, background: "var(--chrome-deep)", borderBottom: "1px solid var(--line)", paddingTop: "var(--safe-top)" }}
          >
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, padding: "12px 16px 10px" }}>
              <span
                className="serif"
                style={{ fontSize: 27, lineHeight: 1.05, color: "var(--ink)", letterSpacing: "-0.02em", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {t("mobileProfile.title")}
              </span>
              <MobileHeaderIconBtn onClick={onClose} aria-label={t("mobileProfile.close")} data-testid="mobile-profile-page-close">
                <X size={16} />
              </MobileHeaderIconBtn>
            </div>
            <div style={{ padding: "0 16px 12px" }}>
              {/* Tabs size to their label (flex auto) so "Notifications" fits at 390px */}
              <div className="la-seg la-seg--fill" role="tablist" aria-label={t("mobileProfile.tabs")}>
                {TABS.map((id) => {
                  const Icon = TAB_ICON[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={tab === id}
                      onClick={() => selectTab(id)}
                      className={`la-seg-btn la-hit${tab === id ? " on" : ""}`}
                      style={{ flex: "1 1 auto", minHeight: 40, padding: "8px 6px", gap: 5, fontSize: 11, letterSpacing: "0.06em" }}
                      data-testid={`mobile-profile-tab-${id}`}
                    >
                      <span className="flex items-center"><Icon size={14} /></span>
                      {t(`sections.${id}`)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Body: one surface per tab; all three stay mounted so edits survive a tab switch ── */}
          <div
            ref={bodyRef}
            style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 16px calc(24px + var(--safe-bottom))" }}
          >
            <MyProfileGate testId="section-profile">
              {(profile, setProfile) => (
                <>
                  <SectionCard hidden={tab !== "profile"} className="p-5" role="tabpanel">
                    <ProfileTab profile={profile} onProfileUpdated={setProfile} flat />
                  </SectionCard>
                  <SectionCard hidden={tab !== "notifications"} className="p-5" role="tabpanel">
                    <NotificationsSection flat />
                  </SectionCard>
                  <SectionCard hidden={tab !== "preferences"} className="p-5" role="tabpanel">
                    <PreferencesTab
                      profile={profile}
                      onProfileUpdated={setProfile}
                      showNotifications={false}
                      showAppearance={false}
                      flat
                    />
                  </SectionCard>
                </>
              )}
            </MyProfileGate>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
