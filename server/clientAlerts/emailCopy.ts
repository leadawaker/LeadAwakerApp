// Email wording for client recaps and instant alerts (specs/client-recaps),
// in en, nl and pt (Brazilian). Server-rendered, so the strings live here and
// not in the client locales, like the invite TRANSLATIONS in server/email.ts.
// Values are plain text; the renderers escape everything.

export type EmailLang = "en" | "nl" | "pt";
export type AlertEmailType =
  | "appointment_booked" | "appointment_rescheduled" | "appointment_cancelled"
  | "callback_requested" | "lead_needs_reply" | "new_photo";

interface Copy {
  cta: string;
  footer: (account: string) => string;
  /** Footer link to the Recaps & alerts settings. */
  manage: string;
  unknown: string;
  labels: {
    customer: string; phone: string; email: string; when: string; oldWhen: string;
    source: string; callbackPhone: string; about: string; reason: string; lastMessage: string; since: string; summary: string;
    photo: string; description: string; caption: string; channel: string;
    messageFor: string; caller: string; whatsapp: string;
  };
  /** Shown instead of the photo when it could not be attached (too large, or a test). */
  photoMissing: string;
  /** Under the photo when it is attached in full size. */
  photoAttached: string;
  /** A bundle of 2+ photos from one lead (sent 5 minutes after the first). */
  photoBundle: {
    subject: (name: string, n: number) => string;
    heading: string;
    intro: (account: string, n: number) => string;
    attached: string;
    /** Photos left out of the email (size caps): still in Lead Awaker. */
    more: (n: number) => string;
  };
  /** A message a caller left for the team: callback_requested with reason
   *  "leave_message". `to` is who it is for, "" when the call did not say. */
  message: {
    subject: (name: string, to: string) => string;
    heading: (to: string) => string;
    intro: (account: string, to: string) => string;
    /** Above the message bubble. */
    label: string;
    /** Under the bubble: who left it. */
    by: (who: string) => string;
    note: (to: string) => string;
    cta: string;
  };
  subject: Record<AlertEmailType, (name: string, time: string, phone: string) => string> & {
    daily_recap: (account: string, date: string) => string;
  };
  heading: Record<AlertEmailType | "daily_recap", string>;
  intro: Record<AlertEmailType, (account: string) => string>;
  /** One muted line under an alert's facts, for what the facts do not say. */
  notes: Partial<Record<AlertEmailType, string>>;
  recap: {
    intro: (account: string) => string;
    calls: string; conversations: string; newContacts: string; newAppointments: string; waiting: string;
    sectionAppointments: string; sectionWaiting: string; sectionCalls: string; sectionTomorrow: string;
    kind: Record<"booked" | "rescheduled" | "cancelled", string>;
    waitingKind: Record<"callback" | "reply", string>;
    callsToday: (n: number) => string;
    allCalls: (n: number) => string;
    openCall: string;
    /** A waiting row's link to the lead's chat. */
    openChat: string;
    unknownCaller: string;
    subheading: string; sectionToday: string; quiet: string;
    /** Agenda: the rest of this week, or all of next week on a Sunday. */
    sectionWeek: string; weekSub: string; sectionNextWeek: string; nextWeekSub: string; weekEmpty: string;
    weekTitle: string;
    /** Last-7-days figures: [one, many] after the number. */
    weekStats: Record<"appointments" | "calls" | "conversations", [one: string, many: string]>;
  };
  /** Event rows in the recap's "today" section. `title` is the kind, in small capitals. */
  someone: string;
  via: (source: string) => string;
  pills: Record<"new" | "moved", string>;
  cards: {
    booked: { title: string; text: (name: string, at: string) => string };
    rescheduled: { title: string; text: (name: string, at: string) => string };
    cancelled: { title: string; text: (name: string, at: string) => string };
    callback: { title: string; text: (name: string) => string };
    reply: { title: string; text: (name: string) => string };
    message: { title: string; text: (name: string, to: string) => string };
  };
}

