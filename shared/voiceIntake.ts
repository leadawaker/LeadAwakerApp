// What the client's team wants to know before an appointment: the phone
// receptionist asks for these before offering a time. Stored as
// Account_Communication_Profile.setup.voice.intake, a plain string with one
// item per line. The engine reads the same string: change both.

export const MAX_INTAKE_ITEMS = 6;
export const MAX_INTAKE_LINE = 120;

/** Trimmed lines, empty ones dropped, at most 6 lines of at most 120 characters. "" = not set. */
export function normalizeIntake(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim().slice(0, MAX_INTAKE_LINE).trim())
    .filter(Boolean)
    .slice(0, MAX_INTAKE_ITEMS)
    .join("\n");
}

/** The non-empty lines as typed (trimmed), before the limits: lets the editor say how many will be used. */
export function intakeItems(raw: string): string[] {
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}
