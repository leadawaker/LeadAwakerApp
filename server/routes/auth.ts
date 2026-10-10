import type { Express } from "express";
import { pool } from "../db";
import { registerAuthRoutes } from "../auth";
import { verifySmtp, sendInviteEmail, sendRawEmail, escapeHtml, renderEmailLayout, renderEmailText, emailDetails } from "../email";
import { requireAgency } from "../auth";

// ─── Contact form guards ─────────────────────────────────────────────────
const CONTACT_MAX = { name: 200, email: 254, description: 5000 };
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

// In-memory per-IP limiter (same approach as the login limiter in ../auth.ts):
// 5 submissions per IP per hour.
const contactAttempts = new Map<string, number[]>();
function checkContactRateLimit(ip: string): boolean {
  const now = Date.now();
  const window = 60 * 60 * 1000;
  const attempts = (contactAttempts.get(ip) || []).filter(t => now - t < window);
  if (attempts.length >= 5) {
    contactAttempts.set(ip, attempts);
    return false;
  }
  attempts.push(now);
  contactAttempts.set(ip, attempts);
  if (contactAttempts.size > 5000) {
    for (const [key, times] of contactAttempts) {
      if (!times.some(t => now - t < window)) contactAttempts.delete(key);
    }
  }
  return true;
}

export function registerAuthAndAdminRoutes(app: Express): void {
  // ─── Security Headers ────────────────────────────────────────────────
  app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // ─── Auth Routes (public) ──────────────────────────────────────────
  registerAuthRoutes(app);

  // ─── Email Test (agency only) ──────────────────────────────────────
  app.post("/api/admin/test-email", requireAgency, async (req, res) => {
    const { to } = req.body;
    if (!to) return res.status(400).json({ message: "to is required" });
    try {
      await verifySmtp();
    } catch (err: any) {
      return res.status(500).json({ message: `Email config check failed: ${err.message}` });
    }
    try {
      const result = await sendInviteEmail({
        to,
        inviteLink: "https://example.com/accept-invite?token=test&email=test%40example.com",
        role: "Test",
        invitedBy: req.user?.email || "admin",
      });
      if (!result) return res.status(500).json({ message: "Email is not configured" });
      res.json({ message: `Test email sent to ${to} via ${result.provider}`, provider: result.provider, id: result.id ?? null });
    } catch (err: any) {
      console.error("[auth] test email failed:", err);
      res.status(500).json({ message: `Test email failed: ${err.message}` });
    }
  });

  // ─── Landing page contact form (public) ───────────────────────────
  app.post("/api/contact", async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkContactRateLimit(ip)) {
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }
    const { name, email, description } = req.body ?? {};
    if (typeof name !== "string" || typeof email !== "string") {
      return res.status(400).json({ message: "name and email are required" });
    }
    if (description != null && typeof description !== "string") {
      return res.status(400).json({ message: "description must be text" });
    }
    const cleanName = name.replace(/[\r\n]+/g, " ").trim();
    const cleanEmail = email.trim();
    const cleanDescription = (description ?? "").trim();
    if (!cleanName || !cleanEmail) return res.status(400).json({ message: "name and email are required" });
    if (cleanName.length > CONTACT_MAX.name || cleanEmail.length > CONTACT_MAX.email || cleanDescription.length > CONTACT_MAX.description) {
      return res.status(400).json({ message: "Input too long" });
    }
    if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ message: "Invalid email address" });
    try {
      const heading = `New introduction: ${cleanName}`;
      const cta = { label: `Reply to ${cleanName}`, url: `mailto:${cleanEmail}` };
      const footerNote = "Sent from the contact form on leadawaker.com. Replying goes straight to the sender.";
      const details = [
        { label: "Name", valueHtml: escapeHtml(cleanName) },
        { label: "Email", valueHtml: `<a href="mailto:${escapeHtml(cleanEmail)}">${escapeHtml(cleanEmail)}</a>` },
      ];
      if (cleanDescription) {
        details.push({ label: "Message", valueHtml: escapeHtml(cleanDescription).replace(/\n/g, "<br>") });
      }
      await sendRawEmail({
        to: "gabriel@leadawaker.com",
        subject: heading,
        text: renderEmailText({
          heading,
          bodyText: `Name: ${cleanName}\nEmail: ${cleanEmail}${cleanDescription ? `\n\n${cleanDescription}` : ""}`,
          cta,
          footerNote,
        }),
        html: renderEmailLayout({
          preheader: cleanDescription || cleanEmail,
          eyebrow: "Website contact form",
          heading,
          bodyHtml: emailDetails(details),
          cta,
          footerNote,
        }),
        replyTo: cleanEmail,
      });
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[contact] email failed:", err.message);
      res.status(500).json({ message: "Failed to send, try again later." });
    }
  });

  // ─── Health Check (public for monitoring) ─────────────────────────
  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "healthy", database: "connected" });
    } catch (err: any) {
      console.error("[auth] health check DB error:", err);
      res.status(500).json({ status: "error", database: "disconnected" });
    }
  });
}
