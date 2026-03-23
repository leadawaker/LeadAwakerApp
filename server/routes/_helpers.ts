/**
 * Shared utilities used across all route modules.
 * Import from here instead of duplicating in each file.
 */
import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

/** Module-level flag to emit the FRONTEND_URL warning only once per process. */
export let frontendUrlWarned = false;
export function setFrontendUrlWarned(val: boolean) { frontendUrlWarned = val; }

/**
 * Build the frontend base URL for invite links.
 * Prefers the origin sent by the browser (window.location.origin) — this is
 * the only reliable source when the API sits behind a Vite proxy that rewrites
 * the Host header. Falls back to FRONTEND_URL or the request host.
 */
export function frontendBaseUrl(req: Request): string {
  if (req.body?.frontendOrigin && typeof req.body.frontendOrigin === "string") {
    return req.body.frontendOrigin.replace(/\/$/, "");
  }
  if (process.env.STANDALONE_API) {
    let port = "5000";
    if (process.env.FRONTEND_URL) {
      try { port = new URL(process.env.FRONTEND_URL).port || "80"; } catch { /* ignore */ }
    }
    return `${req.protocol}://${req.hostname}:${port}`;
  }
  return process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
}

/** Return a 422 with Zod validation errors in a readable format. */
export function handleZodError(res: Response, err: ZodError) {
  return res.status(422).json({
    message: "Validation error",
    errors: err.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
  });
}

/** Wrap an async route handler to forward thrown errors to Express error middleware. */
export function wrapAsync(
  fn: (req: Request, res: Response) => Promise<unknown>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

/** Derive the automation engine base URL from the support chat webhook URL. */
export function getEngineUrl(): string {
  const raw = process.env.SUPPORT_CHAT_WEBHOOK_URL;
  if (raw) {
    const u = new URL(raw);
    return u.origin;
  }
  return "http://192.168.1.107:8100";
}

/**
 * Coerce ISO date strings to Date objects for Drizzle timestamp fields.
 * JSON payloads send dates as strings, but Drizzle/Zod expects Date objects.
 */
export function coerceDates(body: Record<string, unknown>, dateFields: string[]): Record<string, unknown> {
  const result = { ...body };
  for (const field of dateFields) {
    if (typeof result[field] === "string" && result[field]) {
      const d = new Date(result[field] as string);
      if (!isNaN(d.getTime())) result[field] = d;
    }
  }
  return result;
}

/**
 * Extract pagination params from query string.
 * Returns null if pagination is not requested (no `page` param).
 */
export function getPagination(req: Request) {
  const page = req.query.page ? Number(req.query.page) : null;
  if (page === null || isNaN(page) || page < 1) return null;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const sort = req.query.sort as string | undefined;
  const order = (req.query.order as string) === "asc" ? "asc" as const : "desc" as const;
  return { page, limit, sort, order };
}
