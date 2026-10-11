"""Submit WhatsApp templates to the Lead Awaker WABA via the Graph API.

la_* = client alert templates from specs/client-recaps/requirements.md (nl, en, pt_BR).
reception_* = customer-facing receptionist templates (en, nl), submitted here as an
approval check only; they will later be submitted to each client's own WABA.
"""
import json, os, re, sys, urllib.request, urllib.error

WABA = os.environ["WHATSAPP_BUSINESS_ACCOUNT_ID"]
TOKEN = os.environ["WHATSAPP_ACCESS_TOKEN"]
URL = f"https://graph.facebook.com/v21.0/{WABA}/message_templates"
BTN = {"en": "Open in Lead Awaker", "nl": "Openen in Lead Awaker", "pt_BR": "Abrir no Lead Awaker"}

LA = {
    "la_daily_recap": {
        "header": {"en": "Daily recap", "nl": "Dagoverzicht", "pt_BR": "Resumo do dia"},
        "samples": ["Thijs", "Robben Rosmalen", "7", "4", "2", "1"],
        "body": {
            "en": "Hi {{1}}, here is today's update for {{2}}. Calls answered: {{3}}. Conversations handled: {{4}}. New appointments: {{5}}. Waiting on your team: {{6}}. Names, times and all details are in Lead Awaker.",
            "nl": "Hoi {{1}}, hier is de update van vandaag voor {{2}}. Telefoontjes beantwoord: {{3}}. Chats afgehandeld: {{4}}. Nieuwe afspraken: {{5}}. Wacht op jullie team: {{6}}. Namen, tijden en alle details staan in Lead Awaker.",
            "pt_BR": "Olá {{1}}, aqui está o resumo de hoje de {{2}}. Ligações atendidas: {{3}}. Conversas atendidas: {{4}}. Novos agendamentos: {{5}}. Aguardando sua equipe: {{6}}. Nomes, horários e todos os detalhes estão no Lead Awaker.",
        },
    },
    "la_appointment_booked": {
        "header": {"en": "New appointment", "nl": "Nieuwe afspraak", "pt_BR": "Novo agendamento"},
        "samples": ["Thijs", "Robben Rosmalen", "Jan de V.", "do 16 okt 14:30", "telefoon"],
        "body": {
            "en": "Hi {{1}}, a new appointment was booked for {{2}}. Customer: {{3}}. Date and time: {{4}}. Booked through: {{5}}. Tap the button below to see the booking.",
            "nl": "Hoi {{1}}, er is een nieuwe afspraak ingepland voor {{2}}. Klant: {{3}}. Datum en tijd: {{4}}. Geboekt via: {{5}}. Tik op de knop hieronder om de afspraak te bekijken.",
            "pt_BR": "Olá {{1}}, um novo horário foi agendado para {{2}}. Cliente: {{3}}. Data e hora: {{4}}. Agendado por: {{5}}. Toque no botão abaixo para ver o agendamento.",
        },
    },
    "la_appointment_rescheduled": {
        "header": {"en": "Appointment moved", "nl": "Afspraak verzet", "pt_BR": "Agendamento remarcado"},
        "samples": ["Thijs", "Robben Rosmalen", "Jan de V.", "vr 17 okt 10:00"],
        "body": {
            "en": "Hi {{1}}, an appointment for {{2}} was moved to a new time. Customer: {{3}}. New date and time: {{4}}. Tap the button below to see the updated booking.",
            "nl": "Hoi {{1}}, een afspraak voor {{2}} is verzet naar een nieuw moment. Klant: {{3}}. Nieuwe datum en tijd: {{4}}. Tik op de knop hieronder om de gewijzigde afspraak te bekijken.",
            "pt_BR": "Olá {{1}}, um agendamento de {{2}} foi remarcado para um novo horário. Cliente: {{3}}. Nova data e hora: {{4}}. Toque no botão abaixo para ver o agendamento atualizado.",
        },
    },
    "la_appointment_cancelled": {
        "header": {"en": "Appointment cancelled", "nl": "Afspraak geannuleerd", "pt_BR": "Agendamento cancelado"},
        "samples": ["Thijs", "Robben Rosmalen", "Jan de V.", "do 16 okt 14:30"],
        "body": {
            "en": "Hi {{1}}, an appointment for {{2}} was cancelled by the customer. Customer: {{3}}. It was planned for {{4}}. Tap the button below to see the conversation.",
            "nl": "Hoi {{1}}, een afspraak voor {{2}} is door de klant geannuleerd. Klant: {{3}}. De afspraak stond gepland op {{4}}. Tik op de knop hieronder om het gesprek te bekijken.",
            "pt_BR": "Olá {{1}}, um agendamento de {{2}} foi cancelado pelo cliente. Cliente: {{3}}. Estava marcado para {{4}}. Toque no botão abaixo para ver a conversa.",
        },
    },
    "la_callback_requested": {
        "header": {"en": "Callback request", "nl": "Terugbelverzoek", "pt_BR": "Pedido de retorno"},
        "samples": ["Thijs", "Robben Rosmalen", "Jan de Vries", "+31 6 1234 5678", "proefrit Audi A4 zaterdag"],
        "body": {
            "en": "Hi {{1}}, someone who called {{2}} would like a call back. Name: {{3}}. Phone: {{4}}. About: {{5}}. Please call them back as soon as you can.",
            "nl": "Hoi {{1}}, iemand die {{2}} belde wil graag teruggebeld worden. Naam: {{3}}. Telefoon: {{4}}. Onderwerp: {{5}}. Bel diegene zo snel mogelijk terug.",
            "pt_BR": "Olá {{1}}, uma pessoa que ligou para {{2}} pediu um retorno. Nome: {{3}}. Telefone: {{4}}. Assunto: {{5}}. Retorne a ligação assim que puder.",
        },
    },
    "la_lead_needs_reply": {
        "header": {"en": "Reply needed", "nl": "Reactie nodig", "pt_BR": "Resposta necessária"},
        "samples": ["Thijs", "Robben Rosmalen", "Jan de V.", "vroeg om een medewerker"],
        "body": {
            "en": "Hi {{1}}, a conversation for {{2}} needs a reply from your team. Customer: {{3}}. Reason: {{4}}. The assistant has paused this chat, so tap the button below to answer.",
            "nl": "Hoi {{1}}, een gesprek voor {{2}} heeft een reactie van jullie team nodig. Klant: {{3}}. Reden: {{4}}. De assistent heeft deze chat gepauzeerd, dus tik op de knop hieronder om te antwoorden.",
            "pt_BR": "Olá {{1}}, uma conversa de {{2}} precisa de uma resposta da sua equipe. Cliente: {{3}}. Motivo: {{4}}. A assistente pausou esta conversa, então toque no botão abaixo para responder.",
        },
    },
}