const EN: Copy = {
  cta: "Open in Lead Awaker",
  footer: (a) => `You get this because ${a} set up updates in Lead Awaker.`,
  manage: "Choose which emails you get",
  unknown: "not given",
  labels: {
    customer: "Customer", phone: "Phone", email: "Email", when: "Date", oldWhen: "Was",
    source: "Booked through", callbackPhone: "Call back on", about: "About", reason: "Reason", lastMessage: "Last message", since: "Since", summary: "Summary",
    photo: "Photo", description: "What the photo shows", caption: "Their message", channel: "Sent through",
    messageFor: "For", caller: "Caller", whatsapp: "WhatsApp",
  },
  photoMissing: "Open Lead Awaker to see the photo.",
  photoAttached: "The full-size photo is attached to this email.",
  photoBundle: {
    subject: (name, n) => `${n} new photos from ${name}`,
    heading: "New photos",
    intro: (a, n) => `A customer sent ${a} ${n} photos in the chat.`,
    attached: "The full-size photos are attached to this email.",
    more: (n) => (n === 1 ? "1 more photo is in Lead Awaker." : `${n} more photos are in Lead Awaker.`),
  },
  message: {
    subject: (n, to) => (to ? `Message for ${to} from ${n}` : `New message from ${n}`),
    heading: (to) => (to ? `Message for ${to}` : "New message"),
    intro: (a, to) => `Someone called ${a} and left a message for ${to || "your team"}.`,
    label: "The message",
    by: (w) => `From ${w}`,
    note: (to) => (to
      ? `Please pass it on to ${to}, or call them back on the number above.`
      : "Call them back on the number above, or open the call to see the whole conversation."),
    cta: "Open the call",
  },
  subject: {
    daily_recap: (a, d) => `Daily recap for ${a}, ${d}`,
    appointment_booked: (n, t) => `New appointment: ${n}, ${t}`,
    appointment_rescheduled: (n, t) => `Appointment moved: ${n}, now ${t}`,
    appointment_cancelled: (n, t) => `Appointment cancelled: ${n}, ${t}`,
    callback_requested: (n, _t, p) => `Call back: ${n} (${p})`,
    lead_needs_reply: (n) => `Reply needed: ${n}`,
    new_photo: (n) => `New photo from ${n}`,
  },
  heading: {
    daily_recap: "Daily recap", appointment_booked: "New appointment", appointment_rescheduled: "Appointment moved",
    appointment_cancelled: "Appointment cancelled", callback_requested: "Callback request", lead_needs_reply: "Reply needed",
    new_photo: "New photo",
  },
  intro: {
    appointment_booked: (a) => `A new appointment was booked for ${a}.`,
    appointment_rescheduled: (a) => `An appointment for ${a} was moved to a new time.`,
    appointment_cancelled: (a) => `An appointment for ${a} was cancelled by the customer.`,
    callback_requested: (a) => `Someone who called ${a} would like a call back. Please call them back as soon as you can.`,
    lead_needs_reply: (a) => `A conversation for ${a} needs a reply from your team. The assistant has paused this chat until someone answers.`,
    new_photo: (a) => `A customer sent ${a} a photo in the chat.`,
  },
  notes: { lead_needs_reply: "The assistant has paused this chat until someone answers." },
  recap: {
    intro: (a) => `Here is today's update for ${a}.`,
    calls: "Calls", conversations: "Conversations", newContacts: "New contacts",
    newAppointments: "New appointments", waiting: "Waiting on your team",
    sectionAppointments: "Appointments", sectionWaiting: "Waiting on your team",
    sectionCalls: "Calls", sectionTomorrow: "Tomorrow",
    kind: { booked: "booked", rescheduled: "moved", cancelled: "cancelled" },
    waitingKind: { callback: "call back", reply: "reply in chat" },
    callsToday: (n) => `${n} today`,
    allCalls: (n) => `See all ${n} calls`,
    openCall: "Open",
    openChat: "Open chat",
    unknownCaller: "unknown caller",
    subheading: "Today's most important updates, at a glance.",
    sectionToday: "Today in brief",
    quiet: "No new appointments today and nothing waiting on your team.",
    sectionWeek: "This week's agenda", weekSub: "Appointments from today to Sunday",
    sectionNextWeek: "Next week's agenda", nextWeekSub: "Appointments from Monday to Sunday",
    weekEmpty: "No appointments scheduled yet.",
    weekTitle: "The past week",
    weekStats: {
      appointments: ["appointment booked", "appointments booked"],
      calls: ["call answered", "calls answered"],
      conversations: ["chat handled", "chats handled"],
    },
  },
  someone: "A customer",
  via: (s) => `via ${s}`,
  pills: { new: "New", moved: "Moved" },
  cards: {
    booked: { title: "Appointment", text: (n, at) => `${n} booked an appointment for ${at}.` },
    rescheduled: { title: "Appointment moved", text: (n, at) => `${n} moved the appointment to ${at}.` },
    cancelled: { title: "Appointment cancelled", text: (n, at) => `${n} cancelled the appointment on ${at}.` },
    callback: { title: "Callback request", text: (n) => `${n} would like a call back.` },
    reply: { title: "Waiting for a reply", text: (n) => `${n} is waiting for an answer from your team in the chat.` },
    message: { title: "Message", text: (n, to) => `${n} left a message for ${to || "your team"}.` },
  },
};

