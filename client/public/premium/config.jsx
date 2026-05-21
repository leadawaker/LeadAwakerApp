// Design configuration: tweaks, palettes, and utilities

/* --------------------------- RESPONSIVE HOOK ----------------------------- */
/* Single mobile breakpoint at <=768px. Exposed as window.useIsMobile so
   every script file can call it without imports. */
window.useIsMobile = function useIsMobile(breakpoint = 768) {
  const get = () => typeof window !== 'undefined' && window.innerWidth <= breakpoint;
  const [isMobile, setIsMobile] = React.useState(get);
  React.useEffect(() => {
    const onResize = () => setIsMobile(get());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 80));
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [breakpoint]);
  return isMobile;
};

/* ----------------------------- TWEAK DEFAULTS ----------------------------- */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": 0,
  "displayFont": "Instrument Serif",
  "wineIntensity": "subtle",
  "depthScale": 0.4,
  "logoVariant": "horizontal",
  "lightAngle": 70,
  "lightDistance": 100,
  "lightIntensity": 100,
  "textures": true,
  "scrollLight": false
} /*EDITMODE-END*/;

const PALETTES = [
{ name: "Porcelain", bg: "#EFEAE0", bg2: "#E7E0D2", paper: "#F8F3E8",
  ink: "#1C1916", mute: "#766C5F", line: "rgba(110,95,65,0.12)",
  wine: "#5E2230", wineSoft: "#7A2E3E",
  neuDark: "rgba(125,90,55,0.38)", neuLight: "rgba(255,253,247,0.98)",
  neuDarkSoft: "rgba(125,90,55,0.20)", neuLightSoft: "rgba(255,253,247,0.75)",
  glassBg: "rgba(255,253,247,0.55)", glassBgStrong: "rgba(255,253,247,0.78)"
}];

function applyPalette(idx) {
  const p = PALETTES[idx] || PALETTES[0];
  const r = document.documentElement.style;
  r.setProperty("--bg", p.bg);
  r.setProperty("--bg-2", p.bg2);
  r.setProperty("--paper", p.paper);
  r.setProperty("--ink", p.ink);
  r.setProperty("--mute", p.mute);
  r.setProperty("--line", p.line);
  r.setProperty("--wine", p.wine);
  r.setProperty("--wine-soft", p.wineSoft);
  r.setProperty("--neu-dark", p.neuDark);
  r.setProperty("--neu-light", p.neuLight);
  r.setProperty("--neu-dark-soft", p.neuDarkSoft);
  r.setProperty("--neu-light-soft", p.neuLightSoft);
  r.setProperty("--glass-bg", p.glassBg);
  r.setProperty("--glass-bg-strong", p.glassBgStrong);
}

function applyDepth(scale) {
  document.documentElement.style.setProperty("--depth-scale", String(scale));
}

function applyFonts(display) {
  const r = document.documentElement.style;
  const serifMap = {
    "Instrument Serif":   '"Instrument Serif", Georgia, serif',
    "Cormorant Garamond": '"Cormorant Garamond", Georgia, serif',
    "Bodoni Moda":        '"Bodoni Moda", "Bodoni 72", Georgia, serif',
    "Playfair Display":   '"Playfair Display", Georgia, serif',
    "EB Garamond":        '"EB Garamond", Georgia, serif',
    "Newsreader":         '"Newsreader", Georgia, serif',
    "Lora":               '"Lora", Georgia, serif',
    "Yeseva One":         '"Yeseva One", Georgia, serif',
    "Geist Mono":         '"Geist Mono", monospace',
    "Manrope":            '"Manrope", ui-sans-serif, sans-serif',
  };
  r.setProperty("--serif", serifMap[display] || serifMap["Instrument Serif"]);
}

function applyLight(angleDeg, distance, intensity) {
  const a = angleDeg * Math.PI / 180;
  const lx = Math.cos(a);
  const ly = -Math.sin(a);
  const r = document.documentElement.style;
  r.setProperty("--lx", lx.toFixed(3));
  r.setProperty("--ly", ly.toFixed(3));

  const d = Math.max(0, Math.min(100, distance));
  const cx = 50 + lx * (d * 0.55);
  const cy = 50 + ly * (d * 0.55);
  r.setProperty("--light-x", cx.toFixed(1) + "%");
  r.setProperty("--light-y", cy.toFixed(1) + "%");
  r.setProperty("--light-intensity", (intensity / 100).toFixed(2));

  const strength = 0.35 + d / 100 * 1.5;
  r.setProperty("--light-strength", strength.toFixed(2));
}

