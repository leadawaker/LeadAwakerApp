// Part of the browser demo page. Split out of demo.html (which had grown
// past 1600 lines) so each concern can be read, and tested, on its own.
// Plain ES modules, same-origin: the page still ships no bundler and no
// third-party script.

// ---- copy -------------------------------------------------------------
// Everything the PAGE says on its own, in the demo's language. The
// conversation, the recap body, the brief labels and the restart options
// are all already written in that language by the engine. This is the
// chrome around them, which was English no matter who was reading it.
// Portuguese is Brazilian throughout, matching the rest of the product.
var COPY = {
  en: {
    stage_new: "New lead", stage_responded: "Responded",
    stage_qualified: "Qualified", stage_objective: "Objective reached",
    stage_dnc: "Do not disturb",
    loading: "Loading...",
    replyLabel: "Your reply",
    replyPlaceholder: "Reply as if you were the lead...",
    sendLabel: "Send",
    restart: "Restart",
    restartAria: "Restart this demo",
    onPhone: "On your phone?", runInWa: "Run it in WhatsApp instead",
    restartsLeftOne: "1 restart left.", restartsLeftMany: "{n} restarts left.",
    noRestarts: "No restarts left.",
    restartLimit: "This link has been restarted the maximum number of times.",
    capped: "This demo has reached its message limit. Restart it to run it again.",
    wrapping: "Wrapping up", wrappingSub: "Reading back the conversation...",
    recapTitle: "What just happened",
    recapSub: "This is what lands in the CRM, automatically.",
    conversation: "Conversation", theBrief: "The brief",
    briefNote: "Every line came from the conversation. Nothing here was assumed.",
    briefEmpty: "The conversation ended before a full brief was collected. Restart it and answer a few more questions to see the whole thing.",
    theQuote: "The quote",
    quoteNote: "The quote already on file. The AI worked from these figures, and never invented one.",
    bumpTitle: "Send a follow-up now",
    voiceRecord: "Record a voice memo",
    voiceNote: "Voice note",
    voiceSendMemo: "Send voice memo",
    voiceDiscard: "Discard recording",
    voiceRecording: "Recording",
    voicePlay: "Play", voicePause: "Pause",
    voiceTranscribing: "Transcribing",
    voiceNoTranscript: "Transcription unavailable",
    errExpiredTitle: "This link is not valid",
    errExpiredBody: "It may have expired. Ask for a fresh one and it will work again.",
    errGenericTitle: "Something went wrong",
    errGenericBody: "Reload the page and it should pick up where it left off.",
    errNoLinkTitle: "No demo link",
    errNoLinkBody: "This page needs a demo link. Ask for one and open it directly."
  },
  nl: {
    stage_new: "Nieuwe lead", stage_responded: "Gereageerd",
    stage_qualified: "Gekwalificeerd", stage_objective: "Doel bereikt",
    stage_dnc: "Niet storen",
    loading: "Laden...",
    replyLabel: "Jouw antwoord",
    replyPlaceholder: "Antwoord alsof je de lead bent...",
    sendLabel: "Versturen",
    restart: "Opnieuw",
    restartAria: "Start deze demo opnieuw",
    onPhone: "Op je telefoon?", runInWa: "Doe hem in WhatsApp",
    restartsLeftOne: "Nog 1 herstart over.", restartsLeftMany: "Nog {n} herstarts over.",
    noRestarts: "Geen herstarts meer.",
    restartLimit: "Deze link is het maximale aantal keren opnieuw gestart.",
    capped: "Deze demo heeft zijn berichtenlimiet bereikt. Start opnieuw om hem nog een keer te draaien.",
    wrapping: "Afronden", wrappingSub: "Het gesprek wordt teruggelezen...",
    recapTitle: "Wat er net gebeurde",
    recapSub: "Dit is wat automatisch in het CRM belandt.",
    conversation: "Gesprek", theBrief: "De briefing",
    briefNote: "Elke regel komt uit het gesprek. Niets hiervan is aangenomen.",
    briefEmpty: "Het gesprek eindigde voordat er een volledige briefing was verzameld. Start opnieuw en beantwoord een paar vragen meer om het geheel te zien.",
    theQuote: "De offerte",
    quoteNote: "De offerte die al in het dossier zat. De AI werkte met deze bedragen en verzon er nooit een.",
    bumpTitle: "Stuur nu een follow-up",
    voiceRecord: "Neem een spraakbericht op",
    voiceNote: "Spraakbericht",
    voiceSendMemo: "Spraakbericht versturen",
    voiceDiscard: "Opname weggooien",
    voiceRecording: "Aan het opnemen",
    voicePlay: "Afspelen", voicePause: "Pauzeren",
    voiceTranscribing: "Bezig met uitschrijven",
    voiceNoTranscript: "Transcriptie niet beschikbaar",
    errExpiredTitle: "Deze link is niet geldig",
    errExpiredBody: "Hij is mogelijk verlopen. Vraag een nieuwe aan en het werkt weer.",
    errGenericTitle: "Er ging iets mis",
    errGenericBody: "Laad de pagina opnieuw, dan gaat hij verder waar hij gebleven was.",
    errNoLinkTitle: "Geen demolink",
    errNoLinkBody: "Deze pagina heeft een demolink nodig. Vraag er een aan en open die rechtstreeks."
  },
  pt: {
    stage_new: "Novo lead", stage_responded: "Respondeu",
    stage_qualified: "Qualificado", stage_objective: "Objetivo alcançado",
    stage_dnc: "Não perturbe",
    loading: "Carregando...",
    replyLabel: "Sua resposta",
    replyPlaceholder: "Responda como se você fosse o lead...",
    sendLabel: "Enviar",
    restart: "Reiniciar",
    restartAria: "Reiniciar esta demonstração",
    onPhone: "No celular?", runInWa: "Faça pelo WhatsApp",
    restartsLeftOne: "Resta 1 reinício.", restartsLeftMany: "Restam {n} reinícios.",
    noRestarts: "Sem reinícios restantes.",
    restartLimit: "Este link já foi reiniciado o número máximo de vezes.",
    capped: "Esta demonstração atingiu o limite de mensagens. Reinicie para rodar de novo.",
    wrapping: "Finalizando", wrappingSub: "Relendo a conversa...",
    recapTitle: "O que acabou de acontecer",
    recapSub: "É isto que entra no CRM, automaticamente.",
    conversation: "Conversa", theBrief: "O briefing",
    briefNote: "Cada linha veio da conversa. Nada aqui foi suposto.",
    briefEmpty: "A conversa terminou antes de um briefing completo ser coletado. Reinicie e responda mais algumas perguntas para ver tudo.",
    theQuote: "O orçamento",
    quoteNote: "O orçamento que já estava no sistema. A IA trabalhou com estes valores e nunca inventou nenhum.",
    bumpTitle: "Enviar um follow-up agora",
    voiceRecord: "Gravar um áudio",
    voiceNote: "Áudio",
    voiceSendMemo: "Enviar áudio",
    voiceDiscard: "Descartar a gravação",
    voiceRecording: "Gravando",
    voicePlay: "Reproduzir", voicePause: "Pausar",
    voiceTranscribing: "Transcrevendo",
    voiceNoTranscript: "Transcrição indisponível",
    errExpiredTitle: "Este link não é válido",
    errExpiredBody: "Talvez tenha expirado. Peça um novo e ele volta a funcionar.",
    errGenericTitle: "Algo deu errado",
    errGenericBody: "Recarregue a página que ela retoma de onde parou.",
    errNoLinkTitle: "Sem link de demonstração",
    errNoLinkBody: "Esta página precisa de um link de demonstração. Peça um e abra-o diretamente."
  }
};

