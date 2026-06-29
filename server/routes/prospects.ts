import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth, requireAgency } from "../auth";
import {
  accounts,
  prospects,
  insertProspectsSchema,
} from "@shared/schema";
import { toDbKeys, toDbKeysArray, fromDbKeys } from "../dbKeys";
import { db } from "../db";
import { and, isNotNull, lte, not, inArray } from "drizzle-orm";
import { provisionCaldiyForAccount } from "../calendar/caldiy";
import { handleZodError, wrapAsync } from "./_helpers";
import { buildOutreachPrompt } from "../outreachStyles";

export function registerProspectsRoutes(app: Express): void {
  // ─── Prospects ───────────────────────────────────────────────────────

  app.get("/api/prospects", requireAgency, wrapAsync(async (req, res) => {
    const parseArr = (v: unknown): string[] | undefined => {
      if (typeof v !== "string" || !v.trim()) return undefined;
      return v.split(",").map(s => s.trim()).filter(Boolean);
    };
    const q = req.query;
    const all = q.all === "true" || q.all === "1";
    const params = {
      limit: q.limit ? parseInt(String(q.limit), 10) : undefined,
      offset: q.offset ? parseInt(String(q.offset), 10) : undefined,
      search: typeof q.search === "string" ? q.search : undefined,
      niche: parseArr(q.niche),
      status: parseArr(q.status),
      country: parseArr(q.country),
      priority: parseArr(q.priority),
      source: parseArr(q.source),
      overdue: q.overdue === "true",
      sortBy: typeof q.sortBy === "string" ? q.sortBy : undefined,
      groupBy: typeof q.groupBy === "string" ? q.groupBy : undefined,
      groupDirection: q.groupDirection === "desc" ? "desc" as const : q.groupDirection === "asc" ? "asc" as const : undefined,
      all,
    };
    const result = await storage.getProspectsPaginated(params);
    res.json({
      items: toDbKeysArray(result.items as any, prospects),
      total: result.total,
      hasMore: result.hasMore,
    });
  }));

  // Filter options (distinct niches / countries / sources) — must be before :id route
  app.get("/api/prospects/filter-options", requireAgency, wrapAsync(async (_req, res) => {
    const opts = await storage.getProspectsFilterOptions();
    res.json(opts);
  }));

  // Lookup prospects by ids — must be before :id route
  app.get("/api/prospects/by-ids", requireAgency, wrapAsync(async (req, res) => {
    const raw = typeof req.query.ids === "string" ? req.query.ids : "";
    const ids = raw.split(",").map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n) && n > 0);
    const items = await storage.getProspectsByIds(ids);
    res.json({ items: toDbKeysArray(items as any, prospects) });
  }));

  // Prospect conversations (must be before :id route)
  app.get("/api/prospects/conversations", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const result = await storage.getProspectConversations();
    res.json(result);
  }));

  app.get("/api/prospects/cadence-queue", requireAgency, wrapAsync(async (_req, res) => {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const excluded = ["paused", "deal_closed", "converted"];
    const rows = await db
      .select()
      .from(prospects)
      .where(
        and(
          isNotNull(prospects.nextFollowUpDate),
          lte(prospects.nextFollowUpDate, todayEnd),
          not(inArray(prospects.outreachStatus, excluded))
        )
      )
      .orderBy(prospects.nextFollowUpDate);
    res.json(toDbKeysArray(rows as any, prospects));
  }));

  app.post("/api/prospects/:id/enter-cadence", requireAgency, wrapAsync(async (req, res) => {
    const id = Number(req.params.id);
    const now = new Date();
    const updated = await storage.updateProspect(id, {
      sequenceStep: 1,
      sequenceStartedAt: now,
      nextFollowUpDate: now,
      nextChannel: "call",
      outreachStatus: "contacted",
    });
    res.json(toDbKeys(updated as any, prospects));
  }));

  app.post("/api/prospects/:id/log-contact", requireAgency, wrapAsync(async (req, res) => {
    const id = Number(req.params.id);
    const { channel, notes } = req.body as { channel: string; notes?: string };
    const prospect = await storage.getProspectById(id);
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });

    const now = new Date();
    const currentStep = prospect.sequenceStep ?? 1;
    let nextStep = currentStep;
    let nextFollowUpDate: Date | null = null;
    let nextChannel: string | null = null;
    let outreachStatus: string = prospect.outreachStatus ?? "contacted";

    if (currentStep === 1) {
      nextStep = 2;
      nextFollowUpDate = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
      nextChannel = "call";
    } else if (currentStep === 2) {
      nextStep = 3;
      nextFollowUpDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
      nextChannel = "email";
    } else {
      outreachStatus = "paused";
    }

    const [updated] = await Promise.all([
      storage.updateProspect(id, {
        followUpCount: (prospect.followUpCount ?? 0) + 1,
        lastContactedAt: now,
        sequenceStep: nextStep,
        nextFollowUpDate: nextFollowUpDate ?? undefined,
        nextChannel: nextChannel ?? undefined,
        outreachStatus,
      }),
      storage.createInteraction({
        prospectId: id,
        type: channel,
        direction: "outbound",
        content: notes || null,
        isManualFollowUp: true,
      } as any),
    ]);

    res.json(toDbKeys(updated as any, prospects));
  }));

  app.post("/api/prospects/:id/skip-cadence", requireAgency, wrapAsync(async (req, res) => {
    const id = Number(req.params.id);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const updated = await storage.updateProspect(id, { nextFollowUpDate: tomorrow });
    res.json(toDbKeys(updated as any, prospects));
  }));

  app.get("/api/prospects/:id/messages", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const prospectId = Number(req.params.id);
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const result = await storage.getProspectMessages(prospectId, limit, offset);
    res.json(result);
  }));

  app.get("/api/prospects/:id", requireAgency, wrapAsync(async (req, res) => {
    const prospect = await storage.getProspectById(Number(req.params.id));
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });
    res.json(toDbKeys(prospect as any, prospects));
  }));

  app.post("/api/prospects", requireAgency, wrapAsync(async (req, res) => {
    const parsed = insertProspectsSchema.safeParse(fromDbKeys(req.body, prospects));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const prospect = await storage.createProspect(parsed.data);
    res.status(201).json(toDbKeys(prospect as any, prospects));
  }));

  app.patch("/api/prospects/:id", requireAgency, wrapAsync(async (req, res) => {
    const parsed = insertProspectsSchema.partial().safeParse(fromDbKeys(req.body, prospects));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const prospect = await storage.updateProspect(Number(req.params.id), parsed.data);
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });

    // Auto-set contacted timestamps when moving to "contacted" for the first time
    const incomingStatus = req.body.outreach_status ?? req.body.outreachStatus;
    if (incomingStatus === "contacted" && !prospect.firstContactedAt) {
      const now = new Date();
      const followUp = new Date();
      followUp.setDate(followUp.getDate() + 3);
      await storage.updateProspect(Number(req.params.id), {
        firstContactedAt: now,
        lastContactedAt: now,
        followUpCount: 1,
        nextFollowUpDate: followUp,
      });
    }

    // Auto-create task when outreach_status changes
    if (incomingStatus) {
      const statusTaskMap: Record<string, { title: string; dueDays: number }> = {
        contacted:     { title: `Follow up with ${prospect.company || prospect.name || 'prospect'}`, dueDays: 3 },
        call_booked:   { title: `Call with ${prospect.company || prospect.name || 'prospect'}`, dueDays: 3 },
        demo_given:    { title: `Send proposal to ${prospect.company || prospect.name || 'prospect'}`, dueDays: 2 },
        proposal_sent: { title: `Follow up on proposal: ${prospect.company || prospect.name || 'prospect'}`, dueDays: 5 },
        deal_closed:   { title: `Onboard ${prospect.company || prospect.name || 'prospect'} — set up campaign`, dueDays: 3 },
      };
      const taskDef = statusTaskMap[incomingStatus];
      if (taskDef) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + taskDef.dueDays);
        const niche = prospect.niche || "General";
        try {
          await storage.createTask({
            title: taskDef.title,
            status: "todo",
            priority: prospect.priority || "medium",
            tags: JSON.stringify(["Outreach", niche]),
            accountsId: 1,
            parentTaskId: 176,
            dueDate,
            taskType: "follow_up",
          });
        } catch (err) {
          console.error("[Auto-Task] Failed to create task for prospect status change:", err);
        }
      }
    }

    res.json(toDbKeys(prospect as any, prospects));
  }));

  app.post("/api/prospects/:id/convert-to-account", requireAgency, wrapAsync(async (req, res) => {
    const prospect = await storage.getProspectById(Number(req.params.id));
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });
    if (prospect.accountsId) return res.status(400).json({ message: "Prospect already linked to an account" });

    // Check if an account with the same name already exists
    const accountName = prospect.company || prospect.name || "Unnamed Account";
    const existingAccounts = await storage.getAccounts();
    const duplicate = existingAccounts.find((a: any) => (a.name || "").toLowerCase().trim() === accountName.toLowerCase().trim());
    if (duplicate) {
      // Link to existing account instead of creating a new one
      const updatedProspect = await storage.updateProspect(Number(req.params.id), {
        accountsId: duplicate.id,
        status: "Converted",
      });
      return res.json({
        account: toDbKeys(duplicate as any, accounts),
        prospect: toDbKeys(updatedProspect as any, prospects),
        linked_existing: true,
      });
    }

    // Create account from prospect data
    const account = await storage.createAccount({
      name: prospect.company || prospect.name || "Unnamed Account",
      phone: prospect.phone || prospect.contactPhone || null,
      website: prospect.website || null,
      ownerEmail: prospect.contactEmail || prospect.email || null,
      status: "trial",
      businessNiche: prospect.niche || null,
    });
    provisionCaldiyForAccount(account.id);

    // Link prospect to the new account and set status to Converted
    const updatedProspect = await storage.updateProspect(Number(req.params.id), {
      accountsId: account.id,
      status: "Converted",
    });

    res.json({
      account: toDbKeys(account as any, accounts),
      prospect: toDbKeys(updatedProspect as any, prospects),
    });
  }));

  // ─── Prospect Enrichment ────────────────────────────────────────
  app.post("/api/prospects/:id/enrich", requireAgency, wrapAsync(async (req, res) => {
    const prospectId = Number(req.params.id);
    const { type, contactSlot } = req.body as {
      type?: "website" | "linkedin" | "both" | "company";
      contactSlot?: 1 | 2;
    };
    if (!type || !["website", "linkedin", "both", "company"].includes(type)) {
      return res.status(400).json({ message: "type must be 'company', 'linkedin', 'website', or 'both'" });
    }

    const prospect = await storage.getProspectById(prospectId);
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });

    const results: { website?: string; linkedin?: any; company?: string } = {};
    const slot = contactSlot ?? 1;

    const spawnWebsiteEnricher = async () => {
      const { spawn } = await import("child_process");
      const args = ["-m", "tools.prospect_enricher", "--prospect-id", String(prospectId), "--force"];
      if (slot === 2) args.push("--contact-slot", "2");
      const child = spawn("/home/gabriel/automations/.venv/bin/python3", args, {
        cwd: "/home/gabriel/automations", detached: true, stdio: "ignore",
      });
      child.unref();
      results.website = "started";
    };

    if (type === "company") {
      // New full-company enrichment: spawn Claude Code agent that runs the /prospect skill
      try {
        const { startCompanyEnrichment } = await import("../companyEnricher");
        const r = await startCompanyEnrichment(prospectId);
        results.company = r.started ? "started" : "failed";
      } catch (err: any) {
        console.error("[Enrich] Company enrichment error:", err);
        results.company = "error";
      }
    } else if (type === "both") {
      // Legacy path: LinkedIn then Python website enricher
      try {
        const { enrichLinkedIn } = await import("../linkedinEnricher");
        results.linkedin = await enrichLinkedIn(prospectId, slot);
      } catch (err: any) {
        console.error("[Enrich] LinkedIn error:", err);
        results.linkedin = { error: "enrichment failed" };
      }
      await spawnWebsiteEnricher();
    } else if (type === "website") {
      await spawnWebsiteEnricher();
    } else if (type === "linkedin") {
      try {
        const { enrichLinkedIn } = await import("../linkedinEnricher");
        results.linkedin = await enrichLinkedIn(prospectId, slot);
      } catch (err: any) {
        console.error("[Enrich] LinkedIn error:", err);
        results.linkedin = { error: "enrichment failed" };
      }
    }

    res.json({ ok: true, results });
  }));

  // ─── Outreach Message Generation ─────────────────────────────────
  app.post("/api/prospects/:id/generate-messages", requireAgency, wrapAsync(async (req, res) => {
    const prospectId = Number(req.params.id);
    const { style, format, language = "en", offer, contact, customInstructions, templateBody } = req.body;

    if (!style || !format) {
      return res.status(400).json({ message: "style and format are required" });
    }

    const prospect = await storage.getProspectById(prospectId);
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });
    // Enrichment is optional: generate messages even without aiSummary (less context)

    const { interactions } = await storage.getInteractionsByProspectId(prospectId, 10);

    // Load style/format overrides from Prompt_Library (allows editing in UI)
    const allPrompts = await storage.getPrompts();
    const styleOverride = allPrompts.find(p => p.useCase === "outreach_style" && p.name === style && p.status === "active")?.promptText ?? undefined;
    const formatOverride = allPrompts.find(p => p.useCase === "outreach_format" && p.name === format && p.status === "active")?.promptText ?? undefined;

    const prompt = buildOutreachPrompt(prospect, style, format, language, interactions.map(i => ({
      content: i.content || "",
      direction: i.direction || "outbound",
      sentAt: i.sentAt,
    })), { selectedOffer: offer, selectedContact: contact, customInstructions, templateBody, styleOverride, formatOverride });

    const { execFile } = await import("child_process");
    const CLAUDE_BIN = "/home/gabriel/.npm-global/bin/claude";

    const result = await new Promise<string>((resolve, reject) => {
      execFile(CLAUDE_BIN, ["-p", prompt, "--model", "sonnet", "--max-turns", "1"],
        { timeout: 120000, maxBuffer: 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) reject(error);
          else resolve(stdout);
        }
      );
    });

    // Strip markdown fences if present (claude sometimes wraps JSON)
    let cleaned = result.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    const newMessages: Array<{ title: string; text: string }> = JSON.parse(cleaned);

    // Merge with existing saved messages: keep favorites, replace non-favorites
    let existing: Array<{ title: string; text: string; saved?: boolean }> = [];
    try {
      if (prospect.generatedMessages) existing = JSON.parse(prospect.generatedMessages);
    } catch { /* ignore */ }

    const favorites = existing.filter(m => m.saved);
    const merged = [...favorites, ...newMessages.map(m => ({ ...m, saved: false }))];
    await storage.updateProspect(prospectId, { generatedMessages: JSON.stringify(merged) });

    res.json({ messages: merged });
  }));

  // ─── Edit Single Message with AI instruction ─────────────────────
  app.post("/api/prospects/:id/edit-message", requireAgency, wrapAsync(async (req, res) => {
    const prospectId = Number(req.params.id);
    const { messageText, instruction } = req.body;
    if (!messageText || !instruction) {
      return res.status(400).json({ message: "messageText and instruction are required" });
    }

    const prompt = `You are editing an outreach message based on a user instruction. Return ONLY the revised message text, no explanation, no quotes, no JSON wrapper. Do not use em dashes (—) or en dashes (–) anywhere in the output.\n\nOriginal message:\n${messageText}\n\nInstruction: ${instruction}`;

    const { execFile } = await import("child_process");
    const CLAUDE_BIN = "/home/gabriel/.npm-global/bin/claude";

    const result = await new Promise<string>((resolve, reject) => {
      execFile(CLAUDE_BIN, ["-p", prompt, "--model", "haiku", "--max-turns", "1"],
        { timeout: 60000, maxBuffer: 1024 * 1024 },
        (error, stdout) => { if (error) reject(error); else resolve(stdout); }
      );
    });

    res.json({ text: result.trim() });
  }));

  // ─── Append Offer Idea (AI-generated) ────────────────────────────
  app.post("/api/prospects/:id/append-offer", requireAgency, wrapAsync(async (req, res) => {
    const prospectId = Number(req.params.id);
    const { count } = req.body as { count?: number };
    const prospect = await storage.getProspectById(prospectId);
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });

    // Parse existing offers (handles both string[] and {text,checked}[] formats)
    let existingOffers: Array<{ text: string; checked?: boolean }> = [];
    try {
      if (prospect.offerIdeas) {
        const parsed = JSON.parse(prospect.offerIdeas);
        if (Array.isArray(parsed)) {
          existingOffers = parsed.map((item: any) =>
            typeof item === "string" ? { text: item } : { text: item.text, checked: item.checked }
          );
        }
      }
    } catch {
      existingOffers = [];
    }

    const existingTexts = existingOffers.map(o => o.text);
    const companyName = prospect.company || prospect.name || "this company";
    const niche = prospect.niche ? ` in the ${prospect.niche} industry` : "";
    const summary = prospect.aiSummary ? `\nCompany website brief: ${prospect.aiSummary}` : "";
    const pageSummaries = prospect.pageSummaries ? `\nWebsite research: ${String(prospect.pageSummaries).slice(0, 1200)}` : "";
    const companySummary = prospect.companySummary ? `\nLinkedIn company summary: ${prospect.companySummary}` : "";
    const personBrief = prospect.personBrief ? `\nPrimary contact: ${prospect.personBrief}` : "";
    const contact2Brief = prospect.contact2PersonBrief ? `\nSecondary contact: ${prospect.contact2PersonBrief}` : "";
    const numToGenerate = count ?? (existingOffers.length === 0 ? 5 : 1);
    const existingBlock = existingTexts.length > 0
      ? `\n\nALREADY EXISTING OFFERS — do NOT generate anything similar to these, they are already saved:\n${existingTexts.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
      : "";

    const prompt = `You are generating sales offer ideas for Lead Awaker, an AI lead reactivation agency run by Gabriel.

How Lead Awaker works:
- Takes a company's old/dead lead database (people who enquired but never bought)
- Runs AI-powered WhatsApp conversations to re-engage those leads, qualify them, and book appointments
- Also handles after-hours enquiries, automates intake, and sends personalized follow-up sequences
- Performance-based model: the client pays nothing upfront — Lead Awaker earns only when it generates booked calls or closed deals
- Best fit: businesses selling products/services over €1,000 that have a sales team and an existing lead database gathering dust

Ideal prospect signals: high-ticket sales (solar, insurance, mortgages, real estate, legal, dental, home services, automotive), existing sales team, old lead lists from past advertising, and a clear offer that closes in a phone call or meeting.

Company being researched: ${companyName}${niche}${summary}${pageSummaries}${companySummary}${personBrief}${contact2Brief}${existingBlock}

Generate exactly ${numToGenerate} NEW and DISTINCT offer idea${numToGenerate > 1 ? "s" : ""} for how Lead Awaker could partner with ${companyName}. Each idea should:
- Name a specific problem or opportunity at this company (dead leads, missed follow-ups, after-hours drop-off, slow response times, etc.)
- Connect it to something concrete about their business, niche, services, or contacts above
- Be written as a sharp one-liner pitch Gabriel could say in a casual conversation — direct, specific, no fluff

Format: one offer per line as "Title: description". No numbering, no quotes, no extra text. Return ONLY the offer lines.

IMPORTANT: Always write the offers in English, regardless of the company's country or language.`;

    const { execFile } = await import("child_process");
    const CLAUDE_BIN = "/home/gabriel/.npm-global/bin/claude";

    const result = await new Promise<string>((resolve, reject) => {
      execFile(CLAUDE_BIN, ["-p", prompt, "--model", "sonnet", "--max-turns", "1"],
        { timeout: 120000, maxBuffer: 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) reject(error);
          else resolve(stdout);
        }
      );
    });

    const newOfferTexts = result.trim().split("\n").map(l => l.replace(/^\d+[\.\)]\s*/, "").trim()).filter(Boolean);
    const newOffers = newOfferTexts.map(text => ({ text, checked: false }));

    const updatedOffers = [...existingOffers, ...newOffers];
    await storage.updateProspect(prospectId, { offerIdeas: JSON.stringify(updatedOffers) });

    res.json({ offers: newOfferTexts });
  }));
}
