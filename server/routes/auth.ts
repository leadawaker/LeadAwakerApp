import type { Express } from "express";
import { pool } from "../db";
import { registerAuthRoutes } from "../auth";
import { verifySmtp, sendInviteEmail } from "../email";
import { requireAgency } from "../auth";

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
      const ok = await verifySmtp().then(() => true).catch(() => false);
      if (!ok) return res.status(500).json({ message: "SMTP connection failed — check server logs for details" });
      await sendInviteEmail({
        to,
        inviteLink: "https://example.com/accept-invite?token=test&email=test%40example.com",
        role: "Test",
        invitedBy: req.user?.email || "admin",
      });
      res.json({ message: `Test email sent to ${to}` });
    } catch (err: any) {
      res.status(500).json({ message: `Email failed: ${err.message}` });
    }
  });

  // ─── Health Check (public for monitoring) ─────────────────────────
  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "healthy", database: "connected" });
    } catch (err: any) {
      res.status(500).json({ status: "error", database: "disconnected", error: err.message });
    }
  });
}
