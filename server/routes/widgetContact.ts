// Contact details from the website widget's form (specs/receptionist-channels,
// Phase 7). The form is shown when the AI asks who it is talking to; what the
// visitor fills in arrives on the normal message endpoint as an extra
// `contact` object and is handled here, so routes/widget.ts stays a proxy.
import { z } from "zod";
import { storage } from "../storage";
import { toE164, type PhoneCountry } from "@shared/phoneE164";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).optional().default(""),
  email: z.string().trim().max(160).optional().default(""),
});

export type WidgetContact = {
  /** As typed, tidied to one line. */
  name: string;
  /** As typed: this is what the visitor sees in their own bubble. */
  phoneTyped: string;
  /** E.164, or null when no phone was given. */
  phone: string | null;
  email: string | null;
};

export type ContactField = "name" | "phone" | "email" | "reach";

/** Which country a number without a prefix belongs to. NL unless the widget
 *  speaks Brazilian Portuguese. A number written with + is never guessed at. */
function regionFor(language: string | null | undefined): PhoneCountry {
  return String(language || "").toLowerCase().startsWith("pt") ? "BR" : "NL";
}

/**
 * Validate the form's payload. `field` names what the visitor has to fix, so
 * the widget can say so in its own language: the form's copy lives in the
 * widget, not here.
 */
export function parseWidgetContact(
  raw: unknown,
  language?: string | null,
): { ok: true; contact: WidgetContact } | { ok: false; field: ContactField } {
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    const first = String(parsed.error.issues[0]?.path[0] || "name");
    return { ok: false, field: first === "phone" || first === "email" ? first : "name" };
  }
  const name = parsed.data.name.replace(/\s+/g, " ");
  // A name has a letter in it, and no markup: it is echoed into a chat bubble
  // and into the CRM.
  if (!/\p{L}/u.test(name) || /[<>{}]/.test(name)) return { ok: false, field: "name" };

  const phoneTyped = parsed.data.phone;
  const emailTyped = parsed.data.email.toLowerCase();
  if (!phoneTyped && !emailTyped) return { ok: false, field: "reach" };

  let phone: string | null = null;
  if (phoneTyped) {
    phone = toE164(phoneTyped, regionFor(language));
    if (!phone) return { ok: false, field: "phone" };
  }
  let email: string | null = null;
  if (emailTyped) {
    if (!z.string().email().safeParse(emailTyped).success) return { ok: false, field: "email" };
    email = emailTyped;
  }
  return { ok: true, contact: { name, phoneTyped, phone, email } };
}

/** The visitor's turn as the AI and the CRM transcript read it:
 *  "Mark de Vries, 06 12345678". */
export function contactMessage(contact: WidgetContact): string {
  return [contact.name, contact.phoneTyped, contact.email].filter(Boolean).join(", ");
}

/**
 * Write the contact to the visitor's lead, never over a real value already
 * there (storage/leads.ts `fillLeadContact`). The name is split on the first
 * space. Returns false when the visitor has no lead yet (the engine creates it
 * on the first message).
 */
export async function saveWidgetContact(
  visitor: string,
  accountId: number,
  contact: WidgetContact,
): Promise<boolean> {
  const space = contact.name.indexOf(" ");
  return storage.fillLeadContact(`web:${visitor}`, accountId, {
    firstName: space === -1 ? contact.name : contact.name.slice(0, space),
    lastName: space === -1 ? "" : contact.name.slice(space + 1).trim(),
    phone: contact.phone,
    email: contact.email,
  });
}