const NL: Copy = {
  cta: "Openen in Lead Awaker",
  footer: (a) => `Je ontvangt dit omdat ${a} updates heeft ingesteld in Lead Awaker.`,
  manage: "Kies welke e-mails je ontvangt",
  unknown: "niet genoemd",
  labels: {
    customer: "Klant", phone: "Telefoon", email: "E-mail", when: "Datum", oldWhen: "Was",
    source: "Geboekt via", callbackPhone: "Terugbellen op", about: "Onderwerp", reason: "Reden", lastMessage: "Laatste bericht", since: "Sinds", summary: "Samenvatting",
    photo: "Foto", description: "Wat er op de foto staat", caption: "Hun bericht", channel: "Gestuurd via",
    messageFor: "Voor", caller: "Beller", whatsapp: "WhatsApp",
  },
  photoMissing: "Open Lead Awaker om de foto te bekijken.",
  photoAttached: "De foto zit op ware grootte als bijlage bij deze e-mail.",
  photoBundle: {
    subject: (name, n) => `${n} nieuwe foto's van ${name}`,
    heading: "Nieuwe foto's",
    intro: (a, n) => `Een klant heeft ${a} ${n} foto's gestuurd in de chat.`,
    attached: "De foto's zitten op ware grootte als bijlage bij deze e-mail.",
    more: (n) => (n === 1 ? "Nog 1 foto staat in Lead Awaker." : `Nog ${n} foto's staan in Lead Awaker.`),
  },
  message: {
    subject: (n, to) => (to ? `Bericht voor ${to} van ${n}` : `Nieuw bericht van ${n}`),
    heading: (to) => (to ? `Bericht voor ${to}` : "Nieuw bericht"),
    intro: (a, to) => `Iemand belde ${a} en liet een bericht achter voor ${to || "jullie team"}.`,
    label: "Het bericht",
    by: (w) => `Van ${w}`,
    note: (to) => (to
      ? `Geef het door aan ${to}, of bel de beller terug op het nummer hierboven.`
      : "Bel de beller terug op het nummer hierboven, of open het gesprek om alles terug te lezen."),
    cta: "Open het gesprek",
  },
  subject: {
    daily_recap: (a, d) => `Dagoverzicht ${a}, ${d}`,
    appointment_booked: (n, t) => `Nieuwe afspraak: ${n}, ${t}`,
    appointment_rescheduled: (n, t) => `Afspraak verzet: ${n}, nu ${t}`,
    appointment_cancelled: (n, t) => `Afspraak geannuleerd: ${n}, ${t}`,
    callback_requested: (n, _t, p) => `Terugbelverzoek: ${n} (${p})`,
    lead_needs_reply: (n) => `Reactie nodig: ${n}`,
    new_photo: (n) => `Nieuwe foto van ${n}`,
  },
  heading: {
    daily_recap: "Dagoverzicht", appointment_booked: "Nieuwe afspraak", appointment_rescheduled: "Afspraak verzet",
    appointment_cancelled: "Afspraak geannuleerd", callback_requested: "Terugbelverzoek", lead_needs_reply: "Reactie nodig",
    new_photo: "Nieuwe foto",
  },
  intro: {
    appointment_booked: (a) => `Er is een nieuwe afspraak ingepland voor ${a}.`,
    appointment_rescheduled: (a) => `Een afspraak voor ${a} is verzet naar een nieuw moment.`,
    appointment_cancelled: (a) => `Een afspraak voor ${a} is door de klant geannuleerd.`,
    callback_requested: (a) => `Iemand die ${a} belde wil graag teruggebeld worden. Bel diegene zo snel mogelijk terug.`,
    lead_needs_reply: (a) => `Een gesprek voor ${a} heeft een reactie van jullie team nodig. De assistent heeft deze chat gepauzeerd tot iemand antwoordt.`,
    new_photo: (a) => `Een klant heeft ${a} een foto gestuurd in de chat.`,
  },
  notes: { lead_needs_reply: "De assistent heeft deze chat gepauzeerd tot iemand antwoordt." },
  recap: {
    intro: (a) => `Hier is de update van vandaag voor ${a}.`,
    calls: "Telefoontjes", conversations: "Chats", newContacts: "Nieuwe contacten",
    newAppointments: "Nieuwe afspraken", waiting: "Wacht op jullie team",
    sectionAppointments: "Afspraken", sectionWaiting: "Wacht op jullie team",
    sectionCalls: "Telefoontjes", sectionTomorrow: "Morgen",
    kind: { booked: "geboekt", rescheduled: "verzet", cancelled: "geannuleerd" },
    waitingKind: { callback: "terugbellen", reply: "reageren in de chat" },
    callsToday: (n) => `${n} vandaag`,
    allCalls: (n) => `Bekijk alle ${n} telefoontjes`,
    openCall: "Openen",
    openChat: "Open de chat",
    unknownCaller: "onbekende beller",
    subheading: "De belangrijkste updates van vandaag, in één oogopslag.",
    sectionToday: "Vandaag in het kort",
    quiet: "Vandaag geen nieuwe afspraken en niets dat op jullie wacht.",
    sectionWeek: "Agenda deze week", weekSub: "Afspraken van vandaag t/m zondag",
    sectionNextWeek: "Agenda komende week", nextWeekSub: "Afspraken van maandag t/m zondag",
    weekEmpty: "Nog geen afspraken ingepland.",
    weekTitle: "De afgelopen week",
    weekStats: {
      appointments: ["afspraak geboekt", "afspraken geboekt"],
      calls: ["telefoontje beantwoord", "telefoontjes beantwoord"],
      conversations: ["chatgesprek gevoerd", "chatgesprekken gevoerd"],
    },
  },
  someone: "Een klant",
  via: (s) => `via ${s}`,
  pills: { new: "Nieuw", moved: "Verzet" },
  cards: {
    booked: { title: "Afspraak", text: (n, at) => `${n} heeft een afspraak gemaakt voor ${at}.` },
    rescheduled: { title: "Afspraak verzet", text: (n, at) => `${n} heeft de afspraak verzet naar ${at}.` },
    cancelled: { title: "Afspraak geannuleerd", text: (n, at) => `${n} heeft de afspraak van ${at} geannuleerd.` },
    callback: { title: "Terugbelverzoek", text: (n) => `${n} wil graag teruggebeld worden.` },
    reply: { title: "Wacht op een reactie", text: (n) => `${n} wacht in de chat op een antwoord van jullie team.` },
    message: { title: "Bericht", text: (n, to) => `${n} liet een bericht achter voor ${to || "jullie team"}.` },
  },
};