RECEPTION = {
    "reception_call_booked": {
        "samples": ["Mark", "Robben Rosmalen", "Thursday 16 October at 14:30"],
        "body": {
            "en": "Hi {{1}}, thanks for calling {{2}}. Your appointment is confirmed for {{3}}. Need to change it? Just reply to this message.",
            "nl": "Hoi {{1}}, bedankt voor je telefoontje met {{2}}. Je afspraak staat vast op {{3}}. Iets wijzigen? Stuur gewoon een bericht terug.",
        },
    },
    "reception_call_followup": {
        "samples": ["Mark", "Robben Rosmalen", "https://book.leadawaker.com/k7Q2mX9a"],
        "body": {
            "en": "Hi {{1}}, thanks for calling {{2}}. Here is the link to plan your appointment: {{3}} Any questions? Just reply to this message.",
            "nl": "Hoi {{1}}, bedankt voor je telefoontje met {{2}}. Hier is de link om je afspraak in te plannen: {{3}} Nog vragen? Stuur gewoon een bericht terug.",
        },
    },
    "reception_appointment_reminder": {
        "samples": ["Mark", "Robben Rosmalen", "Thursday 16 October at 14:30"],
        "body": {
            "en": "Hi {{1}}, a reminder of your appointment with {{2}} on {{3}}. Can't make it? Reply to this message and we will find another time.",
            "nl": "Hoi {{1}}, een herinnering aan je afspraak bij {{2}} op {{3}}. Lukt het niet? Stuur een bericht terug, dan zoeken we een ander moment.",
        },
    },
}
NL_SAMPLES = {"Thursday 16 October at 14:30": "donderdag 16 oktober om 14:30"}


def payload(name, lang, body, samples, header=None, la=False):
    n = len(re.findall(r"\{\{\d+\}\}", body))
    assert n == len(samples), (name, lang, n, len(samples))
    comps = []
    if header:
        comps.append({"type": "HEADER", "format": "TEXT", "text": header})
    comps.append({"type": "BODY", "text": body, "example": {"body_text": [samples]}})
    if la:
        comps.append({"type": "FOOTER", "text": "Lead Awaker"})
        comps.append({"type": "BUTTONS", "buttons": [{
            "type": "URL", "text": BTN[lang], "url": "https://app.leadawaker.com/go/{{1}}",
            "example": ["https://app.leadawaker.com/go/k7Q2mX9a"]}]})
    return {"name": name, "language": lang, "category": "UTILITY", "components": comps}


def submit(p):
    req = urllib.request.Request(URL, data=json.dumps(p).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            d = json.load(r)
            return f"{d.get('status')} {d.get('category')} id={d.get('id')}"
    except urllib.error.HTTPError as e:
        err = json.load(e).get("error", {})
        return f"ERROR {err.get('code')} {err.get('error_user_msg') or err.get('message')}"


jobs = []
for name, t in LA.items():
    for lang in ("en", "nl", "pt_BR"):
        jobs.append(payload(name, lang, t["body"][lang], t["samples"], t["header"][lang], la=True))
for name, t in RECEPTION.items():
    for lang in ("en", "nl"):
        s = [NL_SAMPLES.get(x, x) for x in t["samples"]] if lang == "nl" else t["samples"]
        jobs.append(payload(name, lang, t["body"][lang], s))

if "--dry" in sys.argv:
    print(len(jobs), "payloads OK"); sys.exit()
for p in jobs:
    print(p["name"], p["language"], "->", submit(p))
