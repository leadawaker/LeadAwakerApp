/**
 * Everything the review demo says, in the language of the link (not the CRM
 * user's), same reasoning as features/voiceDemo/copy.ts. Portuguese is Brazilian.
 */
export type UiLang = "en" | "nl" | "pt";

export interface ReviewCopy {
  customerTitle: string;
  customerHint: string;
  managerTitle: string;
  managerHint: (company: string) => string;
  channelSms: string;
  channelWa: string;
  smsDivider: string;
  today: string;
  placeholder: string;
  silent: string;
  managerLabel: (company: string) => string;
  alertTitle: (name: string, stars: number) => string;
  reviewApp: string;
  reviewTitle: (name: string, stars: number) => string;
  draftTitle: string;
  draftTap: string;
  draftLoading: string;
  draftFailed: string;
  approve: string;
  edit: string;
  approved: string;
  popupQuestion: string;
  popupPlaceholder: string;
  popupPost: string;
  popupDisclaimer: string;
  replay: string;
  offline: string;
  expired: string;
  now: string;
}

const en: ReviewCopy = {
  customerTitle: "The customer's phone",
  customerHint: "You're texting as the customer",
  managerTitle: "The manager's phone",
  managerHint: (c) => `${c} stays silent until it matters`,
  channelSms: "Text Message · SMS",
  channelWa: "WhatsApp",
  smsDivider: "Text Message",
  today: "Today",
  placeholder: "Text Message",
  silent: "Silent until a human is actually needed",
  managerLabel: (c) => `${c} · Manager`,
  alertTitle: (n, s) => `${n} rated ${s}/5: needs a call`,
  reviewApp: "Google Business",
  reviewTitle: (n, s) => `New ${s}-star review from ${n}`,
  draftTitle: "AI drafted a reply",
  draftTap: "Tap to review and approve",
  draftLoading: "Drafting a reply...",
  draftFailed: "Could not draft a reply this time.",
  approve: "Approve",
  edit: "Edit",
  approved: "Approved. It will be posted to Google.",
  popupQuestion: "How was your experience?",
  popupPlaceholder: "Share details of your experience (optional)",
  popupPost: "Post review",
  popupDisclaimer: "Demo only, nothing is posted publicly",
  replay: "Replay demo",
  offline: "The assistant is offline. Try again in a minute.",
  expired: "This demo link has expired.",
  now: "now",
};

const nl: ReviewCopy = {
  customerTitle: "De telefoon van de klant",
  customerHint: "Jij appt als de klant",
  managerTitle: "De telefoon van de manager",
  managerHint: (c) => `${c} blijft stil tot het ertoe doet`,
  channelSms: "Sms-bericht",
  channelWa: "WhatsApp",
  smsDivider: "Sms-bericht",
  today: "Vandaag",
  placeholder: "Sms-bericht",
  silent: "Stil tot er echt een mens nodig is",
  managerLabel: (c) => `${c} · Manager`,
  alertTitle: (n, s) => `${n} gaf een ${s}/5: wil gebeld worden`,
  reviewApp: "Google Bedrijfsprofiel",
  reviewTitle: (n, s) => `Nieuwe ${s}-sterren review van ${n}`,
  draftTitle: "AI heeft een reactie opgesteld",
  draftTap: "Tik om te bekijken en goed te keuren",
  draftLoading: "Reactie opstellen...",
  draftFailed: "Het lukte niet om een reactie op te stellen.",
  approve: "Goedkeuren",
  edit: "Aanpassen",
  approved: "Goedgekeurd. Hij wordt op Google geplaatst.",
  popupQuestion: "Hoe was je ervaring?",
  popupPlaceholder: "Vertel over je ervaring (optioneel)",
  popupPost: "Review plaatsen",
  popupDisclaimer: "Alleen een demo, er wordt niets openbaar geplaatst",
  replay: "Demo opnieuw",
  offline: "De assistent is offline. Probeer het zo nog eens.",
  expired: "Deze demolink is verlopen.",
  now: "nu",
};

const pt: ReviewCopy = {
  customerTitle: "O celular do cliente",
  customerHint: "Você está conversando como o cliente",
  managerTitle: "O celular do gerente",
  managerHint: (c) => `${c} fica em silêncio até ser necessário`,
  channelSms: "Mensagem de texto · SMS",
  channelWa: "WhatsApp",
  smsDivider: "Mensagem de texto",
  today: "Hoje",
  placeholder: "Mensagem de texto",
  silent: "Em silêncio até alguém realmente precisar",
  managerLabel: (c) => `${c} · Gerente`,
  alertTitle: (n, s) => `${n} deu ${s}/5: quer uma ligação`,
  reviewApp: "Google Meu Negócio",
  reviewTitle: (n, s) => `Nova avaliação de ${s} estrelas de ${n}`,
  draftTitle: "A IA escreveu uma resposta",
  draftTap: "Toque para revisar e aprovar",
  draftLoading: "Escrevendo uma resposta...",
  draftFailed: "Não deu para escrever uma resposta agora.",
  approve: "Aprovar",
  edit: "Editar",
  approved: "Aprovada. Vai ser publicada no Google.",
  popupQuestion: "Como foi sua experiência?",
  popupPlaceholder: "Conte como foi sua experiência (opcional)",
  popupPost: "Publicar avaliação",
  popupDisclaimer: "Só uma demo, nada é publicado",
  replay: "Repetir demo",
  offline: "O assistente está offline. Tente de novo daqui a pouco.",
  expired: "Este link de demo expirou.",
  now: "agora",
};

const TABLE: Record<UiLang, ReviewCopy> = { en, nl, pt };

export function copyFor(lang: string): ReviewCopy {
  const l = (lang || "en").slice(0, 2).toLowerCase() as UiLang;
  return TABLE[l] ?? en;
}