/* Animate light to a target angle. Reads current --lx to derive from-angle;
   distance and intensity stay at their defaults. */
window.setLightAngle = function setLightAngle(targetDeg, duration = 700) {
  const currentLx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lx')) || Math.cos(65 * Math.PI / 180);
  const currentLy = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ly')) || -Math.sin(65 * Math.PI / 180);
  const fromAngle = Math.atan2(-currentLy, currentLx) * 180 / Math.PI;
  const dist = TWEAK_DEFAULTS.lightDistance;
  const intensity = TWEAK_DEFAULTS.lightIntensity;
  const t0 = performance.now();
  let raf;
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / duration);
    const eased = k * (2 - k);
    applyLight(fromAngle + (targetDeg - fromAngle) * eased, dist, intensity);
    if (k < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
};

window.ArrowSm = function ArrowSm() {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden>
      <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>);
};

/* --------------------------- CHAT CASE DATA ------------------------------ */
const CHAT_CASES = {
  kitchen: {
    label: "Kitchen",
    leadName: "Sarah Mitchell",
    avatar: "S",
    project: "Full kitchen remodel",
    ago: "7 mo. ago",
    agentName: "James",
    domain: "pembrookstudio",
    messages: [
      { type: "agent", content: "Hi, James from Pembrook Studio here. Are you the same Sarah who was looking at a full kitchen remodel with us back in autumn? 🙂", time: "10:15 AM" },
      { type: "system", content: "Lead engaged" },
      { type: "user", content: "yes that's me", time: "10:22 AM" },
      { type: "system", content: "Lead replied" },
      { type: "agent", content: "Thanks for coming back. We hadn't heard from you in a while and didn't want to chase.", time: "10:23 AM" },
      { type: "agent", content: "Just wanted to check if the kitchen project was still on your radar for this year.", time: "10:23 AM" },
      { type: "user", content: "It is, actually.", time: "10:31 AM" },
      { type: "user", content: "We've been looking around a bit more since then.", time: "10:31 AM" },
      { type: "agent", content: "That makes sense, it's not a small decision. Is there something specific you're still weighing, or has it come down to comparing a couple of firms?", time: "10:32 AM" },
      { type: "user", content: "The latter, honestly.", time: "10:44 AM" },
      { type: "user", content: "My husband did a lot of research after we got your quote. We're between you and one other studio.", time: "10:45 AM" },
      { type: "system", content: "Competitive situation surfaced" },
      { type: "agent", content: "I appreciate you being upfront about that. Is it mainly a price comparison, or is there something in the design or process that's making it a harder call?", time: "10:46 AM" },
      { type: "user", content: "Price is similar actually.", time: "10:57 AM" },
      { type: "user", content: "The other firm said they could start in six weeks. That appealed to us.", time: "10:57 AM" },
      { type: "agent", content: "Six weeks is fast for a kitchen of that scope, which usually means the cabinetry is semi-custom rather than fully bespoke.", time: "10:58 AM" },
      { type: "agent", content: "Yours was spec'd with handleless panels, a waterfall island, and integrated lighting. How does their design feel in terms of finish quality?", time: "10:59 AM" },
      { type: "user", content: "that's the thing", time: "11:09 AM" },
      { type: "user", content: "it feels a bit more standard honestly", time: "11:10 AM" },
      { type: "system", content: "Key differentiator surfaced" },
      { type: "agent", content: "That gap usually shows up more in person than on a screen. The difference in how a panel sits, how a drawer closes, the weight of a detail: it's hard to judge from renders.", time: "11:11 AM" },
      { type: "agent", content: "Would it be worth a showroom visit so you can see the finish quality side by side? No commitment, just a proper look.", time: "11:12 AM" },
      { type: "user", content: "yes, I think that would actually help a lot", time: "11:25 AM" },
      { type: "system", content: "Lead qualified" },
      { type: "agent", content: "Here's our booking link: pembrookstudio.com/visit", time: "11:26 AM" },
      { type: "system", content: "Showroom visit booked 📅", wine: true },
      { type: "agent", content: "You're booked for Saturday at 11:00 ✅", time: "11:38 AM" },
      { type: "agent", content: "I'll have the island spec from your original quote set up so you can touch and compare properly. My director will walk you through it.", time: "11:38 AM" },
      { type: "user", content: "Really appreciate that, thank you", time: "11:42 AM" },
      { type: "agent", content: "You're welcome. See you Saturday 🙂", time: "11:43 AM" },
      { type: "system", content: "Closed. Sent to Client", wine: true }
    ]
  },
  flooring: {
    label: "Flooring",
    leadName: "Caroline Hirst",
    avatar: "C",
    project: "Parquet restoration",
    ago: "5 mo. ago",
    agentName: "Lena",
    domain: "grainfloor",
    messages: [
      { type: "agent", content: "Hi, Lena from Grain Floor here. Is this the same Caroline who came to us about restoring the parquet in her 1920s house?", time: "10:05 AM" },
      { type: "system", content: "Lead engaged" },
      { type: "user", content: "yes that's me", time: "10:14 AM" },
      { type: "system", content: "Lead replied" },
      { type: "agent", content: "Thanks for coming back. I noticed we sent the quote but never heard back.", time: "10:15 AM" },
      { type: "agent", content: "Is the project still on? Or did something change?", time: "10:15 AM" },
      { type: "user", content: "it's still on", time: "10:26 AM" },
      { type: "user", content: "we just can't agree on what to do", time: "10:26 AM" },
      { type: "agent", content: "What's the disagreement about?", time: "10:27 AM" },
      { type: "user", content: "my husband wants to restore the original boards", time: "10:38 AM" },
      { type: "user", content: "I'm tempted to replace them with wider planks in the extension too so it all matches", time: "10:39 AM" },
      { type: "system", content: "Key tension surfaced" },
      { type: "agent", content: "That's a really common split on period properties.", time: "10:40 AM" },
      { type: "agent", content: "Restored original parquet holds more of the house's character and typically adds more value. Wider planks can look beautiful but they read as a renovation rather than the house itself.", time: "10:40 AM" },
      { type: "agent", content: "What period are the existing boards? Knowing the species and age helps a lot here.", time: "10:41 AM" },
      { type: "user", content: "I think they're oak, 1924 if the deeds are right", time: "10:55 AM" },
      { type: "user", content: "some are damaged in the hallway but the main room is intact", time: "10:56 AM" },
      { type: "system", content: "Lead qualified" },
      { type: "agent", content: "Century-old oak is genuinely irreplaceable. We can source matching pieces from reclaimed stock for the hallway so it reads as one continuous floor.", time: "10:57 AM" },
      { type: "agent", content: "Would it help to bring both of you in to see a sample restoration alongside a wide-plank option? That conversation is much easier in person.", time: "10:58 AM" },
      { type: "user", content: "actually yes, that would probably settle it", time: "11:14 AM" },
      { type: "agent", content: "Here's the booking link: grainfloor.com/visit", time: "11:15 AM" },
      { type: "system", content: "Studio visit booked 📅", wine: true },
      { type: "agent", content: "You're both in for Saturday at 10:30 ✅", time: "11:28 AM" },
      { type: "agent", content: "I'll have a restored panel and a wide-plank sample set up so you can compare them properly.", time: "11:28 AM" },
      { type: "user", content: "perfect, thank you Lena", time: "11:34 AM" },
      { type: "agent", content: "See you Saturday 🙂", time: "11:35 AM" },
      { type: "system", content: "Closed. Sent to Client", wine: true }
    ]
  },
  wellness: {
    label: "Wellness",
    leadName: "Emma Whitfield",
    avatar: "E",
    project: "Wellness bathroom suite",
    ago: "6 mo. ago",
    agentName: "Clara",
    domain: "aldertonbath",
    messages: [
      { type: "agent", content: "Hi, Clara from Alderton Bath Studio here. Is this the same Emma who came to us about a wellness bathroom earlier this year?", time: "11:10 AM" },
      { type: "system", content: "Lead engaged" },
      { type: "user", content: "yes that's me", time: "11:19 AM" },
      { type: "system", content: "Lead replied" },
      { type: "agent", content: "Thanks Emma. We sent the quote for the steam shower and limestone suite but never heard back.", time: "11:20 AM" },
      { type: "agent", content: "Is the project still on your radar?", time: "11:20 AM" },
      { type: "user", content: "yes, I was waiting on my interior designer before committing", time: "11:31 AM" },
      { type: "agent", content: "Completely makes sense. Has she come back to you on it?", time: "11:32 AM" },
      { type: "user", content: "actually yes, ages ago", time: "11:44 AM" },
      { type: "user", content: "I just never got round to following up with you", time: "11:44 AM" },
      { type: "system", content: "Real reason surfaced" },
      { type: "agent", content: "No worries at all. What did she say about the spec?", time: "11:45 AM" },
      { type: "user", content: "she loved the steam shower and the limestone combo", time: "11:57 AM" },
      { type: "user", content: "she actually suggested we carry the limestone through into the dressing room as well", time: "11:58 AM" },
      { type: "system", content: "Scope expanded" },
      { type: "agent", content: "That's a beautiful extension of the brief. Continuous stone from the bathroom through to the dressing room reads as one considered space rather than two separate rooms.", time: "11:59 AM" },
      { type: "agent", content: "It would be worth bringing her in for the design session so we spec the two rooms together. Would that work for both of you?", time: "12:00 PM" },
      { type: "user", content: "yes I think she'd appreciate being part of that", time: "12:14 PM" },
      { type: "system", content: "Lead qualified" },
      { type: "agent", content: "Here's the booking link: aldertonbath.com/design", time: "12:15 PM" },
      { type: "system", content: "Design session booked 📅", wine: true },
      { type: "agent", content: "You're both in for Thursday at 14:00 ✅", time: "12:28 PM" },
      { type: "agent", content: "I'll pull the original quote and brief your designer on the limestone options before you arrive.", time: "12:28 PM" },
      { type: "user", content: "that's really thoughtful, thank you Clara", time: "12:35 PM" },
      { type: "agent", content: "Looking forward to it. See you Thursday 🙂", time: "12:36 PM" },
      { type: "system", content: "Closed. Sent to Client", wine: true }
    ]
  },
  landscaping: {
    label: "Garden",
    leadName: "Thomas Renner",
    avatar: "T",
    project: "Garden & terrace redesign",
    ago: "9 mo. ago",
    agentName: "Mia",
    domain: "groundworkstudio",
    messages: [
      { type: "agent", content: "Hi, Mia from Groundwork Studio. Is this the same Thomas who came to us about redesigning the garden and terrace last spring?", time: "09:45 AM" },
      { type: "system", content: "Lead engaged" },
      { type: "user", content: "yes that's right", time: "09:54 AM" },
      { type: "system", content: "Lead replied" },
      { type: "agent", content: "Thanks for coming back. We sent the design brief and quote but never heard from you after that.", time: "09:55 AM" },
      { type: "agent", content: "Is the project still something you're thinking about?", time: "09:55 AM" },
      { type: "user", content: "yes it is", time: "10:07 AM" },
      { type: "user", content: "we kept putting it off honestly", time: "10:07 AM" },
      { type: "agent", content: "What's been holding it up?", time: "10:08 AM" },
      { type: "user", content: "we redid the kitchen last year so the budget was tied up", time: "10:19 AM" },
      { type: "user", content: "but that's done now and the garden is the last thing", time: "10:20 AM" },
      { type: "system", content: "Budget freed up. Garden is next." },
      { type: "agent", content: "That makes sense. Garden usually comes last. The brief you gave us was quite specific: limestone terrace, raised beds along the north wall, and the pergola structure.", time: "10:21 AM" },
      { type: "agent", content: "Has anything changed since we last spoke, or is that still the direction?", time: "10:21 AM" },
      { type: "user", content: "largely the same", time: "10:33 AM" },
      { type: "user", content: "though my wife wants to add an outdoor kitchen area near the pergola now", time: "10:34 AM" },
      { type: "system", content: "Outdoor kitchen added to scope" },
      { type: "agent", content: "That's a natural extension and works really well with the pergola position you had in mind.", time: "10:35 AM" },
      { type: "agent", content: "We'd need to revisit the layout slightly. The gas and drainage routing changes depending on where we anchor the structure. Worth doing a fresh site visit so we measure it properly.", time: "10:35 AM" },
      { type: "user", content: "yes that makes sense", time: "10:48 AM" },
      { type: "system", content: "Lead qualified" },
      { type: "agent", content: "Here's our booking link: groundworkstudio.com/visit", time: "10:49 AM" },
      { type: "system", content: "Site visit booked 📅", wine: true },
      { type: "agent", content: "You're booked for Wednesday at 10:00 ✅", time: "11:02 AM" },
      { type: "agent", content: "I'll bring the original drawings so we can mark up the outdoor kitchen position on-site.", time: "11:02 AM" },
      { type: "user", content: "perfect, looking forward to it", time: "11:09 AM" },
      { type: "agent", content: "See you Wednesday 🙂", time: "11:10 AM" },
      { type: "system", content: "Closed. Sent to Client", wine: true }
    ]
  },
  roofing: {
    label: "Roofing",
    leadName: "Daniel Marsh",
    avatar: "D",
    project: "Heritage roof repair",
    ago: "6 mo. ago",
    agentName: "Will",
    domain: "apexheritage",
    messages: [
      { type: "agent", content: "Hi, Will from Apex Heritage Roofing. Is this the same Daniel who came to us about storm damage repairs on his Victorian terrace?", time: "11:10 AM" },
      { type: "system", content: "Lead engaged" },
      { type: "user", content: "yes that's me", time: "11:19 AM" },
      { type: "system", content: "Lead replied" },
      { type: "agent", content: "Thanks for coming back. We surveyed the ridge tiles and lead flashing back in the autumn but never heard from you after the quote.", time: "11:20 AM" },
      { type: "agent", content: "Is the repair still on your radar?", time: "11:20 AM" },
      { type: "user", content: "it is, yes", time: "11:31 AM" },
      { type: "user", content: "the insurance payout was lower than expected so we've been sitting on it", time: "11:32 AM" },
      { type: "system", content: "Insurance shortfall surfaced" },
      { type: "agent", content: "That's a common situation with period properties. What did they settle at, if you don't mind me asking?", time: "11:33 AM" },
      { type: "user", content: "they covered about two thirds of your quote", time: "11:45 AM" },
      { type: "user", content: "said the rest was wear and tear", time: "11:45 AM" },
      { type: "agent", content: "Typical response on older properties. The honest position is that the ridge and flashing work needs doing regardless. Leaving it through another winter risks the structural timbers underneath.", time: "11:46 AM" },
      { type: "agent", content: "We could scope down to the most urgent sections first if that helps bridge the gap.", time: "11:46 AM" },
      { type: "user", content: "which sections are those?", time: "11:58 AM" },
      { type: "system", content: "Scope prioritised" },
      { type: "agent", content: "The north valley and the chimney stack flashing are the two points actively letting water in. The ridge tiles on the rear slope can wait another season if they have to.", time: "11:59 AM" },
      { type: "agent", content: "Worth doing a quick re-survey so I can give you a revised number for just those two areas.", time: "11:59 AM" },
      { type: "user", content: "yes that would help a lot actually", time: "12:13 PM" },
      { type: "system", content: "Lead qualified" },
      { type: "agent", content: "Here's our booking link: apexheritage.com/survey", time: "12:14 PM" },
      { type: "system", content: "Survey booked 📅", wine: true },
      { type: "agent", content: "You're booked for Tuesday at 09:00 ✅", time: "12:27 PM" },
      { type: "agent", content: "I'll bring the original survey notes so we can compare and focus on what needs doing now.", time: "12:27 PM" },
      { type: "user", content: "really appreciate that, thank you", time: "12:34 PM" },
      { type: "agent", content: "See you Tuesday 🙂", time: "12:35 PM" },
      { type: "system", content: "Closed. Sent to Client", wine: true }
    ]
  }
};

/* ----------------------------- i18n SYSTEM -------------------------------- */

const I18nContext = React.createContext(null);

window.I18nProvider = function I18nProvider({ children }) {
  const defaultLang = (navigator.language || '').startsWith('nl') ? 'nl' : 'en';
  const [lang, setLang] = React.useState(defaultLang);

  const t = React.useCallback((path) => {
    const keys = path.split('.');
    const navigate = (obj) => keys.reduce((o, k) => o != null ? o[k] : undefined, obj);
    const tr = window.TRANSLATIONS || {};
    if (lang !== 'en') {
      const val = navigate(tr[lang]);
      if (val !== undefined && val !== null) return val;
    }
    const fallback = navigate(tr['en']);
    return fallback !== undefined ? fallback : path;
  }, [lang]);

  return React.createElement(I18nContext.Provider, { value: { lang, setLang, t } }, children);
};

window.useI18n = function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be called inside I18nProvider');
  return ctx;
};
