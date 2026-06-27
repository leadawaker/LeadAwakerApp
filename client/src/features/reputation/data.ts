import type { RepData } from "./types";
import { repAgoDays } from "./utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

const CONF: Record<string, number> = {
  "rv-08": 72, "rv-01": 68, "rv-02": 70, "rv-03": 74, "rv-04": 81, "rv-05": 83,
  "rv-06": 92, "rv-12": 96, "rv-13": 94, "rv-14": 91, "rv-15": 64, "rv-16": 89,
  "rv-07": 96, "rv-09": 95, "rv-10": 90, "rv-11": 97,
};

const ANALYSIS: Record<string, { issues: string[]; reco: string }> = {
  "rv-08": { issues: ["No-show appointment", "Lost a full workday", "No call or apology"], reco: "Empathetic + ownership" },
  "rv-01": { issues: ["Three-week delay", "Emails ignored", "No callback"], reco: "Empathetic + ownership" },
  "rv-02": { issues: ["Site left messy", "Two days late", "Price expectations"], reco: "Apologetic + make-good" },
  "rv-03": { issues: ["Schedule overran", "Poor communication"], reco: "Apologetic + reassurance" },
  "rv-04": { issues: ["Final bill above quote", "No heads-up on extras"], reco: "Professional + transparency" },
  "rv-05": { issues: ["Had to chase for updates", "Slow communication"], reco: "Grateful + accountability" },
  "rv-06": { issues: ["Minor trim finish missed"], reco: "Grateful + quick fix" },
  "rv-12": { issues: ["On time", "Tidy work", "Would recommend"], reco: "Grateful" },
  "rv-13": { issues: ["Professional crew", "Ahead of schedule"], reco: "Grateful" },
  "rv-14": { issues: ["Friendly team", "Minor delay"], reco: "Grateful" },
  "rv-15": { issues: ["Warranty paperwork pending"], reco: "Professional + follow-up" },
  "rv-16": { issues: ["Clean result", "Comms around planning"], reco: "Grateful" },
};

