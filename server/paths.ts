import path from "path";

/**
 * Machine-specific locations the server shells out to or writes into.
 * Each one can be set in .env; the defaults are Gabriel's Pi, so that
 * server keeps working unchanged. A new machine sets these (see .env.example).
 */
const HOME_DIR = process.env.AGENT_HOME || "/home/gabriel";

/** This repo's checkout: uploads live under it and the Code Runner agent works in it. */
export const APP_DIR = process.env.APP_DIR || path.join(HOME_DIR, "LeadAwakerApp");

/** HOME handed to the claude and gog CLIs (where their auth and skills live). */
export const AGENT_HOME = HOME_DIR;

/** The Python automations engine repo (LeadAwakerAutomations). */
export const AUTOMATIONS_DIR = process.env.AUTOMATIONS_DIR || path.join(HOME_DIR, "automations");
export const AUTOMATIONS_PYTHON = process.env.AUTOMATIONS_PYTHON || path.join(AUTOMATIONS_DIR, ".venv/bin/python3");

/** The self-hosted Cal.diy checkout, shelled into for booking-page provisioning. */
export const CALDIY_DIR = process.env.CALDIY_DIR || path.join(HOME_DIR, "caldiy");

/** CLI binaries. */
export const CLAUDE_BIN = process.env.CLAUDE_BIN || path.join(HOME_DIR, ".npm-global/bin/claude");
export const GOG_BIN = process.env.GOG_BIN || path.join(HOME_DIR, ".local/bin/gog");

/** Where generated invoice PDFs and uploaded expense files are filed. */
export const INVOICES_DIR = process.env.INVOICES_DIR || path.join(HOME_DIR, "Images/Invoices");
export const EXPENSES_DIR = process.env.EXPENSES_DIR || path.join(HOME_DIR, "Images/Expenses");
