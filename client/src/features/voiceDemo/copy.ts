import type { VoiceLocale } from "./types";

/**
 * Everything the demo page says, in the language of the call.
 *
 * NOT the app's i18n. That resolves against the language of whoever is logged
 * in, and this page's language belongs to the link instead: a Dutch account
 * manager mints a link for a Brazilian prospect, and the page that prospect
 * opens has to be Portuguese. Those two are different axes, and routing this
 * through react-i18next would tie the prospect's experience to the CRM user's
 * settings. The demo also speaks Spanish, which the CRM does not.
 *
 * Kept as one table rather than four locale files because it is the whole
 * surface of one page, and a missing key here is a visible English word in the
 * middle of a Portuguese demo.
 */

export type UiLang = "en" | "nl" | "pt" | "es";

export interface DemoCopy {
  lockedTitle: string;
  lockedHint: string;
  passwordPlaceholder: string;
  wrongPassword: string;
  continueLabel: string;

  setupTitle: string;
  setupSubtitle: string;
  languageLabel: string;
  noNativeVoice: string;
  companyLabel: string;
  phoneLabel: string;
  voiceLabel: string;
  voiceDefault: string;
  callHer: string;

  simplePrompt: string;
  call: string;

  connecting: string;
  onCall: string;
  callEnded: string;
  again: string;
  hangUp: string;
  sayHello: string;

  endedTimeLimit: string;
  endedDropped: string;
  endedCompleted: string;
  endedSilence: string;

  booked: string;

  crmTitle: string;
  crmLive: string;
  crmAfter: string;
  liveBadge: string;
  crmEmpty: string;
  whatTheyCalledAbout: string;
  fillsInLater: string;
  nothingRecorded: string;
  lead: string;
  isNew: string;
  name: string;
  phone: string;
  source: string;
  inboundCall: string;
  status: string;
  appointmentBooked: string;
  inConversation: string;
  downloadRecording: string;
  noAppointmentYet: string;
  siteSurvey: string;

  wantsToBook: string;
  wantsAQuote: string;
  wantsAdvice: string;
  existingCustomer: string;
  faultOrComplaint: string;
  notRelevant: string;

  /** Monday-first, matching the mini calendar's own week. */
  weekdayInitials: [string, string, string, string, string, string, string];
}

const EN: DemoCopy = {
  lockedTitle: "This demo is locked",
  lockedHint: "Enter the password to continue.",
  passwordPlaceholder: "Password",
  wrongPassword: "Wrong password. Try again.",
  continueLabel: "Continue",

  setupTitle: "Call the AI receptionist",
  setupSubtitle: "She answers the phone, works out what you need, and books you in.",
  languageLabel: "Language",
  noNativeVoice: "No native voice exists for this language yet, so the accent may not be perfect.",
  companyLabel: "Company she answers for",
  phoneLabel: "The number you are calling from",
  voiceLabel: "Voice",
  voiceDefault: "Default for this language",
  callHer: "Call her",

  simplePrompt: "Call the reception and see what happens.",
  call: "Call",

  connecting: "Connecting…",
  onCall: "On the call",
  callEnded: "Call ended",
  again: "Again",
  hangUp: "Hang up",
  sayHello: "Say hello when you're ready.",

  endedTimeLimit: "The demo's five-minute limit was reached.",
  endedDropped: "The connection dropped.",
  endedCompleted: "She finished the call.",
  endedSilence: "Nobody spoke for a while, so she rang off.",

  booked: "Booked",

  crmTitle: "In the CRM",
  crmLive: "Written live, as the call happens",
  crmAfter: "Written while you were talking",
  liveBadge: "Live",
  crmEmpty:
    "Nothing written yet. The moment either of you speaks, a lead is created and every turn is saved against it.",
  whatTheyCalledAbout: "What they called about",
  fillsInLater: "Fills in once the call wraps up.",
  nothingRecorded: "Nothing recorded for this call.",
  lead: "Lead",
  isNew: "New",
  name: "Name",
  phone: "Phone",
  source: "Source",
  inboundCall: "Inbound call",
  status: "Status",
  appointmentBooked: "Appointment booked",
  inConversation: "In conversation",
  downloadRecording: "Download the recording",
  noAppointmentYet: "No appointment booked yet",
  siteSurvey: "Site survey · 45 min",

  wantsToBook: "Wants to book",
  wantsAQuote: "Wants a quote",
  wantsAdvice: "Wants advice",
  existingCustomer: "Existing customer",
  faultOrComplaint: "Fault or complaint",
  notRelevant: "Not relevant",

  weekdayInitials: ["M", "T", "W", "T", "F", "S", "S"],
};