const rawReviews = [
  { id: "rv-08", name: "Lars Bos", rating: 1 as const, platform: "google", lang: "nl", ago: "6h", date: "23 Jun 2026", status: "needs" as const, job: "Badkamer renovatie", text: "Afspraak totaal niet nagekomen. De monteur kwam gewoon niet opdagen en ik heb een hele dag vrij genomen voor niets. Geen telefoontje, geen excuus. Belachelijk.", draft: "Dag Lars, dit had nooit mogen gebeuren en onze welgemeende excuses dat de monteur niet is komen opdagen — zeker na een vrije dag. Dat is niet de service die wij willen leveren. Ik neem vandaag nog persoonlijk contact met u op om een nieuwe afspraak in te plannen op een moment dat u uitkomt, en om dit goed te maken.", tone: "apologetic" as const, reply: null, timeline: [{ key: "received", label: "Received", who: "Google", ago: "6h", done: true }, { key: "drafted", label: "AI drafted", who: "auto", ago: "6h", done: true }, { key: "posted", label: "Posted", who: null, ago: null, done: false }] },
  { id: "rv-01", name: "Jan de Vries", rating: 1 as const, platform: "google", lang: "nl", ago: "2d", date: "21 Jun 2026", status: "needs" as const, job: "Keukeninstallatie", text: "Keukeninstallatie was drie weken vertraagd en niemand belde terug. Ik heb meerdere keren gemaild zonder reactie. Het eindresultaat is netjes, maar de weg ernaartoe was zeer teleurstellend.", draft: "Dag Jan, onze welgemeende excuses voor de vertraging en het uitblijven van contact — dat had niet mogen gebeuren. We begrijpen hoe frustrerend drie weken wachten zonder terugkoppeling is. Fijn om te horen dat u tevreden bent met het eindresultaat; de communicatie eromheen pakken we intern aan. Mogen we u bellen om dit recht te zetten?", tone: "apologetic" as const, reply: null, timeline: [{ key: "received", label: "Received", who: "Google", ago: "2d", done: true }, { key: "drafted", label: "AI drafted", who: "auto", ago: "2d", done: true }, { key: "posted", label: "Posted", who: null, ago: null, done: false }] },
  { id: "rv-02", name: "Emma Hughes", rating: 2 as const, platform: "google", lang: "en", ago: "3d", date: "20 Jun 2026", status: "needs" as const, job: "Bathroom remodel", text: "Bathroom looks fine in the end but they left a real mess and finished two days late. For the price I paid I expected a tidier, more professional job.", draft: "Hi Emma, thank you for your honest feedback and our sincere apologies for the mess and the two-day delay — that falls short of the standard we hold ourselves to. We are glad you are happy with the finished bathroom, and we would like to make the rest right. May we arrange a quick visit to take care of the clean-up?", tone: "apologetic" as const, reply: null, timeline: [{ key: "received", label: "Received", who: "Google", ago: "3d", done: true }, { key: "drafted", label: "AI drafted", who: "auto", ago: "3d", done: true }, { key: "posted", label: "Posted", who: null, ago: null, done: false }] },
  { id: "rv-03", name: "Pieter Bakker", rating: 2 as const, platform: "google", lang: "nl", ago: "4d", date: "19 Jun 2026", status: "needs" as const, job: "Dakkapel plaatsing", text: "Het werk is uiteindelijk goed gedaan, maar de planning liep flink uit en de communicatie was ronduit slecht. Je moet er echt bovenop zitten.", draft: "Dag Pieter, bedankt voor uw eerlijke feedback en excuses dat de planning is uitgelopen en de communicatie tekortschoot. Fijn dat u tevreden bent over het uiteindelijke werk. We verbeteren onze terugkoppeling zodat u er niet zelf bovenop hoeft te zitten — bedankt dat u ons hierop wijst.", tone: "apologetic" as const, reply: null, timeline: [{ key: "received", label: "Received", who: "Google", ago: "4d", done: true }, { key: "drafted", label: "AI drafted", who: "auto", ago: "4d", done: true }, { key: "posted", label: "Posted", who: null, ago: null, done: false }] },
  { id: "rv-04", name: "Tom Jansen", rating: 3 as const, platform: "google", lang: "nl", ago: "5d", date: "18 Jun 2026", status: "needs" as const, job: "Vloer leggen", text: "Netjes werk en vriendelijke jongens, maar de eindfactuur lag hoger dan de offerte. Daar had ik vooraf graag iets over gehoord.", draft: "Dag Tom, bedankt voor uw review en de complimenten aan het team. Terecht punt over de factuur — meerwerk moeten we vooraf duidelijk afstemmen. Ik kijk graag samen met u de offerte en eindfactuur na zodat alles helder is. Ik neem hierover contact met u op.", tone: "professional" as const, reply: null, timeline: [{ key: "received", label: "Received", who: "Google", ago: "5d", done: true }, { key: "drafted", label: "AI drafted", who: "auto", ago: "5d", done: true }, { key: "posted", label: "Posted", who: null, ago: null, done: false }] },
  { id: "rv-05", name: "Sophie Klein", rating: 3 as const, platform: "google", lang: "en", ago: "5d", date: "18 Jun 2026", status: "needs" as const, job: "Garden decking", text: "Decent result and the decking is solid. Communication could be better — I had to chase a few times to get updates on timing.", draft: "Hi Sophie, thank you for the review and for the kind words about the decking. You are right that you should not have to chase us for updates — we are tightening up our communication. We appreciate the honest feedback and hope to make the next project effortless for you.", tone: "grateful" as const, reply: null, timeline: [{ key: "received", label: "Received", who: "Google", ago: "5d", done: true }, { key: "drafted", label: "AI drafted", who: "auto", ago: "5d", done: true }, { key: "posted", label: "Posted", who: null, ago: null, done: false }] },
  { id: "rv-06", name: "Noor el Amrani", rating: 4 as const, platform: "google", lang: "nl", ago: "6d", date: "17 Jun 2026", status: "needs" as const, job: "Schilderwerk", text: "Snelle en vriendelijke service, mooi strak geschilderd. Eén kleine afwerking bij het kozijn miste, verder dik tevreden.", draft: "Dag Noor, hartelijk dank voor uw mooie review! Fijn dat u tevreden bent over het schilderwerk. Die afwerking bij het kozijn lossen we natuurlijk even voor u op — ik plan er kort iemand voor in. Bedankt voor het vertrouwen.", tone: "grateful" as const, reply: null, timeline: [{ key: "received", label: "Received", who: "Google", ago: "6d", done: true }, { key: "drafted", label: "AI drafted", who: "auto", ago: "6d", done: true }, { key: "posted", label: "Posted", who: null, ago: null, done: false }] },
  { id: "rv-12", name: "Sander Vermeer", rating: 5 as const, platform: "google", lang: "nl", ago: "4h", date: "23 Jun 2026", status: "needs" as const, job: "Badkamer renovatie", text: "Van begin tot eind perfect geregeld. Strak gewerkt, netjes opgeruimd en precies op tijd klaar. Echt een aanrader!", draft: "Dag Sander, wat geweldig om te lezen! Hartelijk dank voor de complimenten en de aanrader — we geven ze met plezier door aan het team. Veel plezier met de nieuwe badkamer!", tone: "grateful" as const, reply: null, timeline: [{ key: "received", label: "Received", who: "Google", ago: "4h", done: true }, { key: "drafted", label: "AI drafted", who: "auto", ago: "4h", done: true }, { key: "posted", label: "Posted", who: null, ago: null, done: false }] },
  { id: "rv-13", name: "Olivia Brooks", rating: 5 as const, platform: "google", lang: "en", ago: "8h", date: "23 Jun 2026", status: "needs" as const, job: "Kitchen renovation", text: "Absolutely thrilled with our new kitchen. The crew was professional, tidy, and finished ahead of schedule. Highly recommend!", draft: "Thank you so much, Olivia! We are delighted the project went smoothly and that the crew left a great impression. Enjoy the new kitchen — we are always here if you need anything.", tone: "grateful" as const, reply: null, timeline: [{ key: "received", label: "Received", who: "Google", ago: "8h", done: true }, { key: "drafted", label: "AI drafted", who: "auto", ago: "8h", done: true }, { key: "posted", label: "Posted", who: null, ago: null, done: false }] },
  { id: "rv-14", name: "Bram Hofman", rating: 4 as const, platform: "google", lang: "nl", ago: "1d", date: "22 Jun 2026", status: "needs" as const, job: "Dakkapel plaatsing", text: "Mooi werk geleverd en vriendelijke monteurs. Kleine vertraging in de planning, maar verder dik tevreden.", draft: "Dag Bram, hartelijk dank voor uw mooie review! Fijn dat u tevreden bent over het werk en het team. Excuses voor de kleine vertraging — daar letten we de volgende keer extra op. Bedankt voor het vertrouwen!", tone: "grateful" as const, reply: null, timeline: [{ key: "received", label: "Received", who: "Google", ago: "1d", done: true }, { key: "drafted", label: "AI drafted", who: "auto", ago: "1d", done: true }, { key: "posted", label: "Posted", who: null, ago: null, done: false }] },
  { id: "rv-15", name: "Yusuf Kaya", rating: 5 as const, platform: "google", lang: "en", ago: "1d", date: "22 Jun 2026", status: "needs" as const, job: "Garden decking", text: "Great decking, really happy — though I had a question about the warranty paperwork that I am still waiting to hear back on.", draft: "Hi Yusuf, thank you for the kind words about the decking! Apologies for the wait on the warranty paperwork — we are looking into it now and will be in touch today with the details. Thanks for your patience.", tone: "professional" as const, reply: null, timeline: [{ key: "received", label: "Received", who: "Google", ago: "1d", done: true }, { key: "drafted", label: "AI drafted", who: "auto", ago: "1d", done: true }, { key: "posted", label: "Posted", who: null, ago: null, done: false }] },
  { id: "rv-16", name: "Lotte Janssen", rating: 4 as const, platform: "google", lang: "nl", ago: "2d", date: "21 Jun 2026", status: "needs" as const, job: "Schilderwerk", text: "Snel en netjes geschilderd, mooi resultaat. Communicatie kon iets beter rond de planning, maar tevreden met het werk.", draft: "Dag Lotte, bedankt voor uw fijne review! Fijn dat u tevreden bent met het schilderwerk. Uw punt over de communicatie nemen we ter harte — daar gaan we scherper op letten. Bedankt voor het vertrouwen!", tone: "grateful" as const, reply: null, timeline: [{ key: "received", label: "Received", who: "Google", ago: "2d", done: true }, { key: "drafted", label: "AI drafted", who: "auto", ago: "2d", done: true }, { key: "posted", label: "Posted", who: null, ago: null, done: false }] },
  { id: "rv-07", name: "Mariska Bos", rating: 5 as const, platform: "google", lang: "nl", ago: "3d", date: "20 Jun 2026", status: "replied" as const, job: "Keuken renovatie", text: "Super netjes werk, echte vakmensen! Alles op tijd af en de keuken ziet er prachtig uit. Absolute aanrader.", draft: null, tone: null, reply: { text: "Dag Mariska, wat fijn om te lezen! Hartelijk dank voor de complimenten en de aanrader — we geven ze door aan het team. Veel plezier met uw nieuwe keuken!", by: "Ricardo D.", ago: "3d" }, timeline: [{ key: "received", label: "Received", who: "Google", ago: "3d", done: true }, { key: "drafted", label: "AI drafted", who: "auto", ago: "3d", done: true }, { key: "posted", label: "Posted", who: "Ricardo D.", ago: "3d", done: true }] },
  { id: "rv-09", name: "David Chen", rating: 5 as const, platform: "google", lang: "en", ago: "1w", date: "16 Jun 2026", status: "replied" as const, job: "Kitchen renovation", text: "Outstanding kitchen renovation from start to finish. On time, on budget, and the crew was respectful of our home. Could not be happier.", draft: null, tone: null, reply: { text: "Thank you so much, David! It means a lot to hear the project went smoothly and that the crew left a good impression. Enjoy the new kitchen — we are always here if you need us.", by: "Ricardo D.", ago: "1w" }, timeline: [{ key: "received", label: "Received", who: "Google", ago: "1w", done: true }, { key: "drafted", label: "AI drafted", who: "auto", ago: "1w", done: true }, { key: "posted", label: "Posted", who: "Ricardo D.", ago: "1w", done: true }] },
  { id: "rv-10", name: "Fleur Smit", rating: 4 as const, platform: "google", lang: "nl", ago: "1w", date: "15 Jun 2026", status: "replied" as const, job: "Kozijnen vervangen", text: "Prima werk en goede prijs. Kleine vertraging bij de levering van de kozijnen, maar netjes gecommuniceerd. Tevreden.", draft: null, tone: null, reply: { text: "Dag Fleur, bedankt voor uw review en het begrip rond de levering. Fijn dat u tevreden bent met de nieuwe kozijnen — en bedankt voor het vertrouwen!", by: "Sanne K.", ago: "6d" }, timeline: [{ key: "received", label: "Received", who: "Google", ago: "1w", done: true }, { key: "drafted", label: "AI drafted", who: "auto", ago: "1w", done: true }, { key: "posted", label: "Posted", who: "Sanne K.", ago: "6d", done: true }] },
  { id: "rv-11", name: "Kevin Mol", rating: 5 as const, platform: "google", lang: "nl", ago: "2w", date: "9 Jun 2026", status: "replied" as const, job: "Aanbouw", text: "Van offerte tot oplevering alles strak geregeld. Meedenkend, eerlijk over de kosten en mooi afgewerkt. Top bedrijf.", draft: null, tone: null, reply: { text: "Dag Kevin, ontzettend bedankt voor deze mooie woorden! Wij vonden het een prettig project. Veel woonplezier in de aanbouw.", by: "Ricardo D.", ago: "13d" }, timeline: [{ key: "received", label: "Received", who: "Google", ago: "2w", done: true }, { key: "drafted", label: "AI drafted", who: "auto", ago: "2w", done: true }, { key: "posted", label: "Posted", who: "Ricardo D.", ago: "13d", done: true }] },
];

