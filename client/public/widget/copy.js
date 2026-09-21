// Widget chrome copy. Separate from the demo page's copy.js on purpose: that
// file talks to a prospect being shown a demo ("Reply as if you were the
// lead..."), which is exactly wrong on a client's own website.
// Portuguese is Brazilian, matching the rest of the product.
var COPY = {
  en: {
    assistant: "Assistant",
    placeholder: "Type your message...",
    ended: "This conversation has ended.",
    role: "AI assistant",
    startFailed: "This chat could not start.",
    close: "Close chat",
    send: "Send",
    restart: "Restart chat",
    restartAsk: "Start a new conversation? This one stays in our records.",
    restartYes: "Restart",
    cancel: "Cancel",
  },
  nl: {
    assistant: "Assistent",
    placeholder: "Typ je bericht...",
    ended: "Dit gesprek is afgerond.",
    role: "AI-assistent",
    startFailed: "Deze chat kon niet starten.",
    close: "Chat sluiten",
    send: "Versturen",
    restart: "Chat opnieuw starten",
    restartAsk: "Een nieuw gesprek beginnen? Dit gesprek blijft bewaard.",
    restartYes: "Opnieuw starten",
    cancel: "Annuleren",
  },
  pt: {
    assistant: "Assistente",
    placeholder: "Digite sua mensagem...",
    ended: "Esta conversa foi encerrada.",
    role: "Assistente de IA",
    startFailed: "Não foi possível iniciar o chat.",
    close: "Fechar chat",
    send: "Enviar",
    restart: "Reiniciar conversa",
    restartAsk: "Começar uma nova conversa? Esta fica salva no histórico.",
    restartYes: "Reiniciar",
    cancel: "Cancelar",
  },
};

var lang = "en";

export function setWidgetLang(l) {
  var short = String(l || "").slice(0, 2).toLowerCase();
  lang = COPY[short] ? short : "en";
}

export function w(key) {
  return (COPY[lang] && COPY[lang][key]) || COPY.en[key] || key;
}