const NL: DemoCopy = {
  lockedTitle: "Deze demo is vergrendeld",
  lockedHint: "Voer het wachtwoord in om verder te gaan.",
  passwordPlaceholder: "Wachtwoord",
  wrongPassword: "Verkeerd wachtwoord. Probeer het opnieuw.",
  continueLabel: "Verder",

  setupTitle: "Bel de AI-receptioniste",
  setupSubtitle: "Ze neemt op, achterhaalt wat u nodig hebt en plant u in.",
  languageLabel: "Taal",
  noNativeVoice:
    "Voor deze taal bestaat nog geen eigen stem, dus het accent klopt mogelijk niet helemaal.",
  companyLabel: "Bedrijf waarvoor ze opneemt",
  phoneLabel: "Het nummer waarvandaan u belt",
  voiceLabel: "Stem",
  voiceDefault: "Standaard voor deze taal",
  callHer: "Bel haar",

  simplePrompt: "Bel de receptie en hoor wat er gebeurt.",
  call: "Bellen",

  connecting: "Verbinden…",
  onCall: "In gesprek",
  callEnded: "Gesprek beëindigd",
  again: "Opnieuw",
  hangUp: "Ophangen",
  sayHello: "Zeg gerust hallo wanneer u zover bent.",

  endedTimeLimit: "De limiet van vijf minuten voor deze demo is bereikt.",
  endedDropped: "De verbinding is verbroken.",
  endedCompleted: "Ze heeft het gesprek afgerond.",
  endedSilence: "Er werd een tijd niets gezegd, dus heeft ze opgehangen.",

  booked: "Ingepland",

  crmTitle: "In het CRM",
  crmLive: "Live geschreven, tijdens het gesprek",
  crmAfter: "Geschreven terwijl u aan het bellen was",
  liveBadge: "Live",
  crmEmpty:
    "Nog niets vastgelegd. Zodra een van u iets zegt, wordt er een lead aangemaakt en elke beurt daarbij opgeslagen.",
  whatTheyCalledAbout: "Waarvoor er gebeld werd",
  fillsInLater: "Wordt ingevuld zodra het gesprek is afgerond.",
  nothingRecorded: "Niets vastgelegd voor dit gesprek.",
  lead: "Lead",
  isNew: "Nieuw",
  name: "Naam",
  phone: "Telefoon",
  source: "Bron",
  inboundCall: "Inkomend gesprek",
  status: "Status",
  appointmentBooked: "Afspraak ingepland",
  inConversation: "In gesprek",
  downloadRecording: "Opname downloaden",
  noAppointmentYet: "Nog geen afspraak ingepland",
  siteSurvey: "Opname ter plaatse · 45 min",

  wantsToBook: "Wil inplannen",
  wantsAQuote: "Wil een offerte",
  wantsAdvice: "Wil advies",
  existingCustomer: "Bestaande klant",
  faultOrComplaint: "Storing of klacht",
  notRelevant: "Niet relevant",

  weekdayInitials: ["M", "D", "W", "D", "V", "Z", "Z"],
};

