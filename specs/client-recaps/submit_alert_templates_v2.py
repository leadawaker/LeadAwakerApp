"""Short client-alert WhatsApp templates (v2) for Lead Awaker's own WABA.

New names (`la_*_v2`, plus the new `la_new_photo`), so the six v1 templates
approved on 2026-10-10 (specs/receptionist-channels/submit_templates_2026_10_10.py)
are never touched and keep working. The engine
(automations/src/automations/client_alerts/templates.py, build_v2) tries v2
first and falls back to v1 while Meta answers 132001 (not approved in that
language), so nothing needs switching after approval.

Shape: an emoji headline in bold, a blank line, 1-3 short fact lines, a
fixed closing line (a body may not end with a variable), the URL button.
No TEXT header (Meta allows no emoji there) and no footer. `la_new_photo` is
text only: the send path has no media upload, so no image header.

    python3 specs/client-recaps/submit_alert_templates_v2.py            # check only, prints the bodies
    WHATSAPP_BUSINESS_ACCOUNT_ID=... WHATSAPP_ACCESS_TOKEN=... \\
    python3 specs/client-recaps/submit_alert_templates_v2.py --submit   # submit to Meta
"""
import json, os, re, sys, urllib.error, urllib.request

LANGS = ("en", "nl", "pt_BR")
BTN = {"en": "Open in Lead Awaker", "nl": "Openen in Lead Awaker", "pt_BR": "Abrir no Lead Awaker"}
TAP = {
    "en": "Tap the button below for the details.",
    "nl": "Tik op de knop hieronder voor de details.",
    "pt_BR": "Toque no botão abaixo para ver os detalhes.",
}

TEMPLATES = {
    "la_daily_recap_v2": {
        "samples": {"en": ["Robben Rosmalen", "7", "4", "2", "1"]},
        "body": {
            "en": "📊 *Daily recap for {{1}}*\n\nCalls: {{2}}, chats: {{3}}\nNew appointments: {{4}}\nWaiting on your team: {{5}}\n\nAll details are in Lead Awaker.",
            "nl": "📊 *Dagoverzicht {{1}}*\n\nTelefoontjes: {{2}}, chats: {{3}}\nNieuwe afspraken: {{4}}\nWacht op jullie team: {{5}}\n\nAlle details staan in Lead Awaker.",
            "pt_BR": "📊 *Resumo do dia de {{1}}*\n\nLigações: {{2}}, conversas: {{3}}\nNovos agendamentos: {{4}}\nAguardando sua equipe: {{5}}\n\nTodos os detalhes estão no Lead Awaker.",
        },
    },
    "la_appointment_booked_v2": {
        "samples": {"en": ["Jan de V.", "Thu 16 Oct 14:30", "phone call"],
                    "nl": ["Jan de V.", "do 16 okt 14:30", "telefoon"],
                    "pt_BR": ["Jan de V.", "qui 16 out 14:30", "ligação"]},
        "body": {
            "en": "📅 *New appointment*\n\n{{1}} booked an appointment for {{2}} via {{3}}.\n\n" + TAP["en"],
            "nl": "📅 *Nieuwe afspraak*\n\n{{1}} heeft een afspraak voor {{2}}, geboekt via {{3}}.\n\n" + TAP["nl"],
            "pt_BR": "📅 *Novo agendamento*\n\n{{1}} agendou um horário para {{2}} por {{3}}.\n\n" + TAP["pt_BR"],
        },
    },
    "la_appointment_rescheduled_v2": {
        "samples": {"en": ["Jan de V.", "Fri 17 Oct 10:00"], "nl": ["Jan de V.", "vr 17 okt 10:00"],
                    "pt_BR": ["Jan de V.", "sex 17 out 10:00"]},
        "body": {
            "en": "🔁 *Appointment moved*\n\n{{1}} moved their appointment to {{2}}.\n\n" + TAP["en"],
            "nl": "🔁 *Afspraak verzet*\n\n{{1}} heeft de afspraak verzet naar {{2}}.\n\n" + TAP["nl"],
            "pt_BR": "🔁 *Agendamento remarcado*\n\n{{1}} remarcou o horário para {{2}}.\n\n" + TAP["pt_BR"],
        },
    },
    "la_appointment_cancelled_v2": {
        "samples": {"en": ["Jan de V.", "Thu 16 Oct 14:30"], "nl": ["Jan de V.", "do 16 okt 14:30"],
                    "pt_BR": ["Jan de V.", "qui 16 out 14:30"]},
        "body": {
            "en": "❌ *Appointment cancelled*\n\n{{1}} cancelled their appointment of {{2}}.\n\n" + TAP["en"],
            "nl": "❌ *Afspraak geannuleerd*\n\n{{1}} heeft de afspraak van {{2}} geannuleerd.\n\n" + TAP["nl"],
            "pt_BR": "❌ *Agendamento cancelado*\n\n{{1}} cancelou o horário de {{2}}.\n\n" + TAP["pt_BR"],
        },
    },
    "la_callback_requested_v2": {
        "samples": {"en": ["Jan de Vries", "+31 6 1234 5678", "test drive Audi A4 on Saturday"],
                    "nl": ["Jan de Vries", "+31 6 1234 5678", "proefrit Audi A4 zaterdag"],
                    "pt_BR": ["Jan de Vries", "+55 11 91234 5678", "test drive no sábado"]},
        "body": {
            "en": "📞 *Please call back*\n\nName: {{1}}\nPhone: {{2}}\nAbout: {{3}}\n\n" + TAP["en"],
            "nl": "📞 *Graag terugbellen*\n\nNaam: {{1}}\nTelefoon: {{2}}\nOnderwerp: {{3}}\n\n" + TAP["nl"],
            "pt_BR": "📞 *Retornar ligação*\n\nNome: {{1}}\nTelefone: {{2}}\nAssunto: {{3}}\n\n" + TAP["pt_BR"],
        },
    },
    "la_lead_needs_reply_v2": {
        "samples": {"en": ["Jan de V.", "asked to speak to a person"],
                    "nl": ["Jan de V.", "vroeg om een medewerker"],
                    "pt_BR": ["Jan de V.", "pediu para falar com uma pessoa"]},
        "body": {
            "en": "💬 *Reply needed*\n\n{{1}} is waiting for your team.\nReason: {{2}}\n\nThe assistant paused this chat. Tap the button below to answer.",
            "nl": "💬 *Reactie nodig*\n\n{{1}} wacht op jullie team.\nReden: {{2}}\n\nDe assistent heeft de chat gepauzeerd. Tik op de knop hieronder om te antwoorden.",
            "pt_BR": "💬 *Resposta necessária*\n\n{{1}} está aguardando sua equipe.\nMotivo: {{2}}\n\nA assistente pausou a conversa. Toque no botão abaixo para responder.",
        },
    },
    "la_new_photo": {
        "samples": {"en": ["Jan de V.", "2 photos", "A grey Volkswagen Golf with a scratch on the right front door."],
                    "nl": ["Jan de V.", "2 foto's", "Een grijze Volkswagen Golf met een kras op de rechter voordeur."],
                    "pt_BR": ["Jan de V.", "2 fotos", "Um Volkswagen Golf cinza com um risco na porta dianteira direita."]},
        "body": {
            "en": "📷 *New photo*\n\n{{1}} sent {{2}}.\nIn the photo: {{3}}\n\nTap the button below to see it.",
            "nl": "📷 *Nieuwe foto*\n\n{{1}} heeft {{2}} gestuurd.\nOp de foto: {{3}}\n\nTik op de knop hieronder om te kijken.",
            "pt_BR": "📷 *Nova foto*\n\n{{1}} enviou {{2}}.\nNa foto: {{3}}\n\nToque no botão abaixo para ver.",
        },
    },
}