const PT: Copy = {
  cta: "Abrir no Lead Awaker",
  footer: (a) => `Você recebe isto porque ${a} ativou atualizações no Lead Awaker.`,
  manage: "Escolha quais e-mails você recebe",
  unknown: "não informado",
  labels: {
    customer: "Cliente", phone: "Telefone", email: "E-mail", when: "Data", oldWhen: "Antes",
    source: "Agendado por", callbackPhone: "Retornar para", about: "Assunto", reason: "Motivo", lastMessage: "Última mensagem", since: "Desde", summary: "Resumo",
    photo: "Foto", description: "O que a foto mostra", caption: "Mensagem", channel: "Enviada por",
    messageFor: "Para", caller: "Quem ligou", whatsapp: "WhatsApp",
  },
  photoMissing: "Abra o Lead Awaker para ver a foto.",
  photoAttached: "A foto em tamanho original está anexada a este e-mail.",
  photoBundle: {
    subject: (name, n) => `${n} novas fotos de ${name}`,
    heading: "Novas fotos",
    intro: (a, n) => `Um cliente enviou ${n} fotos para ${a} no chat.`,
    attached: "As fotos em tamanho original estão anexadas a este e-mail.",
    more: (n) => (n === 1 ? "Mais 1 foto está no Lead Awaker." : `Mais ${n} fotos estão no Lead Awaker.`),
  },
  message: {
    subject: (n, to) => (to ? `Recado para ${to} de ${n}` : `Novo recado de ${n}`),
    heading: (to) => (to ? `Recado para ${to}` : "Novo recado"),
    intro: (a, to) => `Alguém ligou para ${a} e deixou um recado para ${to || "a sua equipe"}.`,
    label: "O recado",
    by: (w) => `De ${w}`,
    note: (to) => (to
      ? `Repasse o recado para ${to} ou retorne a ligação no número acima.`
      : "Retorne a ligação no número acima ou abra a ligação para ver a conversa completa."),
    cta: "Abrir a ligação",
  },
  subject: {
    daily_recap: (a, d) => `Resumo do dia de ${a}, ${d}`,
    appointment_booked: (n, t) => `Novo agendamento: ${n}, ${t}`,
    appointment_rescheduled: (n, t) => `Agendamento remarcado: ${n}, agora ${t}`,
    appointment_cancelled: (n, t) => `Agendamento cancelado: ${n}, ${t}`,
    callback_requested: (n, _t, p) => `Retornar ligação: ${n} (${p})`,
    lead_needs_reply: (n) => `Resposta necessária: ${n}`,
    new_photo: (n) => `Nova foto de ${n}`,
  },
  heading: {
    daily_recap: "Resumo do dia", appointment_booked: "Novo agendamento", appointment_rescheduled: "Agendamento remarcado",
    appointment_cancelled: "Agendamento cancelado", callback_requested: "Pedido de retorno", lead_needs_reply: "Resposta necessária",
    new_photo: "Nova foto",
  },
  intro: {
    appointment_booked: (a) => `Um novo horário foi agendado para ${a}.`,
    appointment_rescheduled: (a) => `Um agendamento de ${a} foi remarcado para um novo horário.`,
    appointment_cancelled: (a) => `Um agendamento de ${a} foi cancelado pelo cliente.`,
    callback_requested: (a) => `Uma pessoa que ligou para ${a} pediu um retorno. Retorne a ligação assim que puder.`,
    lead_needs_reply: (a) => `Uma conversa de ${a} precisa de uma resposta da sua equipe. A assistente pausou esta conversa até alguém responder.`,
    new_photo: (a) => `Um cliente enviou uma foto para ${a} no chat.`,
  },
  notes: { lead_needs_reply: "A assistente pausou esta conversa até alguém responder." },
  recap: {
    intro: (a) => `Aqui está o resumo de hoje de ${a}.`,
    calls: "Ligações", conversations: "Conversas", newContacts: "Novos contatos",
    newAppointments: "Novos agendamentos", waiting: "Aguardando sua equipe",
    sectionAppointments: "Agendamentos", sectionWaiting: "Aguardando sua equipe",
    sectionCalls: "Ligações", sectionTomorrow: "Amanhã",
    kind: { booked: "agendado", rescheduled: "remarcado", cancelled: "cancelado" },
    waitingKind: { callback: "retornar ligação", reply: "responder no chat" },
    callsToday: (n) => `${n} hoje`,
    allCalls: (n) => `Ver todas as ${n} ligações`,
    openCall: "Abrir",
    openChat: "Abrir conversa",
    unknownCaller: "número desconhecido",
    subheading: "As novidades mais importantes de hoje, de relance.",
    sectionToday: "Hoje em resumo",
    quiet: "Nenhum agendamento novo hoje e nada aguardando sua equipe.",
    sectionWeek: "Agenda da semana", weekSub: "Agendamentos de hoje até domingo",
    sectionNextWeek: "Agenda da próxima semana", nextWeekSub: "Agendamentos de segunda a domingo",
    weekEmpty: "Nenhum agendamento marcado ainda.",
    weekTitle: "A última semana",
    weekStats: {
      appointments: ["agendamento marcado", "agendamentos marcados"],
      calls: ["ligação atendida", "ligações atendidas"],
      conversations: ["conversa no chat", "conversas no chat"],
    },
  },
  someone: "Um cliente",
  via: (s) => `por ${s}`,
  pills: { new: "Novo", moved: "Remarcado" },
  cards: {
    booked: { title: "Agendamento", text: (n, at) => `${n} agendou um horário para ${at}.` },
    rescheduled: { title: "Agendamento remarcado", text: (n, at) => `${n} remarcou o horário para ${at}.` },
    cancelled: { title: "Agendamento cancelado", text: (n, at) => `${n} cancelou o horário de ${at}.` },
    callback: { title: "Pedido de retorno", text: (n) => `${n} pediu para receber uma ligação de volta.` },
    reply: { title: "Aguardando resposta", text: (n) => `${n} está aguardando uma resposta da sua equipe no chat.` },
    message: { title: "Recado", text: (n, to) => `${n} deixou um recado para ${to || "a sua equipe"}.` },
  },
};

export const EMAIL_COPY: Record<EmailLang, Copy> = { en: EN, nl: NL, pt: PT };
export const copyFor = (lang: string | null | undefined): Copy => EMAIL_COPY[(lang as EmailLang)] ?? EN;