const PT: DemoCopy = {
  lockedTitle: "Esta demonstração está bloqueada",
  lockedHint: "Digite a senha para continuar.",
  passwordPlaceholder: "Senha",
  wrongPassword: "Senha incorreta. Tente novamente.",
  continueLabel: "Continuar",

  setupTitle: "Ligue para a recepcionista de IA",
  setupSubtitle: "Ela atende, entende o que você precisa e já agenda para você.",
  languageLabel: "Idioma",
  noNativeVoice:
    "Ainda não existe uma voz nativa para este idioma, então o sotaque pode não sair perfeito.",
  companyLabel: "Empresa pela qual ela atende",
  phoneLabel: "O número de onde você está ligando",
  voiceLabel: "Voz",
  voiceDefault: "Padrão para este idioma",
  callHer: "Ligar para ela",

  simplePrompt: "Ligue para a recepção e veja o que acontece.",
  call: "Ligar",

  connecting: "Conectando…",
  onCall: "Na ligação",
  callEnded: "Ligação encerrada",
  again: "De novo",
  hangUp: "Desligar",
  sayHello: "É só dizer oi quando estiver pronto.",

  endedTimeLimit: "O limite de cinco minutos da demonstração foi atingido.",
  endedDropped: "A conexão caiu.",
  endedCompleted: "Ela encerrou a ligação.",
  endedSilence: "Ninguém falou por um tempo, então ela desligou.",

  booked: "Agendado",

  crmTitle: "No CRM",
  crmLive: "Escrito ao vivo, durante a ligação",
  crmAfter: "Escrito enquanto você falava",
  liveBadge: "Ao vivo",
  crmEmpty:
    "Nada registrado ainda. Assim que um de vocês falar, um lead é criado e cada fala fica salva nele.",
  whatTheyCalledAbout: "Motivo da ligação",
  fillsInLater: "Preenche assim que a ligação terminar.",
  nothingRecorded: "Nada registrado nesta ligação.",
  lead: "Lead",
  isNew: "Novo",
  name: "Nome",
  phone: "Telefone",
  source: "Origem",
  inboundCall: "Ligação recebida",
  status: "Status",
  appointmentBooked: "Horário agendado",
  inConversation: "Em conversa",
  downloadRecording: "Baixar a gravação",
  noAppointmentYet: "Nenhum horário agendado ainda",
  siteSurvey: "Visita técnica · 45 min",

  wantsToBook: "Quer agendar",
  wantsAQuote: "Quer um orçamento",
  wantsAdvice: "Quer orientação",
  existingCustomer: "Cliente atual",
  faultOrComplaint: "Problema ou reclamação",
  notRelevant: "Não relevante",

  weekdayInitials: ["S", "T", "Q", "Q", "S", "S", "D"],
};

const ES: DemoCopy = {
  lockedTitle: "Esta demo está bloqueada",
  lockedHint: "Introduce la contraseña para continuar.",
  passwordPlaceholder: "Contraseña",
  wrongPassword: "Contraseña incorrecta. Inténtalo de nuevo.",
  continueLabel: "Continuar",

  setupTitle: "Llama a la recepcionista de IA",
  setupSubtitle: "Contesta el teléfono, entiende lo que necesitas y te agenda una cita.",
  languageLabel: "Idioma",
  noNativeVoice:
    "Todavía no existe una voz nativa para este idioma, así que puede que el acento no sea perfecto.",
  companyLabel: "Empresa para la que contesta",
  phoneLabel: "El número desde el que llamas",
  voiceLabel: "Voz",
  voiceDefault: "Predeterminada para este idioma",
  callHer: "Llamarla",

  simplePrompt: "Llama a recepción y mira lo que pasa.",
  call: "Llamar",

  connecting: "Conectando…",
  onCall: "En la llamada",
  callEnded: "Llamada finalizada",
  again: "Otra vez",
  hangUp: "Colgar",
  sayHello: "Saluda cuando estés listo.",

  endedTimeLimit: "Se alcanzó el límite de cinco minutos de la demo.",
  endedDropped: "Se cortó la conexión.",
  endedCompleted: "Ella terminó la llamada.",
  endedSilence: "Nadie habló durante un rato, así que colgó.",

  booked: "Agendado",

  crmTitle: "En el CRM",
  crmLive: "Escrito en vivo, durante la llamada",
  crmAfter: "Escrito mientras hablabas",
  liveBadge: "En vivo",
  crmEmpty:
    "Todavía no hay nada. En cuanto alguno de los dos hable, se crea un contacto y cada intervención queda guardada en él.",
  whatTheyCalledAbout: "Motivo de la llamada",
  fillsInLater: "Se completa cuando termine la llamada.",
  nothingRecorded: "No se registró nada en esta llamada.",
  lead: "Contacto",
  isNew: "Nuevo",
  name: "Nombre",
  phone: "Teléfono",
  source: "Origen",
  inboundCall: "Llamada entrante",
  status: "Estado",
  appointmentBooked: "Cita agendada",
  inConversation: "En conversación",
  downloadRecording: "Descargar la grabación",
  noAppointmentYet: "Todavía no hay ninguna cita",
  siteSurvey: "Visita técnica · 45 min",

  wantsToBook: "Quiere agendar",
  wantsAQuote: "Quiere un presupuesto",
  wantsAdvice: "Quiere asesoramiento",
  existingCustomer: "Cliente actual",
  faultOrComplaint: "Avería o reclamación",
  notRelevant: "No relevante",

  weekdayInitials: ["L", "M", "X", "J", "V", "S", "D"],
};

