import { useEffect, useRef } from "react";
import { Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AVATAR_CHOICES, AGENT_AVATAR_URL, effectiveGender } from "./profileConstants";
import type { ProfileAnswers } from "./profileConstants";
import { composeSample, type PreviewMessage } from "./previewSample";

const AVATAR_COLORS: Record<(typeof AVATAR_CHOICES)[number], string> = {
  logo: "#7c3547",
  avatar: "#9e9e9e",
  avatarLogo: "#7c3547",
};

const HEADER_AVATAR = 36;
const MID_AVATAR = 25; // ~30% smaller than the header avatar, like real WhatsApp

// Fixed chat viewport — tall enough for ~4 balloons; new ones push older ones up
// and out of view (scroll up to revisit). Never grows with more messages.
const CHAT_HEIGHT = 340;

const BONE_BG = "#e8e0ce";        // warm bone chat background
const DOODLE_COLOR = "#c7b392";   // warm beige doodle strokes
const DOODLE_TILE = 230;          // px tile (smaller than before)

function InitialsCircle({ name, size, choice }: { name: string; size: number; choice: string | null }) {
  const initials = name.slice(0, 2).toUpperCase();
  const bg = AVATAR_COLORS[(choice as (typeof AVATAR_CHOICES)[number]) ?? "logo"] ?? "#7c3547";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--mono)", fontSize: Math.round(size * 0.36), fontWeight: 700, color: "#fff",
    }}>{initials}</div>
  );
}

function PortraitOrInitials({ avatarUrl, name, size, choice }: { avatarUrl?: string | null; name: string; size: number; choice: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, background: "#fff" }}
      />
    );
  }
  return <InitialsCircle name={name} size={size} choice={choice} />;
}

function AvatarBubble({ choice, name, size, logoUrl, avatarUrl }: { choice: string | null; name: string; size: number; logoUrl?: string | null; avatarUrl?: string | null }) {
  // "Company logo" (the `logo` choice) → use the account's image as the AI picture.
  if (choice === "logo" && logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, background: "#fff" }}
      />
    );
  }
  // "Avatar with logo badge" → the assistant portrait with the company logo in a tiny
  // circle on the bottom-right corner (distinct from the plain assistant avatar).
  if (choice === "avatarLogo") {
    const badge = Math.round(size * 0.42);
    return (
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <PortraitOrInitials avatarUrl={avatarUrl} name={name} size={size} choice="avatar" />
        <span style={{
          position: "absolute", right: -1, bottom: -1, width: badge, height: badge, borderRadius: "50%",
          background: "#fff", border: "1.5px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,0.08)",
          overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {logoUrl
            ? <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ width: "100%", height: "100%", background: "#7c3547" }} />}
        </span>
      </div>
    );
  }
  // "Assistant avatar" → the gendered portrait photo.
  return <PortraitOrInitials avatarUrl={avatarUrl} name={name} size={size} choice={choice} />;
}

function AiMessage({ msg, choice, agentName, logoUrl, avatarUrl }: { msg: PreviewMessage; choice: string | null; agentName: string; logoUrl?: string | null; avatarUrl?: string | null }) {
  return (
    <div className="la-chat-balloon" style={{ display: "flex", gap: 7, alignItems: "flex-end", maxWidth: "88%", marginBottom: 10 }}>
      <AvatarBubble choice={choice} name={agentName} size={MID_AVATAR} logoUrl={logoUrl} avatarUrl={avatarUrl} />
      <div style={{
        padding: "10px 14px", borderRadius: "14px 14px 14px 3px",
        background: "#ffffff", fontSize: 14, lineHeight: 1.45,
        color: "#222", boxShadow: "0 1px 1px rgba(0,0,0,0.08)",
      }}>
        {msg.text}
        <div style={{ fontSize: 11, color: "#9aa0a6", textAlign: "right", marginTop: 4 }}>
          {msg.time} <span style={{ color: "#53bdeb" }}>✓✓</span>
        </div>
      </div>
    </div>
  );
}

function LeadMessage({ msg }: { msg: PreviewMessage }) {
  return (
    <div className="la-chat-balloon" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
      <div style={{
        padding: "10px 14px", borderRadius: "14px 14px 3px 14px",
        background: "#dcf8c6", fontSize: 14, lineHeight: 1.45,
        color: "#222", maxWidth: "78%", boxShadow: "0 1px 1px rgba(0,0,0,0.06)",
      }}>
        {msg.text}
        <div style={{ fontSize: 11, color: "#67b563", textAlign: "right", marginTop: 4 }}>
          {msg.time}
        </div>
      </div>
    </div>
  );
}

export function WhatsAppPreview({ answers, accountName, accountLogoUrl, visibleCount }: { answers: ProfileAnswers; accountName?: string; accountLogoUrl?: string | null; visibleCount?: number }) {
  const { t } = useTranslation("communicationProfile");
  const agentName = answers.agentNameCustom || (answers.agentName ? t(`questions.agentName.options.${answers.agentName}.label`) : "Sophie");
  const avatarUrl = AGENT_AVATAR_URL[effectiveGender(answers)];
  const messages = composeSample(answers, t).slice(0, visibleCount ?? undefined);

  // Real-chat feel: balloons stack from the TOP; as new ones are revealed they push
  // the earlier ones up and out of the fixed viewport (scroll up to see them again).
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{
        borderRadius: 18, overflow: "hidden", display: "flex", flexDirection: "column",
        border: "1px solid var(--wine)", background: "#fff",
      }}>
        {/* WhatsApp header — white */}
        <div style={{
          background: "#ffffff", padding: "11px 15px", display: "flex", alignItems: "center", gap: 11,
          borderBottom: "1px solid #e5e5e5",
        }}>
          <AvatarBubble choice={answers.avatarChoice} name={agentName} size={HEADER_AVATAR} logoUrl={accountLogoUrl} avatarUrl={avatarUrl} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* WhatsApp shows the registered business name here, not the AI's persona
                name — Meta rejects display names that don't match the business. */}
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{accountName || agentName}</div>
            <div style={{ fontSize: 11, color: "#666", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{agentName}</div>
          </div>
          <Phone size={17} color="#555" />
        </div>

        {/* Chat area — fixed height, bone background with a warm-beige doodle (masked SVG) */}
        <div style={{ position: "relative", height: CHAT_HEIGHT, background: BONE_BG, overflow: "hidden" }}>
          <div
            aria-hidden
            style={{
              position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.5,
              backgroundColor: DOODLE_COLOR,
              maskImage: "url(/patterns/pattern-26.svg)",
              WebkitMaskImage: "url(/patterns/pattern-26.svg)",
              maskRepeat: "repeat", WebkitMaskRepeat: "repeat",
              maskSize: `${DOODLE_TILE}px auto`, WebkitMaskSize: `${DOODLE_TILE}px auto`,
            }}
          />
          <div ref={scrollRef} style={{ position: "relative", height: "100%", padding: "16px 14px", overflowY: "auto" }}>
            {messages.map((msg, i) =>
              msg.role === "ai"
                ? <AiMessage key={i} msg={msg} choice={answers.avatarChoice} agentName={agentName} logoUrl={accountLogoUrl} avatarUrl={avatarUrl} />
                : <LeadMessage key={i} msg={msg} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
