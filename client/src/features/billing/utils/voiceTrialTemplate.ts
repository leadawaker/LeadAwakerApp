// ── Voice AI partnership trial ────────────────────────────────────────────────
// The trial agreement and processing agreement first signed with Robben Rosmalen
// (docs/clients/robben-rosmalen), made general. The processing agreement is an
// annex, so one signature covers both.

import type { ContractFormFields } from "./contractTemplate";

export interface VoiceTrialFields {
  legalName: string;
  kvkNumber: string;
  address: string;
  website: string;
  monthlyEstimate: string;
  monthlyCap: string;
}

function fmtDate(iso: string): string {
  if (!iso) return "[date]";
  return new Date(iso).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
}

export function generateVoiceTrialText(f: ContractFormFields, v: VoiceTrialFields): string {
  const client = f.accountName || "[client]";
  const legal = v.legalName || client;
  const contact = f.signerName || "[contact person]";
  const kvk = v.kvkNumber || "[KvK number]";
  const address = v.address || "[address]";
  const website = v.website || "[website]";
  const estimate = v.monthlyEstimate || "[amount]";
  const cap = v.monthlyCap || "[amount]";

  return `PARTNERSHIP TRIAL AGREEMENT

Lead Awaker and ${client} are starting a trial together. This document puts on paper what we agreed, so we both know what to expect. It is meant to be simple and fair to both sides.

WHO

- Lead Awaker, Gabriel Barbosa Fronza ("Gabriel"), trading as Lead Awaker, KvK 99366738, Christiaan Huygensweg 32, 's-Hertogenbosch ("Lead Awaker")
- ${legal}, represented by ${contact}, KvK ${kvk}, ${address} ("${client}")

WHAT WE ARE TRYING

Lead Awaker sets up an AI voice assistant that answers ${client}'s phone calls. The assistant:

- answers questions about ${client}'s products, services, opening hours and address, using the information ${client} provides
- books appointments in ${client}'s calendar, and lets callers move or cancel them
- takes down the caller's name, number and question when it cannot help
- passes serious customers on to ${contact} (by transferring the call or sending a message)

The same assistant can also answer WhatsApp messages and chat with visitors through a chat window on ${website}, with the same knowledge.

The goal of the trial is simple: find out together whether this saves ${contact} time and brings in more business.

HOW LONG

The trial runs from ${fmtDate(f.startDate)} to ${fmtDate(f.endDate)}.

WHAT IT COSTS

- Lead Awaker's work is free during the trial. Setup, building and adjustments cost nothing.
- ${client} pays only the running costs, at cost price with no markup: the phone number, call minutes, SMS and AI usage.
- WhatsApp message fees are billed by Meta directly to ${client}'s WhatsApp account. If Meta bills them to Lead Awaker instead, they go on the monthly invoice at cost.
- Lead Awaker sends one invoice per month with a clear overview of these costs.
- We expect these costs to be around EUR ${estimate} per month (excluding VAT). If they look likely to go above EUR ${cap} in a month, Lead Awaker asks first, before spending more.

WHAT EACH OF US DOES

Lead Awaker:
- builds, sets up and maintains the assistant
- reviews calls together with ${contact} in the first weeks and improves the assistant based on that
- responds to problems within one working day

${client}:
- sets up call forwarding to the assistant's number (Lead Awaker helps with this)
- shares the information the assistant needs (prices, rules, when to pass on a call)
- gives honest feedback, good and bad, so we can make it better

GOOD TO KNOW

- The assistant can make mistakes. Prices and availability it mentions are information, not a binding offer. The final deal is always made by ${client}.
- Callers are told they are speaking with an AI assistant and that the call may be recorded.
- The data is ${client}'s. Call recordings, transcripts and caller details are only used to run the assistant. They are not shared with anyone else and are deleted within 30 days when the trial ends without a follow-up, unless ${client} asks for an export first. The processing agreement (verwerkersovereenkomst) in the annex below covers this.
- The phone number is ${client}'s. It is registered in ${client}'s name. When the trial ends, ${client} can take it over (Lead Awaker helps move it) or Lead Awaker cancels it.
- Showing the results. Lead Awaker may only use ${client}'s name or results (for example as a case study) with ${contact}'s permission.

STOPPING EARLY

Either of us can stop the trial at any time, without a reason, by letting the other know in writing (an email or WhatsApp is fine) 14 days in advance. ${client} then only pays the running costs up to that point. Lead Awaker switches the assistant off and helps undo the call forwarding.

AFTER THE TRIAL

At the end of the trial we sit down together and look at the results. Then:

- If we both want to continue, we agree on a price together and put it in a new agreement. As one of the first partners, ${client} gets a founder partner rate, lower than the regular price.
- If either of us does not want to continue, the trial simply ends. Nothing continues automatically, and no costs follow.

LIABILITY

We both act in good faith. If something goes wrong, we first try to solve it together. Lead Awaker is not liable for indirect damage such as lost sales. Any liability of Lead Awaker is limited to the amounts ${client} paid under this agreement, except in case of intent or gross negligence.

Dutch law applies to this agreement.

SIGNING

Lead Awaker agrees to this agreement and its annex by sending them. ${client} agrees by signing. Signed by ${contact} on behalf of ${legal}.

${"─".repeat(60)}
ANNEX: PROCESSING AGREEMENT (VERWERKERSOVEREENKOMST)
${"─".repeat(60)}

This annex belongs to the Partnership Trial Agreement between Lead Awaker and ${client}. Under the trial, Lead Awaker handles personal data of ${client}'s customers. This annex sets out how, as the GDPR (AVG, Article 28) requires.

1. WHO

- ${legal}, represented by ${contact}, KvK ${kvk}, ${address}. The controller: ${client} decides why and how its customers' data is used.
- Lead Awaker, Gabriel Barbosa Fronza ("Gabriel"), trading as Lead Awaker, KvK 99366738, Christiaan Huygensweg 32, 's-Hertogenbosch. The processor: Lead Awaker handles the data only on ${client}'s behalf.

2. WHAT THE PROCESSING IS FOR

Lead Awaker runs an AI assistant for ${client} that:

- answers phone calls;
- answers WhatsApp messages and the chat window on ${website};
- answers questions about ${client}'s products, services and business;
- books appointments;
- takes messages, and passes callers on to ${client};
- sends callers a follow-up message after a call (WhatsApp, or SMS when the caller has no WhatsApp);
- sends ${client} a summary of each conversation.

Lead Awaker uses the data for nothing else. In particular, it does not use it to train AI models, sell it, or contact ${client}'s customers for its own purposes.

3. WHOSE DATA, AND WHICH DATA

Whose data:
- people who call ${client};
- people who send a WhatsApp message;
- people who use the website chat;
- ${client}'s own staff, as far as needed to pass calls on (name and phone number).

Which data:
- name, phone number and, when given, email address;
- recordings and written transcripts of phone calls;
- WhatsApp and chat messages, and photos or files a customer sends;
- what the customer is looking for and any other details they choose to share;
- appointments (date, time, what for);
- technical details of the conversation (time, duration, the number dialled).

The assistant does not ask for special categories of personal data (such as health or religion) or for BSN or bank details. If a customer shares these on their own initiative, Lead Awaker treats them with the same care and does not use them.

4. WHAT LEAD AWAKER PROMISES

Lead Awaker:

- processes the data only to carry out the trial, and on ${client}'s instructions. If an instruction would break the law, Lead Awaker says so;
- keeps the data confidential. Only Gabriel, and anyone who later works for Lead Awaker under a confidentiality obligation, has access;
- secures the data with appropriate measures (see section 6);
- helps ${client} when a customer wants to see, correct or delete their data, or objects. Lead Awaker passes on any such request it receives directly within 5 working days;
- helps ${client} with security questions, data breaches and, if one is needed, a privacy impact assessment (DPIA);
- gives ${client} the information needed to check that this agreement is kept, and cooperates with a reasonable check.

5. OTHER PARTIES (SUB-PROCESSORS)

To run the assistant, Lead Awaker uses these services. ${client} agrees to them.

- OpenAI Ireland Ltd.: the AI that speaks and writes the answers. EU (European data residency).
- Telnyx LLC and Telnyx Ireland Limited: phone numbers, call routing, SMS. EU: call records and recordings stored in Germany; some processing in the US (EU-US Data Privacy Framework and Standard Contractual Clauses).
- Meta Platforms Ireland Ltd.: sending and receiving WhatsApp messages. EU, with transfers to the US.
- Groq, Inc.: reading photos customers send, and short supporting AI tasks. US.
- Resend: emailing conversation summaries to ${client}. US.
- Cloudflare, Inc.: secure connection between the internet and Lead Awaker's server. Worldwide network.

Storage:
- The database, the CRM and the appointment calendar (Cal.diy) run on Lead Awaker's own server in the Netherlands.
- If ${client} connects its own calendar (for example Google Calendar), that calendar falls under ${client}'s own agreement with that provider.

Transfers outside the EU:
- For services outside the EU, Lead Awaker relies on the EU-US Data Privacy Framework or the European Standard Contractual Clauses.
- Lead Awaker has a signed processing agreement with each service, or has accepted its standard terms.

Changes to this list:
- Lead Awaker tells ${client} at least 14 days before adding or replacing a service.
- ${client} can object within that time.
- If we cannot agree, either of us can end the trial early as the trial agreement describes.

6. SECURITY

Lead Awaker protects the data with, among other things:

- encrypted connections (HTTPS and TLS) for all traffic, including calls between the phone network and the AI;
- personal logins for the CRM. ${client}'s login only shows ${client}'s data;
- access to the server only for Gabriel;
- regular updates of the server and software;
- telling callers at the start that they are speaking with a digital assistant.

7. DATA BREACHES

If Lead Awaker discovers a data breach that affects ${client}'s data, it tells ${client} without undue delay, and at the latest within 48 hours. It includes what happened, which data and how many people are affected, and what has been done about it.

This gives ${client} time to report to the Autoriteit Persoonsgegevens within the 72 hours the law allows, where that is needed. Lead Awaker does not report to the authority or inform customers itself, unless ${client} asks it to.

8. HOW LONG THE DATA IS KEPT

- During the trial: as long as needed to run the assistant and to review calls together.
- If the trial ends without a follow-up, Lead Awaker deletes all of ${client}'s personal data within 30 days, including at the sub-processors where Lead Awaker controls that. ${client} can first ask for an export (for example the list of leads and the call summaries). Lead Awaker confirms the deletion in writing.
- When the trial continues under a new agreement, these rules move over to that agreement.

9. LIABILITY AND DURATION

This annex runs as long as Lead Awaker processes data for ${client}. Liability follows the Partnership Trial Agreement. Dutch law applies.
`;
}