def check(name: str, lang: str, body: str, samples: list[str]) -> None:
    """Meta's body rules we can check locally."""
    nums = [int(n) for n in re.findall(r"\{\{(\d+)\}\}", body)]
    assert nums == list(range(1, len(nums) + 1)), (name, lang, "variables out of order", nums)
    assert len(nums) == len(samples), (name, lang, "samples", len(nums), len(samples))
    assert not re.match(r"^\s*\{\{", body) and not re.search(r"\}\}\s*[.!?]?\s*$", body), (name, lang, "variable at start/end")
    assert "\t" not in body and "\n\n\n\n" not in body, (name, lang, "tab or 4+ newlines")
    assert not re.search(r"\}\}\s*\{\{", body), (name, lang, "adjacent variables")
    assert len(body) <= 1024, (name, lang, "too long")
    assert "—" not in body, (name, lang, "em dash")


def payload(name: str, lang: str) -> dict:
    t = TEMPLATES[name]
    body = t["body"][lang]
    samples = t["samples"].get(lang) or t["samples"]["en"]
    check(name, lang, body, samples)
    return {"name": name, "language": lang, "category": "UTILITY", "components": [
        {"type": "BODY", "text": body, "example": {"body_text": [samples]}},
        {"type": "BUTTONS", "buttons": [{
            "type": "URL", "text": BTN[lang], "url": "https://app.leadawaker.com/go/{{1}}",
            "example": ["https://app.leadawaker.com/go/k7Q2mX9a"]}]},
    ]}


def submit(p: dict) -> str:
    waba, token = os.environ["WHATSAPP_BUSINESS_ACCOUNT_ID"], os.environ["WHATSAPP_ACCESS_TOKEN"]
    req = urllib.request.Request(f"https://graph.facebook.com/v21.0/{waba}/message_templates",
                                 data=json.dumps(p).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            d = json.load(r)
            return f"{d.get('status')} {d.get('category')} id={d.get('id')}"
    except urllib.error.HTTPError as e:
        err = json.load(e).get("error", {})
        return f"ERROR {err.get('code')} {err.get('error_user_msg') or err.get('message')}"


if __name__ == "__main__":
    jobs = [payload(n, lang) for n in TEMPLATES for lang in LANGS]
    if "--submit" not in sys.argv:
        for p in jobs:
            print(f"--- {p['name']} [{p['language']}]\n{p['components'][0]['text']}\n")
        print(len(jobs), "payloads OK (not submitted; pass --submit)")
        sys.exit()
    for p in jobs:
        print(p["name"], p["language"], "->", submit(p))
