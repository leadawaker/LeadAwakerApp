import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth, requireAgency, scopeToAccount } from "../auth";
import {
  invoices,
  contracts,
  insertInvoicesSchema,
  insertContractsSchema,
  insertExpensesSchema,
} from "@shared/schema";
import { toDbKeys, toDbKeysArray, fromDbKeys } from "../dbKeys";
import { saveInvoiceArtifacts } from "../invoiceArtifacts";
import { handleZodError, wrapAsync, coerceDates } from "./_helpers";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

export function registerBillingRoutes(app: Express): void {
  // ─── Invoices ────────────────────────────────────────────────────────

  app.get("/api/invoices", requireAuth, scopeToAccount, wrapAsync(async (req, res) => {
    const forcedId = (req as any).forcedAccountId as number | undefined;
    const accountId = forcedId ?? (req.query.accountId ? Number(req.query.accountId) : undefined);
    const data = accountId
      ? await storage.getInvoicesByAccountId(accountId)
      : await storage.getInvoices();
    res.json(toDbKeysArray(data as any, invoices));
  }));

  app.get("/api/invoices/view/:token", wrapAsync(async (req, res) => {
    const invoice = await storage.getInvoiceByViewToken(req.params.token);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    const update: any = {
      viewedCount: (invoice.viewedCount ?? 0) + 1,
    };
    if (!invoice.viewedAt) update.viewedAt = new Date();
    if (invoice.status === "Sent") update.status = "Viewed";
    await storage.updateInvoice(invoice.id!, update);
    res.json(toDbKeys({ ...invoice, ...update } as any, invoices));
  }));

  app.get("/api/invoices/:id", requireAuth, wrapAsync(async (req, res) => {
    const invoice = await storage.getInvoiceById(Number(req.params.id));
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    if (req.user!.accountsId !== 1 && invoice.accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(toDbKeys(invoice as any, invoices));
  }));

  app.post("/api/invoices", requireAgency, wrapAsync(async (req, res) => {
    const body = fromDbKeys(req.body, invoices) as Record<string, unknown>;
    const INVOICE_DATE_FIELDS = ["sentAt", "paidAt", "viewedAt"];
    const coerced = coerceDates(body, INVOICE_DATE_FIELDS);
    const parsed = insertInvoicesSchema.safeParse(coerced);
    if (!parsed.success) return handleZodError(res, parsed.error);

    // Auto-generate invoice number: INV-{SLUG}-{SEQ}
    let invoiceNumber = parsed.data.invoiceNumber;
    if (!invoiceNumber && parsed.data.accountsId) {
      const account = await storage.getAccountById(parsed.data.accountsId);
      const slug = (account?.slug || account?.name || "GEN").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
      const invoiceCount = await storage.getInvoiceCountByAccountId(parsed.data.accountsId);
      invoiceNumber = `INV-${slug}-${String(invoiceCount + 1).padStart(3, "0")}`;
    }

    const data = {
      ...parsed.data,
      invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
      viewToken: crypto.randomUUID(),
      status: parsed.data.status || "Draft",
    };
    const invoice = await storage.createInvoice(data);
    res.status(201).json(toDbKeys(invoice as any, invoices));
  }));

  app.patch("/api/invoices/:id", requireAgency, wrapAsync(async (req, res) => {
    const existing = await storage.getInvoiceById(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Invoice not found" });
    const body = fromDbKeys(req.body, invoices) as Record<string, unknown>;
    const INVOICE_DATE_FIELDS = ["sentAt", "paidAt", "viewedAt"];
    const coerced = coerceDates(body, INVOICE_DATE_FIELDS);
    const parsed = insertInvoicesSchema.partial().safeParse(coerced);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const invoice = await storage.updateInvoice(Number(req.params.id), parsed.data);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.json(toDbKeys(invoice as any, invoices));
  }));

  app.patch("/api/invoices/:id/mark-sent", requireAgency, wrapAsync(async (req, res) => {
    const invoice = await storage.updateInvoice(Number(req.params.id), {
      status: "Sent",
      sentAt: new Date(),
    } as any);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.json(toDbKeys(invoice as any, invoices));
  }));

  app.patch("/api/invoices/:id/mark-paid", requireAgency, wrapAsync(async (req, res) => {
    const invoice = await storage.updateInvoice(Number(req.params.id), {
      status: "Paid",
      paidAt: new Date(),
    } as any);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    // Fire-and-forget: save PDF + append revenue.csv row
    saveInvoiceArtifacts(invoice).catch(err =>
      console.error("[invoice-artifacts] Failed:", err)
    );

    res.json(toDbKeys(invoice as any, invoices));
  }));

  app.delete("/api/invoices/:id", requireAgency, wrapAsync(async (req, res) => {
    const ok = await storage.deleteInvoice(Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Invoice not found" });
    res.status(204).end();
  }));

  // ─── Contracts ──────────────────────────────────────────────────────

  app.get("/api/contracts", requireAuth, scopeToAccount, wrapAsync(async (req, res) => {
    const forcedId = (req as any).forcedAccountId as number | undefined;
    const accountId = forcedId ?? (req.query.accountId ? Number(req.query.accountId) : undefined);
    const data = accountId
      ? await storage.getContractsByAccountId(accountId)
      : await storage.getContracts();
    res.json(toDbKeysArray(data as any, contracts));
  }));

  app.get("/api/contracts/view/:token", wrapAsync(async (req, res) => {
    const contract = await storage.getContractByViewToken(req.params.token);
    if (!contract) return res.status(404).json({ message: "Contract not found" });
    const update: any = {
      viewedCount: (contract.viewedCount ?? 0) + 1,
    };
    if (!contract.viewedAt) update.viewedAt = new Date();
    if (contract.status === "Sent") update.status = "Viewed";
    await storage.updateContract(contract.id!, update);
    res.json(toDbKeys({ ...contract, ...update } as any, contracts));
  }));

  app.get("/api/contracts/:id", requireAuth, wrapAsync(async (req, res) => {
    const contract = await storage.getContractById(Number(req.params.id));
    if (!contract) return res.status(404).json({ message: "Contract not found" });
    if (req.user!.accountsId !== 1 && contract.accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(toDbKeys(contract as any, contracts));
  }));

  app.post("/api/contracts", requireAgency, wrapAsync(async (req, res) => {
    const body = fromDbKeys(req.body, contracts) as Record<string, unknown>;
    const CONTRACT_DATE_FIELDS = ["signedAt", "sentAt", "viewedAt"];
    const coerced = coerceDates(body, CONTRACT_DATE_FIELDS);
    const parsed = insertContractsSchema.safeParse(coerced);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const data = {
      ...parsed.data,
      viewToken: crypto.randomUUID(),
      status: parsed.data.status || "Draft",
    };
    const contract = await storage.createContract(data);
    res.status(201).json(toDbKeys(contract as any, contracts));
  }));

  app.patch("/api/contracts/:id", requireAgency, wrapAsync(async (req, res) => {
    const existing = await storage.getContractById(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Contract not found" });
    const body = fromDbKeys(req.body, contracts) as Record<string, unknown>;
    const CONTRACT_DATE_FIELDS = ["signedAt", "sentAt", "viewedAt"];
    const coerced = coerceDates(body, CONTRACT_DATE_FIELDS);
    const parsed = insertContractsSchema.partial().safeParse(coerced);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const contract = await storage.updateContract(Number(req.params.id), parsed.data);
    if (!contract) return res.status(404).json({ message: "Contract not found" });
    res.json(toDbKeys(contract as any, contracts));
  }));

  app.patch("/api/contracts/:id/mark-signed", requireAgency, wrapAsync(async (req, res) => {
    const contract = await storage.updateContract(Number(req.params.id), {
      status: "Signed",
      signedAt: new Date(),
    } as any);
    if (!contract) return res.status(404).json({ message: "Contract not found" });
    res.json(toDbKeys(contract as any, contracts));
  }));

  // SignWell: send contract for e-signature
  app.post("/api/contracts/:id/send-for-signature", requireAgency, wrapAsync(async (req, res) => {
    const contractId = Number(req.params.id);
    const { signerEmail, signerName, testMode = true } = req.body as {
      signerEmail?: string;
      signerName?: string;
      testMode?: boolean;
    };

    if (!signerEmail) return res.status(400).json({ error: "signerEmail is required" });

    const contract = await storage.getContractById(contractId);
    if (!contract) return res.status(404).json({ error: "Contract not found" });

    const apiKey = process.env.SIGNWELL_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "SIGNWELL_API_KEY not configured" });

    try {
      // Build signer
      const signer = {
        id: "1",
        email: signerEmail,
        name: signerName || signerEmail,
        placeholder_name: "Signer 1",
        routing_order: 1,
        redirect_url: null,
      };

      // Prepare document content (base64 from contract.pdfContent or body.htmlContent)
      let fileData: string | null = null;
      const htmlContent = req.body.htmlContent as string | undefined;
      if (htmlContent) {
        fileData = Buffer.from(htmlContent).toString("base64");
      } else if ((contract as any).pdfContent) {
        fileData = (contract as any).pdfContent;
      }

      if (!fileData) {
        return res.status(400).json({ error: "No document content available to send for signature" });
      }

      const body = {
        test_mode: testMode,
        files: [{ name: `contract-${contractId}.html`, file_base64: fileData }],
        signers: [signer],
        subject: `Please sign: ${(contract as any).title || "Contract"}`,
        message: `You have been asked to sign a document by Lead Awaker.`,
        apply_signing_order: false,
        reminders: true,
        require_all_signers: true,
        embedded_signing: false,
      };

      const swRes = await fetch("https://www.signwell.com/api/v1/documents/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify(body),
      });

      const swData = await swRes.json() as any;

      if (!swRes.ok) {
        console.error("[SignWell] Error:", swData);
        return res.status(swRes.status).json({ error: "SignWell API error", details: swData });
      }

      // Update contract with SignWell document ID and set status to Sent
      const updated = await storage.updateContract(contractId, {
        status: "Sent",
        sentAt: new Date(),
        signwellDocumentId: swData.id,
        signerEmail,
        signerName: signerName || null,
      } as any);

      res.json({
        success: true,
        document_id: swData.id,
        signing_url: swData.signers?.[0]?.sign_url || null,
        contract: toDbKeys(updated as any, contracts),
      });
    } catch (err: any) {
      console.error("[SignWell] Error:", err);
      res.status(500).json({ error: "Failed to send contract for signature", details: err.message });
    }
  }));

  app.delete("/api/contracts/:id", requireAgency, wrapAsync(async (req, res) => {
    const ok = await storage.deleteContract(Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Contract not found" });
    res.status(204).end();
  }));

  // ── Expenses ──────────────────────────────────────────────────────────────────

  app.get("/api/expenses", requireAgency, wrapAsync(async (req, res) => {
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const quarter = req.query.quarter as string | undefined;
    const rows = await storage.getExpenses(year, quarter);
    res.json(rows);
  }));

  app.post("/api/expenses/parse-pdf", requireAgency, wrapAsync(async (req, res) => {
    const apiKey = process.env.OPEN_AI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ error: "NO_API_KEY" });
    }
    const { pdf_data } = req.body;
    if (!pdf_data) return res.status(400).json({ error: "pdf_data required" });

    // Strip data URI prefix to get raw base64
    const base64 = (pdf_data as string).startsWith("data:")
      ? (pdf_data as string).split(",")[1]
      : pdf_data as string;

    const prompt = `You are a Dutch business expense parser for Lead Awaker (owner: Gabriel Barbosa Fronza, NL VAT NL002488258B44, BTW registration start: 17 December 2025).

Extract these fields from the invoice PDF and return ONLY valid JSON (no markdown, no explanation):
{
  "date": "YYYY-MM-DD",
  "supplier": "supplier name",
  "country": "XX",
  "invoice_number": "...",
  "description": "brief item/service description (max 100 chars)",
  "currency": "EUR",
  "amount_excl_vat": 0.00,
  "vat_rate_pct": 0,
  "vat_amount": 0.00,
  "total_amount": 0.00,
  "nl_btw_deductible": false,
  "notes": "..."
}

Rules:
- country: 2-letter ISO code (NL, US, LU, DE, etc.)
- currency: EUR or USD (or actual currency on invoice)
- vat_rate_pct: 0, 9, or 21 (Dutch rates) or actual rate shown
- nl_btw_deductible: true ONLY if the invoice charges Dutch/EU VAT (BTW) that can be reclaimed as voorbelasting on the NL BTW return. US companies and non-EU companies not charging EU VAT = false.
- notes: helpful tax notes, e.g. "US company - no EU VAT charged" or "Pre-start expense - claim in Q1 2026 BTW return" or "NL supplier, 21% BTW reclaimable"
- If a field cannot be determined, use null`;

    const tmpPdf = `/tmp/invoice_parse_${crypto.randomBytes(16).toString("hex")}.pdf`;
    try {
      // Write PDF to disk, extract text with pdftotext
      fs.writeFileSync(tmpPdf, Buffer.from(base64, "base64"));
      let pdfText = "";
      try {
        pdfText = execFileSync("pdftotext", [tmpPdf, "-"], { maxBuffer: 1024 * 1024 }).toString().trim();
      } catch {
        return res.status(500).json({ error: "Could not extract text from PDF" });
      }
      if (!pdfText) return res.status(500).json({ error: "PDF has no extractable text" });

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0,
          messages: [{ role: "user", content: `${prompt}\n\nPDF TEXT:\n${pdfText.slice(0, 8000)}` }],
        }),
      });
      if (!response.ok) {
        const errBody = await response.text();
        console.error("[parse-pdf] OpenAI error:", errBody);
        return res.status(500).json({ error: "OpenAI API error", detail: errBody });
      }
      const result = await response.json() as any;
      const text = result?.choices?.[0]?.message?.content || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return res.status(500).json({ error: "Could not parse AI response", raw: text });
      res.json(JSON.parse(jsonMatch[0]));
    } catch (e: any) {
      console.error("[parse-pdf] error:", e);
      res.status(500).json({ error: e.message });
    } finally {
      try { fs.unlinkSync(tmpPdf); } catch {}
    }
  }));

  app.post("/api/expenses", requireAgency, wrapAsync(async (req, res) => {
    const body = req.body;
    let pdfPath: string | undefined;
    if (body.pdf_data && body.date) {
      try {
        const dateStr = body.date as string;
        const d = new Date(dateStr);
        const yr = d.getFullYear();
        const mo = d.getMonth();
        const q = mo <= 2 ? "Q1" : mo <= 5 ? "Q2" : mo <= 8 ? "Q3" : "Q4";
        const dir = `/home/gabriel/Images/Expenses/${yr}/${q}`;
        fs.mkdirSync(dir, { recursive: true });
        const supplier = (body.supplier || "Unknown").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
        const invNum = (body.invoice_number || "").replace(/[^a-zA-Z0-9\-]/g, "_").slice(0, 30);
        const cur = (body.currency || "EUR").toUpperCase();
        const amt = parseFloat(body.total_amount || "0").toFixed(2);
        const filename = `${dateStr}_${supplier}_${invNum}_${cur}${amt}.pdf`;
        const fullPath = `${dir}/${filename}`;
        const base64 = (body.pdf_data as string).replace(/^data:[^;]+;base64,/, "");
        fs.writeFileSync(fullPath, Buffer.from(base64, "base64"));
        pdfPath = fullPath;
      } catch (e) {
        console.error("[expenses] PDF save error:", e);
      }
    }
    const { pdf_data: _pdf, ...rest } = body;
    const expense = await storage.createExpense({
      date: rest.date || null,
      year: rest.year ? parseInt(rest.year) : (rest.date ? new Date(rest.date).getFullYear() : null),
      quarter: rest.quarter || null,
      supplier: rest.supplier || null,
      country: rest.country || null,
      invoiceNumber: rest.invoice_number || null,
      description: rest.description || null,
      currency: rest.currency || null,
      amountExclVat: rest.amount_excl_vat?.toString() || null,
      vatRatePct: rest.vat_rate_pct?.toString() || null,
      vatAmount: rest.vat_amount?.toString() || null,
      totalAmount: rest.total_amount?.toString() || null,
      nlBtwDeductible: rest.nl_btw_deductible === true || rest.nl_btw_deductible === "true" || false,
      notes: rest.notes || null,
      pdfPath: pdfPath || null,
    });
    res.status(201).json(expense);
  }));

  app.patch("/api/expenses/:id", requireAgency, wrapAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    const body = req.body;
    const updated = await storage.updateExpense(id, {
      date: body.date,
      year: body.year ? parseInt(body.year) : undefined,
      quarter: body.quarter,
      supplier: body.supplier,
      country: body.country,
      invoiceNumber: body.invoice_number,
      description: body.description,
      currency: body.currency,
      amountExclVat: body.amount_excl_vat?.toString(),
      vatRatePct: body.vat_rate_pct?.toString(),
      vatAmount: body.vat_amount?.toString(),
      totalAmount: body.total_amount?.toString(),
      nlBtwDeductible: body.nl_btw_deductible,
      notes: body.notes,
    });
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  }));

  app.delete("/api/expenses/:id", requireAgency, wrapAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    const ok = await storage.deleteExpense(id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  }));

  app.get("/api/expenses/:id/pdf", requireAgency, wrapAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    const rows = await storage.getExpenses();
    const expense = rows.find((r: any) => r.id === id);
    if (!expense || !expense.pdfPath) {
      return res.status(404).json({ error: "No PDF attached to this expense" });
    }
    if (!fs.existsSync(expense.pdfPath)) {
      return res.status(404).json({ error: "PDF file not found on disk" });
    }
    const filename = path.basename(expense.pdfPath);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    fs.createReadStream(expense.pdfPath).pipe(res);
  }));
}
