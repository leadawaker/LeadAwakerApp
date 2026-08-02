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

/* Fallback stubs — overridden by tweaks-panel.jsx when present on dev */
if (!window.useTweaks) {
  window.useTweaks = function(defaults) {
    return [defaults, function() {}];
  };
}
if (!window.TweaksPanel) {
  window.TweaksPanel = null;
}

/* ----------------------------- TWEAK DEFAULTS ----------------------------- */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": 0,
  "displayFont": "Playfair Display",
  "wineIntensity": "subtle",
  "depthScale": 0.4,
  "logoVariant": "horizontal",
  "lightAngle": 130,
  "lightDistance": 100,
  "lightIntensity": 100,
  "textures": true,
  "scrollLight": false
} /*EDITMODE-END*/;

const PALETTES = [
{ name: "Porcelain", bg: "#EFEAE0", bg2: "#E7E0D2", paper: "#F8F3E8",
  surface: "#F1ECE2",
  glowWarm: "rgba(255,230,180,0.18)", glowWarmSoft: "rgba(255,230,180,0.10)",
  surfaceVeil: "rgba(237,231,219,0.30)",
  ink: "#1C1916", mute: "#766C5F", line: "rgba(110,95,65,0.12)",
  wine: "#5E2230", wineSoft: "#7A2E3E",
  neuDark: "rgba(125,90,55,0.38)", neuLight: "rgba(255,253,247,0.98)",
  neuDarkSoft: "rgba(125,90,55,0.20)", neuLightSoft: "rgba(255,253,247,0.75)",
  glassBg: "rgba(255,253,247,0.55)", glassBgStrong: "rgba(255,253,247,0.78)"
}];

/* Bone: the same neumorphic system with the yellow pulled out and a touch of
   grey added. Reads technical rather than boutique-interiors, which suits a
   solar installer. /home keeps Porcelain, where the warmth fits the trade. */
const BONE_OVERRIDE = {
  bg: "#ECE9E1", bg2: "#E4E1D8", paper: "#F6F4EE",
  // Card surface and the warm glows sitting on top of it: the FAQ cards, CTA
  // panel, audit readout, week panels, buttons and demo fields all read from
  // these, which is why they stayed cream when only bg/paper moved.
  surface: "#EEEBE4",
  glowWarm: "rgba(240,237,226,0.22)", glowWarmSoft: "rgba(240,237,226,0.13)",
  surfaceVeil: "rgba(234,231,223,0.30)",
  ink: "#1B1A17", mute: "#6F6B62", line: "rgba(95,90,75,0.13)",
  neuDark: "rgba(105,98,80,0.36)", neuLight: "rgba(255,254,251,0.98)",
  neuDarkSoft: "rgba(105,98,80,0.19)", neuLightSoft: "rgba(255,254,251,0.75)",
  glassBg: "rgba(255,254,251,0.55)", glassBgStrong: "rgba(255,254,251,0.78)",
};