/**
 * European Portuguese, where it genuinely differs from Brazilian. Only the
 * words that would mark the page as foreign to a Portuguese reader: "senha"
 * and "baixar" are Brazilian, "está a falar" is the European present
 * continuous. Everything unlisted is shared.
 */
const PT_PT: Partial<DemoCopy> = {
  // Post-1990 orthography: Portugal drops the p in "recepcionista".
  setupTitle: "Ligue para a rececionista de IA",
  lockedHint: "Introduza a palavra-passe para continuar.",
  passwordPlaceholder: "Palavra-passe",
  wrongPassword: "Palavra-passe incorreta. Tente novamente.",
  setupSubtitle: "Ela atende, percebe o que precisa e marca consigo.",
  companyLabel: "Empresa pela qual atende",
  phoneLabel: "O número de onde está a ligar",
  simplePrompt: "Ligue para a receção e veja o que acontece.",
  sayHello: "Diga olá quando estiver pronto.",
  crmAfter: "Escrito enquanto estava a falar",
  crmEmpty:
    "Ainda nada registado. Assim que um de vós falar, é criado um contacto e cada fala fica guardada nele.",
  crmLive: "Escrito em direto, durante a chamada",
  liveBadge: "Em direto",
  onCall: "Em chamada",
  callEnded: "Chamada terminada",
  endedTimeLimit: "Foi atingido o limite de cinco minutos da demonstração.",
  endedCompleted: "Ela terminou a chamada.",
  endedSilence: "Ninguém falou durante algum tempo, por isso desligou.",
  endedDropped: "A ligação caiu.",
  fillsInLater: "É preenchido assim que a chamada terminar.",
  nothingRecorded: "Nada registado nesta chamada.",
  downloadRecording: "Transferir a gravação",
  inboundCall: "Chamada recebida",
  appointmentBooked: "Marcação agendada",
  noAppointmentYet: "Ainda não há marcação",
};

const BY_LANG: Record<UiLang, DemoCopy> = { en: EN, nl: NL, pt: PT, es: ES };

/** The language the page should be written in, given the language of the call. */
export function uiLangOf(locale: VoiceLocale): UiLang {
  if (locale.startsWith("nl")) return "nl";
  if (locale.startsWith("pt")) return "pt";
  if (locale.startsWith("es")) return "es";
  return "en";
}

/**
 * The BCP-47 tag dates should be formatted with. Not the browser's: a Dutch
 * laptop opening a Portuguese demo must still read "quarta-feira, 16 de
 * setembro", because that is the language she just said it in out loud.
 */
const DATE_LOCALE: Record<VoiceLocale, string> = {
  "en-GB": "en-GB",
  "en-US": "en-US",
  nl: "nl-NL",
  "pt-BR": "pt-BR",
  "pt-PT": "pt-PT",
  "es-ES": "es-ES",
};

export function dateLocaleOf(locale: VoiceLocale): string {
  return DATE_LOCALE[locale] ?? "en-GB";
}

export function copyFor(locale: VoiceLocale): DemoCopy {
  const base = BY_LANG[uiLangOf(locale)];
  return locale === "pt-PT" ? { ...base, ...PT_PT } : base;
}