const reviews = rawReviews.map((r) => ({
  ...r,
  ini: initials(r.name),
  confidence: CONF[r.id] ?? 85,
  analysis: ANALYSIS[r.id] ?? null,
  draftReady: r.status === "needs" && !!r.draft,
}));

const needsList = reviews.filter((r) => r.status === "needs");
const negNeeds = needsList.filter((r) => r.rating <= 2).length;
const neuNeeds = needsList.filter((r) => r.rating === 3).length;
const posNeeds = needsList.filter((r) => r.rating >= 4).length;
const oldest = Math.max(...needsList.map((r) => repAgoDays(r.ago)));

const latestWaiting = needsList
  .slice()
  .sort((a, b) => repAgoDays(a.ago) - repAgoDays(b.ago))
  .slice(0, 2)
  .map((r) => ({ id: r.id, name: r.name, rating: r.rating, ago: r.ago, text: r.text }));

const auditLog = reviews
  .filter((r) => r.status === "replied")
  .map((r) => ({ id: r.id, name: r.name, rating: r.rating, ago: r.reply!.ago, by: r.reply!.by === "auto" ? "AI" : r.reply!.by }));

export const REP_DATA: RepData = {
  reviews: reviews as RepData["reviews"],
  overview: {
    health: { score: 92, of: 100, label: "Excellent", delta: "+4", note: "vs last month", drivers: [{ label: "Average rating", score: 94 }, { label: "Review volume", score: 88 }, { label: "Reply rate", score: 94 }, { label: "Response speed", score: 90 }, { label: "Sentiment", score: 91 }] },
    metrics: { avgRating: { value: "4.6", delta: "+0.2", note: "vs last 90 days" }, medianReply: { value: "23", suffix: "min", delta: "−9 min", note: "median time-to-reply" }, replyRate: { value: "94", suffix: "%", delta: "+6%", note: "of reviews answered" }, thisMonth: { value: "18", delta: "+38%", note: "new reviews", spark: [2, 3, 3, 5, 4, 6, 5, 7, 6, 8, 7, 9] } },
    ratingSeries: {
      week: { rating: [4.5, 4.7, 4.6, 4.0, 4.8, 4.6, 4.7], volume: [2, 1, 3, 2, 1, 2, 3], axis: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"], negatives: [3], now: 4.7, annotation: "+0.1 vs last week" },
      month: { rating: [4.4, 4.5, 4.4, 4.5, 4.6, 4.5, 4.6, 4.6, 4.5, 4.6], volume: [4, 3, 5, 4, 6, 5, 4, 6, 5, 7], axis: ["MAY 24", "MAY 31", "JUN 7", "JUN 14", "JUN 21"], negatives: [2, 6], now: 4.6, annotation: "+0.1 vs last month" },
      quarter: { rating: [4.2, 4.3, 4.3, 4.4, 4.4, 4.5, 4.4, 4.5, 4.5, 4.6, 4.5, 4.6, 4.6], volume: [11, 9, 13, 10, 14, 12, 15, 11, 16, 13, 17, 14, 18], axis: ["MAR 17", "APR 1", "APR 15", "MAY 1", "MAY 15", "MAY 31", "JUN 15"], negatives: [4, 5, 8, 10], now: 4.6, annotation: "+0.2 vs previous 90 days" },
    },
    sentiment: { positive: 78, neutral: 13, negative: 9 },
    distribution: [{ stars: 5, count: 86 }, { stars: 4, count: 24 }, { stars: 3, count: 9 }, { stars: 2, count: 5 }, { stars: 1, count: 4 }],
    responseSLA: [{ band: "0–24h", pct: 89, color: "var(--good)" }, { band: "24–48h", pct: 8, color: "var(--warn)" }, { band: "48h+", pct: 3, color: "var(--wine)" }],
  },
  feedback: {
    funnel: [
      { key: "served", label: "Customers served", value: 142 },
      { key: "requested", label: "Feedback requested", value: 128, note: "90% of served reached" },
      { key: "responded", label: "Responses received", value: 117, pos: 96, neg: 21 },
      { key: "sent", label: "Review requests sent", value: 117, combo: true, note: "every responder — required by law" },
      { key: "generated", label: "Reviews generated", value: 82, pos: 71, neg: 11 },
      { key: "aireplies", label: "AI replies posted", value: 64, note: "78% of new reviews, answered by AI" },
    ],
    referralAskRate: { pct: 58, asked: 56, of: 96, note: "of positive responders asked for a referral" },
    intercepted: [
      { id: "fb-1", name: "Hassan Yilmaz", ini: "HY", job: "Badkamer", ago: "1d", sentiment: "negative", lang: "nl", text: "De kitwerk in de douche laat al los na twee weken. Ik verwacht dat dit kosteloos wordt hersteld.", status: "open", assignee: null, wa: [{ from: "biz", ago: "1d", text: "Hoi Hassan, bedankt dat u koos voor onze badkamerrenovatie! Hoe beviel het werk?" }, { from: "cust", ago: "1d", text: "Eerlijk gezegd valt het tegen. De kit in de douche laat al los na twee weken." }, { from: "cust", ago: "1d", text: "Ik verwacht dat dit kosteloos wordt hersteld." }], notes: [] },
      { id: "fb-2", name: "Laura Vidal", ini: "LV", job: "Kitchen", ago: "2d", sentiment: "negative", lang: "en", text: "One of the cabinet doors does not close flush. Small thing but annoying after a full renovation.", status: "assigned", assignee: "Sanne K.", wa: [{ from: "biz", ago: "2d", text: "Hi Laura! Thanks for choosing us for your kitchen. How is everything looking?" }, { from: "cust", ago: "2d", text: "Mostly great — but one cabinet door doesn’t close flush. Small thing but annoying after a full renovation." }], notes: [{ by: "Sanne K.", ago: "1d", text: "Booked a fitter to adjust the hinge Thursday AM." }] },
      { id: "fb-3", name: "Daan Visser", ini: "DV", job: "Vloer", ago: "3d", sentiment: "negative", lang: "nl", text: "Er zit een kras in de nieuwe vloer bij de deur. Graag even langskomen om te bekijken.", status: "open", assignee: null, wa: [{ from: "biz", ago: "3d", text: "Hoi Daan, hoe bevalt de nieuwe vloer?" }, { from: "cust", ago: "3d", text: "Mooi gelegd, maar er zit een kras bij de deur. Kan iemand even langskomen?" }], notes: [] },
    ],
    routed: [
      { id: "fb-4", name: "Janneke Pol", ini: "JP", job: "Keuken", ago: "4h", sentiment: "positive", clicked: true },
      { id: "fb-5", name: "Mark de Boer", ini: "MB", job: "Dakkapel", ago: "1d", sentiment: "positive", clicked: true },
      { id: "fb-6", name: "Ayşe Demir", ini: "AD", job: "Schilderwerk", ago: "1d", sentiment: "positive", clicked: false },
      { id: "fb-7", name: "Rob Hendriks", ini: "RH", job: "Aanbouw", ago: "2d", sentiment: "positive", clicked: true },
    ],
  },
  tones: [
    { key: "apologetic", label: "Apologetic" },
    { key: "grateful", label: "Grateful" },
    { key: "professional", label: "Professional" },
    { key: "concise", label: "Concise" },
  ],
  channels: [
    { key: "sms", label: "SMS", state: "ready" },
    { key: "whatsapp", label: "WhatsApp", state: "pending" },
  ],
  platform: { name: "Google Business Profile", state: "connected", lastSync: "2 min ago", future: ["Trustpilot", "Facebook"] },
  settings: {
    auto: { threshold: 4, delay: "1h", confidenceHold: true, confidenceMin: 80, holdNegative: true },
    reply: { toneBySentiment: { negative: "apologetic", neutral: "professional", positive: "grateful" }, language: "auto", length: "standard", signOff: "Ricardo D.", includeName: true, guardrails: { noLegalFault: true, noPublicComp: true, noSpecificsEscalate: true } },
    request: { enabled: true, channel: "whatsapp", triggerDays: 3, followUp: true, followUpDays: 2, frequencyCapDays: 90, template: "Hoi {{name}}, bedankt dat u koos voor {{company}}! We horen graag hoe de {{job}} is bevallen. Zou u ons willen helpen met een korte review? Het kost één minuutje: {{review_link}}" },
    escalation: { onOneStar: true, onLowConfidence: true, keywords: ["lawyer", "refund", "court", "compensation"], notifyChannel: "email", assignee: "Ricardo D.", dailyDigest: true },
    referral: { enabled: true, askMin: 5, framing: "reward", reward: "€50 credit", delayDays: 2, channel: "whatsapp", template: "Hoi {{name}}, bedankt voor je mooie review! Ken je iemand die ook werk nodig heeft? Stuur dit bericht gerust door of laat hun naam achter. Als dank krijg je {{reward}} op je volgende klus. 🙏" },
  },
  auditLog,
  latestWaiting,
  summary: {
    avg: 4.6,
    count: 128,
    needsReply: needsList.length,
    negNeeds,
    neuNeeds,
    posNeeds,
    draftReady: reviews.filter((r) => r.draftReady).length,
    replied: reviews.filter((r) => r.status === "replied").length,
    intercepted: 3,
    oldestDays: Math.round(oldest),
    aiCoverage: 91,
  },
};