function applyPalette(idx) {
  const base = PALETTES[idx] || PALETTES[0];
  // SITE_VARIANT is resolved further down this file; applyPalette is only ever
  // called from app-main.jsx, which runs after config.jsx has finished.
  const p = window.SITE_VARIANT === 'home' ? base : { ...base, ...BONE_OVERRIDE };
  const r = document.documentElement.style;
  r.setProperty("--bg", p.bg);
  r.setProperty("--bg-2", p.bg2);
  r.setProperty("--paper", p.paper);
  r.setProperty("--surface", p.surface);
  r.setProperty("--glow-warm", p.glowWarm);
  r.setProperty("--glow-warm-soft", p.glowWarmSoft);
  r.setProperty("--surface-veil", p.surfaceVeil);
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
/* Two case sets, one page. leadawaker.com sells solar, where the switcher tabs
   are service angles (quote reactivation / policy deadline / old leads).
   leadawaker.com/home sells home renovation, where the tabs stay niches.
   Both are served from the same index.html; SITE_VARIANT below picks the set,
   so the switcher, hero imagery and icons all follow from one source. */
const HOME_CASES = {
  kitchen: {
    label: "Kitchen",
    leadName: "Eline de Vries",
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
    leadName: "Nathalie van den Berg",
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
    leadName: "Lisa Bakker",
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
    leadName: "Thomas Janssen",
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
    leadName: "Mark Verhoeven",
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

/* Solar tabs are angles, not niches: a lead that was quoted and went quiet,
   a whole database made relevant again by a policy deadline, and low-intent
   old leads that never got as far as a quote. Register is deliberately plainer
   than HOME_CASES above — solar buyers argue payback and kit, not finish. */
const SOLAR_CASES = {
  quotes: {
    label: "Quotes",
    leadName: "Rob Mulder",
    avatar: "R",
    project: "14 panels + hybrid inverter",
    ago: "5 mo. ago",
    agentName: "Dennis",
    advisorName: "Jesse",
    domain: "northfieldsolar",
    messages: [
      { type: "agent", content: "Hi Rob, this is Northfield Solar. You had a quote from us back in March: 14 panels on the south-facing roof, with the hybrid inverter.", time: "09:40 AM" },
      { type: "system", content: "Lead engaged" },
      { type: "user", content: "yeah I remember", time: "09:52 AM" },
      { type: "system", content: "Lead replied" },
      { type: "agent", content: "By the way, my name is Dennis, I'm Northfield Solar's digital assistant. I can answer any technical question, and put you in touch with one of our advisors if needed.", time: "09:53 AM" },
      { type: "system", content: "AI disclosure sent" },
      { type: "agent", content: "We never heard back after the quote and I didn't want to keep chasing. Did you end up going ahead with someone else?", time: "09:54 AM" },
      { type: "user", content: "no, still nothing", time: "10:14 AM" },
      { type: "user", content: "honestly we got three quotes and yours wasn't the cheapest", time: "10:15 AM" },
      { type: "system", content: "Price objection surfaced" },
      { type: "agent", content: "Fair enough. Do you remember roughly what the gap was?", time: "10:16 AM" },
      { type: "user", content: "around 1,400 less from another company", time: "10:27 AM" },
      { type: "agent", content: "That's a real difference. Yours was quoted with the hybrid inverter, was theirs hybrid too, or a string inverter without battery readiness?", time: "10:28 AM" },
      { type: "user", content: "not sure, I'd have to dig the quote out", time: "10:39 AM" },
      { type: "agent", content: "Worth checking. At 14 panels most of the gap sits in the inverter. A string setup is cheaper today, but you can't add storage later without replacing it.", time: "10:40 AM" },
      { type: "system", content: "Key differentiator surfaced" },
      { type: "user", content: "that's actually a good point", time: "10:51 AM" },
      { type: "user", content: "we were planning a battery next year", time: "10:51 AM" },
      { type: "agent", content: "Then it matters. Retrofitting storage onto a string setup usually costs more than the 1,400 you'd save now.", time: "10:52 AM" },
      { type: "agent", content: "Worth putting you with Jesse, our senior advisor? They can run both options against your actual usage. Fifteen minutes, and nothing gets re-quoted.", time: "10:53 AM" },
      { type: "user", content: "yes, that would be useful", time: "11:04 AM" },
      { type: "system", content: "Lead qualified" },
      { type: "agent", content: "Jesse has Wednesday, Thursday or Friday open this week. Which suits you best?", time: "11:05 AM" },
      { type: "user", content: "thursday probably", time: "11:15 AM" },
      { type: "agent", content: "Thursday works. There's 10:00, 14:30 or 16:00 free.", time: "11:16 AM" },
      { type: "user", content: "16:00", time: "11:26 AM" },
      { type: "agent", content: "Booked: Thursday at 16:00. Jesse will call you on this number.", time: "11:27 AM" },
      { type: "system", content: "Call booked with advisor 📅", wine: true },
      { type: "agent", content: "They'll have your March quote and the battery comparison already open, so you won't need to explain any of this again.", time: "11:28 AM" },
      { type: "user", content: "great, thanks", time: "11:34 AM" },
      { type: "agent", content: "You're welcome Rob. Jesse takes it from here 🙂", time: "11:35 AM" },
      { type: "system", content: "Closed. Sent to Client", wine: true }
    ]
  },
  netmetering: {
    label: "Net metering",
    labelNl: "Saldering",
    leadName: "Anouk de Groot",
    avatar: "A",
    project: "Enquiry, never quoted",
    ago: "14 mo. ago",
    agentName: "Dennis",
    domain: "northfieldsolar",
    messages: [
      { type: "agent", content: "Hi Anouk, this is Northfield Solar. You asked us about panels last year but the timing wasn't right then.", time: "10:02 AM" },
      { type: "system", content: "Lead engaged" },
      { type: "user", content: "yes, we decided to wait", time: "10:13 AM" },
      { type: "system", content: "Lead replied" },
      { type: "agent", content: "By the way, my name is Dennis, I'm Northfield Solar's digital assistant. I can answer any technical question, and put you in touch with an advisor if needed.", time: "10:14 AM" },
      { type: "system", content: "AI disclosure sent" },
      { type: "agent", content: "I'm getting in touch because the rules change on 1 January 2027, and that changes what waiting actually costs you.", time: "10:15 AM" },
      { type: "user", content: "the net metering thing?", time: "10:24 AM" },
      { type: "agent", content: "That's the one. Today everything you feed back to the grid is offset one-for-one against what you use. From 2027 that stops.", time: "10:25 AM" },
      { type: "system", content: "Deadline relevance established" },
      { type: "user", content: "so is it even worth it after that?", time: "10:36 AM" },
      { type: "agent", content: "Still worth it, but the maths shifts. Payback stretches unless you use more of what you generate yourself, which is why storage matters much more from 2027 on.", time: "10:37 AM" },
      { type: "user", content: "we're out during the day, most of our usage is evenings", time: "10:49 AM" },
      { type: "system", content: "Consumption profile surfaced" },
      { type: "agent", content: "Then a system sized without storage would export most of your production at midday and you'd buy it back at full price in the evening.", time: "10:50 AM" },
      { type: "agent", content: "Installing before the change also lets us size the battery properly from the start instead of retrofitting it afterwards.", time: "10:51 AM" },
      { type: "user", content: "what's the waiting list like at the moment?", time: "11:03 AM" },
      { type: "system", content: "Buying signal detected" },
      { type: "agent", content: "That's the honest constraint. We're at about nine weeks, and it stretches through autumn as the deadline gets closer.", time: "11:04 AM" },
      { type: "user", content: "ok that's sooner than I expected. can we look at it properly?", time: "11:16 AM" },
      { type: "system", content: "Lead qualified" },
      { type: "agent", content: "Then let's get Jesse out to you, one of our surveyors. Tuesday, Wednesday or Thursday next week?", time: "11:17 AM" },
      { type: "user", content: "tuesday is best", time: "11:26 AM" },
      { type: "agent", content: "Tuesday works. There's 10:00 or 14:00 free.", time: "11:27 AM" },
      { type: "user", content: "10:00", time: "11:33 AM" },
      { type: "agent", content: "Booked: Tuesday at 10:00. Jesse will come to you.", time: "11:34 AM" },
      { type: "system", content: "Survey booked with surveyor 📅", wine: true },
      { type: "agent", content: "They'll bring the evening-usage comparison so you can see the payback with and without storage.", time: "11:35 AM" },
      { type: "user", content: "perfect, see you then", time: "11:41 AM" },
      { type: "system", content: "Closed. Sent to Client", wine: true }
    ],
    /* Inline rather than in TRANSLATIONS.nl.chatMessages: this case only
       renders for the NL market, so it must not be reachable by case key. */
    messagesNl: [
      { type: "agent",  content: "Hoi Anouk, dit is Northfield Solar. U informeerde vorig jaar bij ons naar zonnepanelen, maar het moment was toen niet goed.", time: "10:02" },
      { type: "system", content: "Lead geactiveerd" },
      { type: "user",   content: "ja, we hebben toen besloten te wachten", time: "10:13" },
      { type: "system", content: "Lead heeft gereageerd" },
      { type: "agent",  content: "Even voorstellen: ik ben Dennis, de digitale assistent van Northfield Solar. Ik kan al uw technische vragen beantwoorden en breng u in contact met een adviseur als dat nodig is.", time: "10:14" },
      { type: "system", content: "AI-melding verstuurd" },
      { type: "agent",  content: "Ik neem contact op omdat de regels op 1 januari 2027 veranderen, en dat bepaalt wat wachten u nu daadwerkelijk kost.", time: "10:15" },
      { type: "user",   content: "bedoelt u de saldering?", time: "10:24" },
      { type: "agent",  content: "Precies. Nu wordt alles wat u teruglevert één op één verrekend met wat u verbruikt. Vanaf 2027 stopt dat.", time: "10:25" },
      { type: "system", content: "Deadline relevant gemaakt" },
      { type: "user",   content: "is het daarna überhaupt nog rendabel?", time: "10:36" },
      { type: "agent",  content: "Nog steeds rendabel, maar de rekensom verschuift. De terugverdientijd loopt op tenzij u meer van uw eigen opwek zelf verbruikt, en daarom wordt opslag vanaf 2027 veel belangrijker.", time: "10:37" },
      { type: "user",   content: "we zijn overdag weg, we verbruiken het meeste 's avonds", time: "10:49" },
      { type: "system", content: "Verbruiksprofiel zichtbaar" },
      { type: "agent",  content: "Dan zou een installatie zonder opslag het grootste deel midden op de dag terugleveren, en koopt u het 's avonds tegen het volle tarief weer terug.", time: "10:50" },
      { type: "agent",  content: "Installeren vóór de wijziging betekent ook dat we de batterij meteen goed kunnen dimensioneren, in plaats van hem later alsnog toe te voegen.", time: "10:51" },
      { type: "user",   content: "hoe lang is de wachttijd op dit moment?", time: "11:03" },
      { type: "system", content: "Koopsignaal gedetecteerd" },
      { type: "agent",  content: "Dat is de eerlijke beperking. We zitten nu op ongeveer negen weken, en dat loopt op naarmate de deadline dichterbij komt.", time: "11:04" },
      { type: "user",   content: "ok, dat is eerder dan ik dacht. kunnen we er goed naar kijken?", time: "11:16" },
      { type: "system", content: "Lead gekwalificeerd" },
      { type: "agent",  content: "Dan laten we Jesse langskomen, een van onze schouwers. Dinsdag, woensdag of donderdag volgende week?", time: "11:17" },
      { type: "user",   content: "dinsdag komt het beste uit", time: "11:26" },
      { type: "agent",  content: "Dinsdag kan. Er is nog 10:00 of 14:00 vrij.", time: "11:27" },
      { type: "user",   content: "10:00", time: "11:33" },
      { type: "agent",  content: "Ingepland: dinsdag om 10:00. Jesse komt naar u toe.", time: "11:34" },
      { type: "system", content: "Schouw met schouwer ingepland 📅", wine: true },
      { type: "agent",  content: "De vergelijking op avondverbruik wordt meegenomen, zodat u de terugverdientijd met en zonder opslag ziet.", time: "11:35" },
      { type: "user",   content: "perfect, tot dan", time: "11:41" },
      { type: "system", content: "Gesloten. Doorgestuurd naar klant", wine: true }
    ]
  },
  dbr: {
    label: "Old leads",
    leadName: "Mark Jansen",
    avatar: "M",
    project: "Heat pump guide download",
    ago: "18 mo. ago",
    agentName: "Dennis",
    domain: "northfieldsolar",
    messages: [
      { type: "agent", content: "Hi, this is Northfield Solar. Is this the same Mark who downloaded our heat pump guide from the website? 🙂", time: "09:15 AM" },
      { type: "system", content: "Lead engaged" },
      { type: "user", content: "think so, that was a while ago", time: "09:27 AM" },
      { type: "system", content: "Lead replied" },
      { type: "agent", content: "It was, about a year and a half. By the way, my name is Dennis, I'm Northfield Solar's digital assistant. I can answer any technical question, and put you in touch with an advisor if needed.", time: "09:28 AM" },
      { type: "system", content: "AI disclosure sent" },
      { type: "agent", content: "We never followed up properly back then and I wanted to check whether it ever came to anything.", time: "09:29 AM" },
      { type: "user", content: "no, we never did it", time: "09:39 AM" },
      { type: "agent", content: "Was that down to the cost, or something else?", time: "09:40 AM" },
      { type: "user", content: "mostly we couldn't work out if our house was even suitable", time: "09:52 AM" },
      { type: "user", content: "it's from the 70s and someone told us we'd have to insulate everything first", time: "09:53 AM" },
      { type: "system", content: "Real blocker surfaced" },
      { type: "agent", content: "That's the single most common reason people stall on this, and it's only half true.", time: "09:54 AM" },
      { type: "agent", content: "A 70s house usually needs the roof and glazing in decent shape, but full insulation often isn't required if you go hybrid rather than all-electric.", time: "09:55 AM" },
      { type: "user", content: "I had no clue", time: "10:07 AM" },
      { type: "agent", content: "It gets flattened into 'insulate first' a lot. What are you heating with now, and has anything been insulated since you moved in?", time: "10:08 AM" },
      { type: "user", content: "normal gas boiler. roof was done in 2019", time: "10:20 AM" },
      { type: "system", content: "Lead qualified" },
      { type: "agent", content: "That helps a lot. With the roof already done, a hybrid setup would very likely work without touching the walls.", time: "10:21 AM" },
      { type: "agent", content: "We run a free suitability check where we measure the actual heat demand instead of estimating it. Worth doing?", time: "10:22 AM" },
      { type: "user", content: "yes, that would actually be useful", time: "10:34 AM" },
      { type: "agent", content: "Jesse does those. Monday, Tuesday or Thursday next week?", time: "10:35 AM" },
      { type: "user", content: "monday", time: "10:42 AM" },
      { type: "agent", content: "Monday works. There's 11:00 or 14:00 free.", time: "10:43 AM" },
      { type: "user", content: "14:00", time: "10:49 AM" },
      { type: "agent", content: "Booked: Monday at 14:00. Jesse will come out to you.", time: "10:50 AM" },
      { type: "system", content: "Home visit booked with advisor 📅", wine: true },
      { type: "agent", content: "No obligation either way, and you'll get the heat demand figures to keep.", time: "10:51 AM" },
      { type: "user", content: "thanks, appreciate that", time: "10:57 AM" },
      { type: "system", content: "Closed. Sent to Client", wine: true }
    ]
  },
  /* The other three tabs mine dormant leads. This one mines finished customers,
     which is a different service (referrals) on the same engine. It earns its
     place by fixing a small service issue first: the ask only lands because the
     conversation gave something before it took anything. */
  referrals: {
    label: "Referrals",
    leadName: "Ellen Visser",
    avatar: "E",
    project: "12 panels + battery",
    ago: "5 mo. ago",
    agoKey: "convUI.installed_ago",
    agentName: "Dennis",
    advisorName: "Jesse",
    domain: "northfieldsolar",
    messages: [
      { type: "agent", content: "Hi Ellen, this is Northfield Solar. Your 12 panels and the battery went in back in March. How has the system been running over the summer?", time: "09:20 AM" },
      { type: "system", content: "Customer engaged" },
      { type: "user", content: "really well actually, better than we expected", time: "09:31 AM" },
      { type: "system", content: "Customer replied" },
      { type: "agent", content: "Good to hear. By the way, my name is Dennis, I'm Northfield Solar's digital assistant. I can answer any technical question, and put you in touch with an advisor if needed.", time: "09:32 AM" },
      { type: "system", content: "AI disclosure sent" },
      { type: "agent", content: "Anything about the system you've been meaning to ask while I'm here?", time: "09:33 AM" },
      { type: "user", content: "actually yes, the app says we exported a lot in July. is that normal?", time: "09:41 AM" },
      { type: "system", content: "Service question raised" },
      { type: "agent", content: "Normal for July, yes. Long days and low daytime use, so the battery is full by early afternoon and the rest goes to the grid.", time: "09:42 AM" },
      { type: "agent", content: "If you'd rather keep more of it, moving the dishwasher or a car charge into the middle of the day makes the biggest difference. Costs nothing to try.", time: "09:43 AM" },
      { type: "user", content: "that's useful, thanks", time: "09:55 AM" },
      { type: "system", content: "Question resolved" },
      { type: "agent", content: "While I have you: has anyone asked you about the panels since they went up? Neighbours usually spot the scaffolding first, and there's a referral bonus if one of them ends up going ahead.", time: "09:56 AM" },
      { type: "user", content: "ha, a few. my brother in law keeps asking, he's in Zwolle", time: "10:08 AM" },
      { type: "system", content: "Referral surfaced" },
      { type: "agent", content: "Worth putting him in touch then. The bonus pays out once his install goes ahead, and it doesn't come off his quote.", time: "10:09 AM" },
      { type: "user", content: "he'd probably want to know what we actually paid", time: "10:20 AM" },
      { type: "agent", content: "Jesse can use your system as a reference without sharing your figures, unless you'd rather he did.", time: "10:21 AM" },
      { type: "user", content: "no, he can know. we've told him most of it anyway", time: "10:32 AM" },
      { type: "agent", content: "Then either pass him my number, or send me his and I'll message him saying it came from you. Whichever you're comfortable with.", time: "10:33 AM" },
      { type: "system", content: "Consent handled" },
      { type: "user", content: "I'll send you his. his name is Ruben", time: "10:45 AM" },
      { type: "agent", content: "Got it. I'll message Ruben today and mention you passed it on. Your bonus comes through once his install signs off.", time: "10:46 AM" },
      { type: "system", content: "Referral captured 🤝", wine: true },
      { type: "user", content: "great, thanks Dennis", time: "10:58 AM" },
      { type: "agent", content: "Thanks Ellen. I'll let you know how he gets on 🙂", time: "10:59 AM" },
      { type: "system", content: "Closed. Sent to Client", wine: true }
    ]
  }
};

/* The deadline tab is the "why now" for the whole page, so its content follows
   the visitor's MARKET rather than their language. A Dutch lead is moved by
   salderingsregeling ending; a UK lead by 0% VAT reverting to 5%; a US lead by
   the fact that the 30% credit their original quote assumed no longer exists.
   Every figure below is sourced — see the note above each case. Policy dates
   move, so re-check these before a campaign rather than assuming they hold. */
const DEADLINE_CASES = {
  /* Salderingsregeling ends 1 January 2027 (Dutch net metering, full offset
     until then). SOLAR_CASES.netmetering above is the NL original. */
  nl: SOLAR_CASES.netmetering,

  /* HMRC VAT Notice 708/6: 0% VAT on residential solar + battery installs in
     Great Britain runs to 31 March 2027, reverting to 5% (NOT 20%) on 1 April
     2027 — roughly £500 on a £10,000 install. Ofgem raised the price cap 13%
     on 1 July 2026 (£1,477 → £1,663 typical dual-fuel). Both verified Aug 2026;
     an Autumn Budget extension would kill the VAT hook, so re-check it. */
  uk: {
    label: "0% VAT",
    leadName: "Claire Whitfield",
    avatar: "C",
    project: "Enquiry, never quoted",
    ago: "13 mo. ago",
    agentName: "Dennis",
    domain: "northfieldsolar",
    messages: [
      { type: "agent", content: "Hi Claire, this is Northfield Solar. You enquired about panels last summer but the timing wasn't right then.", time: "09:50 AM" },
      { type: "system", content: "Lead engaged" },
      { type: "user", content: "yes, we ended up putting it off", time: "10:01 AM" },
      { type: "system", content: "Lead replied" },
      { type: "agent", content: "By the way, my name is Dennis, I'm Northfield Solar's digital assistant. I can answer any technical question, and put you in touch with an advisor if needed.", time: "10:02 AM" },
      { type: "system", content: "AI disclosure sent" },
      { type: "agent", content: "I'm getting back in touch because two things have moved since then, and both change the numbers we'd have given you.", time: "10:03 AM" },
      { type: "user", content: "such as?", time: "10:13 AM" },
      { type: "agent", content: "The price cap went up 13% on 1 July, so the electricity you'd be offsetting costs more than it did. And the 0% VAT on solar and battery installs ends on 31 March 2027, then goes back to 5%.", time: "10:14 AM" },
      { type: "system", content: "Deadline relevance established" },
      { type: "user", content: "how much is the VAT bit actually worth?", time: "10:26 AM" },
      { type: "agent", content: "On a £10,000 system with storage, about £500. It isn't the whole argument, and I'd rather not oversell it, but it only moves one way from here.", time: "10:27 AM" },
      { type: "user", content: "at least that's honest", time: "10:38 AM" },
      { type: "system", content: "Trust established" },
      { type: "user", content: "we're both out all day though, we'd be exporting most of it", time: "10:39 AM" },
      { type: "agent", content: "That's the more important number, and it's the one most quotes gloss over. Export pays a fraction of what you pay to buy it back in the evening.", time: "10:40 AM" },
      { type: "agent", content: "On your usage pattern the battery would be doing more of the work than the panels.", time: "10:40 AM" },
      { type: "user", content: "huh, I had no idea", time: "10:52 AM" },
      { type: "system", content: "Key differentiator surfaced" },
      { type: "agent", content: "Worth me running your actual half-hourly usage instead of a standard profile? That's what decides whether this is worth doing at all.", time: "10:53 AM" },
      { type: "user", content: "yes, that would be useful", time: "11:05 AM" },
      { type: "system", content: "Lead qualified" },
      { type: "agent", content: "Then let's get Jesse out to you, one of our surveyors. Tuesday, Wednesday or Thursday next week?", time: "11:06 AM" },
      { type: "user", content: "tuesday suits us", time: "11:15 AM" },
      { type: "agent", content: "Tuesday works. There's 10:00 or 14:00 free.", time: "11:16 AM" },
      { type: "user", content: "10:00 please", time: "11:22 AM" },
      { type: "agent", content: "Booked: Tuesday at 10:00. Jesse will come to you.", time: "11:23 AM" },
      { type: "system", content: "Survey booked with surveyor 📅", wine: true },
      { type: "agent", content: "They'll bring the payback with and without storage, run on your own half-hourly usage rather than an average.", time: "11:24 AM" },
      { type: "user", content: "great, thanks", time: "11:30 AM" },
      { type: "system", content: "Closed. Sent to Client", wine: true }
    ]
  },

  /* OBBBA (P.L. 119-21) terminated the 30% residential credit (§25D) for
     expenditures after 31 Dec 2025 — and the IRS treats an expenditure as made
     when installation COMPLETES, not when paid. §48E survives via third-party
     ownership (lease/PPA), where the credit sits with the owner; new starts
     face a 31 Dec 2027 placed-in-service cliff. Verified Aug 2026 against IRS
     guidance. This is the one market where the trigger has already passed, so
     the case is a reframe: the lead's old quote is simply wrong now. */
  us: {
    label: "Tax credit",
    leadName: "Dana Whitaker",
    avatar: "D",
    project: "9.2 kW system, quoted",
    ago: "17 mo. ago",
    agentName: "Dennis",
    domain: "northfieldsolar",
    messages: [
      { type: "agent", content: "Hi Dana, this is Northfield Solar. We quoted you back in February last year for the 9.2 kW system.", time: "10:05 AM" },
      { type: "system", content: "Lead engaged" },
      { type: "user", content: "yeah, we never pulled the trigger on that", time: "10:16 AM" },
      { type: "system", content: "Lead replied" },
      { type: "agent", content: "By the way, my name is Dennis, I'm Northfield Solar's digital assistant. I can answer any technical question, and put you in touch with an advisor if needed.", time: "10:17 AM" },
      { type: "system", content: "AI disclosure sent" },
      { type: "agent", content: "I'm not messaging to rehash the quote. I'm messaging because it isn't accurate any more, and I'd rather you heard that from us than found out later.", time: "10:18 AM" },
      { type: "user", content: "what changed?", time: "10:28 AM" },
      { type: "agent", content: "The 30% federal credit ended for systems completed after 31 December 2025. Your quote had it built into the out-of-pocket number, so that figure is wrong now.", time: "10:29 AM" },
      { type: "system", content: "Old quote invalidated" },
      { type: "user", content: "so it's just gone? that was most of the reason we were considering it", time: "10:41 AM" },
      { type: "agent", content: "If you buy the system outright, yes. It still applies when the system is third-party owned, a lease or a PPA, because the credit sits with the owner instead of with you.", time: "10:42 AM" },
      { type: "user", content: "I always assumed leasing was the worse deal", time: "10:54 AM" },
      { type: "agent", content: "It generally was, back when you could claim the 30% yourself. Now it's usually the only route that gets that 30% into the price at all.", time: "10:55 AM" },
      { type: "system", content: "Key reframe landed" },
      { type: "user", content: "how long does that route last?", time: "11:07 AM" },
      { type: "system", content: "Buying signal detected" },
      { type: "agent", content: "That's the part with a date on it. For new projects the placed-in-service cutoff is 31 December 2027, so it isn't open-ended.", time: "11:08 AM" },
      { type: "user", content: "ok. can someone show me what that looks like next to the original quote?", time: "11:20 AM" },
      { type: "system", content: "Lead qualified" },
      { type: "agent", content: "That's exactly what I'd want to see in your position. Jesse, our senior advisor, has Tuesday, Wednesday or Thursday open. Which works?", time: "11:21 AM" },
      { type: "user", content: "wednesday", time: "11:29 AM" },
      { type: "agent", content: "Wednesday works. There's 09:30, 11:00 or 15:00 free.", time: "11:30 AM" },
      { type: "user", content: "11:00", time: "11:36 AM" },
      { type: "agent", content: "Booked: Wednesday at 11:00. Jesse will call you on this number.", time: "11:37 AM" },
      { type: "system", content: "Call booked with advisor 📅", wine: true },
      { type: "agent", content: "They'll have your February numbers side by side with the lease option so the difference is actually visible.", time: "11:38 AM" },
      { type: "user", content: "appreciate you reaching out about this", time: "11:44 AM" },
      { type: "system", content: "Closed. Sent to Client", wine: true }
    ]
  }
};

/* Market drives every geography-dependent thing on the page: the deadline case,
   the currency, and the names in the pipeline and archive illustrations. A Dutch
   name list in front of a UK prospect is a tell, so it follows the market rather
   than the language.
   Resolution order: /uk and /us paths win (shareable, and how Gabriel previews a
   market), then ?m= (links sent after a sales call), then the geo value
   middleware.ts injects, then NL. */
const MARKET = (() => {
  const path = (location.pathname.match(/\/(uk|us|nl)\/?$/) || [])[1];
  const q = new URLSearchParams(location.search).get('m');
  const m = (path || q || window.__MARKET__ || 'nl').toLowerCase();
  return DEADLINE_CASES[m] ? m : 'nl';
})();
window.MARKET = MARKET;

/* Illustration names, keyed by market and applied positionally in
   05-pipeline.jsx and 04-process.jsx so the lists stay one source. */
window.MARKET_NAMES = {
  nl: {
    pipeline: [
      "Martijn van den Berg", "Sophie Janssen", "Pieter de Vries", "Lotte Hendricks",
      "Emma Bakker", "Lars Smits", "Jasper van Dijk", "Nina Wolters", "Rick Brouwer",
      "Amber van Beek", "Thijs Groot", "Manon Lagerweij", "Mark van der Laan", "Lisa Kuijpers",
      "Anna Visser", "Luuk Harmsen", "Claire Vos", "Mike van Oss", "Bianca Stam",
      "Jeroen Timmermans", "Yvonne Bruin", "Patrick Nooij", "Thomas Dekker", "Femke Bosman",
      "Ruben Mulder", "Eline Vermeer",
      "Iris Bergman", "Daan Scholten", "Roos Timmer", "Wouter Aarts", "Celeste Noorda",
      "Steven Pijpers", "Wendy van Rooij", "Frank Kooiman", "Hanneke Prins",
    ],
    archive: ["M. van Dijk", "T. de Boer", "Fam. Janssen", "K. Vermeer", "Sandra Visser", "Van Rooijen"],
    calendarSlot: "Tue 10:30 · Van Rooijen",
  },
  uk: {
    pipeline: [
      "Michael Thornton", "Sophie Hargreaves", "Peter Whitlock", "Charlotte Hendry",
      "Emma Bexley", "Liam Sutcliffe", "Jasper Ellison", "Nina Woolard", "Rick Bramley",
      "Amber Beckwith", "Toby Grayling", "Megan Ashworth", "Mark Lanyon", "Lisa Kirkbride",
      "Anna Vickers", "Luke Harmon", "Claire Vosper", "Mike Osgood", "Bianca Stamford",
      "Jeremy Tillbrook", "Yvonne Brunton", "Patrick Nolan", "Thomas Deakin", "Fiona Bosworth",
      "Ruben Milward", "Eleanor Vermont",
      "Iris Bergin", "Dean Scholes", "Rosie Timmins", "Warren Aldridge", "Celeste Norwood",
      "Steven Piper", "Wendy Rooke", "Frank Coleman", "Hannah Prentice",
    ],
    archive: ["M. Dyson", "T. Barber", "The Jenners", "K. Verity", "Sandra Vickers", "Rooke"],
    calendarSlot: "Tue 10:30 · Rooke",
  },
  us: {
    pipeline: [
      "Michael Thornton", "Sophie Hargrove", "Peter Whitlock", "Charlotte Hendry",
      "Emma Beckley", "Liam Sutcliff", "Jasper Ellison", "Nina Woodard", "Rick Bramley",
      "Amber Beckwith", "Toby Grayson", "Megan Ashworth", "Mark Lanning", "Lisa Kirby",
      "Anna Vickers", "Luke Harmon", "Claire Vosburg", "Mike Osgood", "Bianca Stanford",
      "Jeremy Tilbrook", "Yvonne Brunson", "Patrick Nolan", "Thomas Deakin", "Fiona Boswell",
      "Ruben Millward", "Eleanor Vermont",
      "Iris Bergin", "Dean Scholes", "Rosie Timmins", "Warren Aldridge", "Celeste Norwood",
      "Steven Piper", "Wendy Rooker", "Frank Coleman", "Hannah Prentice",
    ],
    archive: ["M. Dyson", "T. Barber", "The Jenners", "K. Verity", "Sandra Vickers", "Rooker"],
    calendarSlot: "Tue 10:30 · Rooker",
  },
};
window.marketNames = () => window.MARKET_NAMES[MARKET] || window.MARKET_NAMES.nl;

SOLAR_CASES.netmetering = DEADLINE_CASES[MARKET];

/* One page, two products. Vercel rewrites /home to the same index.html, so the
   path decides which set (and therefore which switcher) renders. ?site= is an
   override so both variants are reachable on the Pi, where the page is served
   from /premium/index.html and the path never says /home. */
const SITE_VARIANT = (() => {
  const q = new URLSearchParams(location.search).get('site');
  if (q === 'home' || q === 'solar') return q;
  return /\/home\/?$/.test(location.pathname) ? 'home' : 'solar';
})();
window.SITE_VARIANT = SITE_VARIANT;

const CHAT_CASES = SITE_VARIANT === 'home' ? HOME_CASES : SOLAR_CASES;
window.CHAT_CASES = CHAT_CASES;

/* --------------------------- AUDIT CALCULATOR ----------------------------- */

/* Three revenue pools, one per offer. They are sold modularly (a prospect can
   buy quote follow-up without buying the cold database), so each pool carries
   its own funnel rates instead of sharing one generic chain — running warm
   quote rates over 18-month-old cold records is the fastest way to lose a
   numerate buyer.

   The warm/cold difference lives mostly in `response`: whether a dead contact
   replies at all is very sensitive to how well they know you. `close` stays
   closer together, because by the booking stage every pool has passed the same
   qualification filter. Note `close` is the CLIENT's salespeople closing an
   appointment we booked, not us — which is why it tops out at 55% and not the
   70% that in-home sales decks like to claim.

   `valueFactor` scales the shared average project value: repeat work on an
   existing customer (battery retrofit, service contract, a second room) is a
   smaller ticket than the original job.

   Sanity-check any rate change against pool→closed, because that is the figure
   a prospect divides out unprompted: quotes 7.3%, dbr 1.8%, upsell 9.6%.
   Published bands are 3-8% for warm reactivation, 1-3% for cold, and sub-10%
   for repeat purchase inside a single campaign. Referrals are deliberately NOT
   a fourth pool: that is net-new revenue rather than recovered, so it breaks
   the section's headline promise, and it would double-count the upsell pool it
   is drawn from. It earns its place as a conversation demo instead. */
const AUDIT_POOLS = [
  {
    key: "quotes",
    rates: { response: 0.65, qualified: 0.25, close: 0.45 },
    valueFactor: 1,
    sliders: [
      { key: "quotes",    def: 6000, min: 300, max: 12000, step: 100, unit: "num", label: "audit.label_quotes" },
      { key: "silentPct", def: 30,   min: 0,   max: 100,   step: 5,   unit: "pct", label: "audit.label_silent" },
    ],
  },
  {
    key: "dbr",
    rates: { response: 0.30, qualified: 0.20, close: 0.30 },
    valueFactor: 1,
    sliders: [
      { key: "enquiries",      def: 6000, min: 500, max: 30000, step: 500, unit: "num", label: "audit.label_enquiries" },
      { key: "contactablePct", def: 60,   min: 0,   max: 100,   step: 5,   unit: "pct", label: "audit.label_contactable" },
    ],
  },
  {
    key: "upsell",
    rates: { response: 0.70, qualified: 0.25, close: 0.55 },
    valueFactor: 0.4,
    sliders: [
      { key: "customers",  def: 1500, min: 50, max: 4000, step: 50, unit: "num", label: "audit.label_customers" },
      { key: "notBackPct", def: 70,   min: 0,  max: 100,  step: 5,  unit: "pct", label: "audit.label_notback" },
    ],
  },
];
window.AUDIT_POOLS = AUDIT_POOLS;

/* Shared across every tab: it is a property of the business, not of the pool,
   so it lives outside the tab-swapped area and never resets on tab change. */
const AUDIT_VALUE_SLIDER = { key: "avgValue", def: 10000, min: 1000, max: 25000, step: 500, unit: "money", label: "audit.label_value" };
window.AUDIT_VALUE_SLIDER = AUDIT_VALUE_SLIDER;

/* ----------------------------- i18n SYSTEM -------------------------------- */

const I18nContext = React.createContext(null);

window.I18nProvider = function I18nProvider({ children }) {
  const defaultLang = (navigator.language || '').startsWith('nl') ? 'nl' : 'en';
  const [lang, setLang] = React.useState(defaultLang);

  /* Lookup order: this page variant in the active language, then the shared
     copy in that language, then the same two in English. That way a variant
     only has to declare the handful of strings it actually changes (the solar
     page rewrites the badge and the trust line and inherits everything else),
     and a missing Dutch string still falls back to English rather than the
     raw key path. */
  const t = React.useCallback((path) => {
    const keys = path.split('.');
    const navigate = (obj) => keys.reduce((o, k) => o != null ? o[k] : undefined, obj);
    const tr = window.TRANSLATIONS || {};
    const variant = window.SITE_VARIANT;
    const sources = [];
    if (lang !== 'en') {
      sources.push(navigate(tr[lang]?.variants?.[variant]));
      sources.push(navigate(tr[lang]));
    }
    sources.push(navigate(tr['en']?.variants?.[variant]));
    sources.push(navigate(tr['en']));
    for (const val of sources) {
      if (val !== undefined && val !== null) return val;
    }
    return path;
  }, [lang]);

  return React.createElement(I18nContext.Provider, { value: { lang, setLang, t } }, children);
};

window.useI18n = function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be called inside I18nProvider');
  return ctx;
};

/* Market wins over the geo-injected currency so /uk and /us preview correctly
   from anywhere. Falls back to __CURRENCY__ for visitors on the bare domain. */
window.useCurrency = function useCurrency() {
  const byMarket = { uk: 'GBP', us: 'USD', nl: 'EUR' }[window.MARKET];
  const currency = byMarket || (window.__CURRENCY__ === 'GBP' ? 'GBP' : 'EUR');
  if (currency === 'GBP') return { symbol: '£', locale: 'en-GB' };
  if (currency === 'USD') return { symbol: '$', locale: 'en-US' };
  return { symbol: '€', locale: 'nl-NL' };
};