// The demo's language comes from the lead, which means the three page-level
// failures below have none: two of them fire when there is no state to read
// it from (a dead token, a missing token) and one when the request that
// would have carried it just failed. Falling back to the BROWSER's language
// is the closest thing to the reader's own available at that point: better
// than English-for-everyone, and it costs nothing when state does exist.
export function browserLang() {
  var list = (navigator.languages && navigator.languages.length)
    ? navigator.languages
    : [navigator.language || "en"];
  for (var i = 0; i < list.length; i++) {
    // Prefix match, so "nl-BE", "pt-BR" and "en-GB" all land correctly.
    var tag = String(list[i] || "").toLowerCase();
    if (tag.indexOf("nl") === 0) return "nl";
    if (tag.indexOf("pt") === 0) return "pt";
    if (tag.indexOf("en") === 0) return "en";
  }
  return "en";
}

// The language everything renders in. Owned here and set from each state
// payload, so no other module has to thread a language through every call.
// Null until the first payload lands, and forever on a page that never gets
// one, which is exactly when browserLang() should answer instead.
var currentLang = null;

export function setLang(lang) {
  currentLang = lang || null;
}

// The resolved language tag. Intl needs the tag, the strings need the pack, and
// both come from here so the two can never disagree about which language this
// is (a page rendering Dutch month names under English labels).
export function uiLang() {
  var l = String(currentLang || browserLang()).toLowerCase();
  return COPY[l] ? l : "en";
}

function copyPack() {
  return COPY[uiLang()];
}
// Falls back through the English pack rather than printing a key, so a
// string added to en/ and not yet to nl/pt degrades to English.
export function t(key) {
  var v = copyPack()[key];
  return v == null ? (COPY.en[key] == null ? "" : COPY.en[key]) : v;
}

// The labelled summary's sections. The engine writes the LABELS in English
// on purpose (the CRM's AiSummaryView matches on them to pick its own icon
// and title), so the page translates them here at render time instead of
// asking the model for localized labels and breaking that contract.
