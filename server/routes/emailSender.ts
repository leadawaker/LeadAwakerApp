// Per-account email From-identity — spec: task #676 "step 8", specs/channel-fallback.
//
// Lets each client send fallback/opener email from THEIR own domain (deliverability + brand)
// instead of the shared Lead Awaker sender. We keep the single SMTP relay but make the From
// identity + DKIM signing per-account, gated on a DNS-verified domain (SPF + DKIM + DMARC).
//
// A per-account DKIM keypair is generated server-side; the client publishes the public key as a
// TXT record. The Python engine (tools/email_service.py) reads the verified identity and signs
// with d=<client domain> using the per-account key, so SPF/DKIM/DMARC align with the From header.
import type { Express } from "express";
import { generateKeyPairSync } from "node:crypto";
import { promises as dns } from "node:dns";
import { storage } from "../storage";
import { requireAuth, requireAgency } from "../auth";
import { wrapAsync } from "./_helpers";

// ── Relay constants (keep in sync with the Python engine's SMTP/DKIM config) ────────────────
// The token the client's SPF record must contain (our sending infra), the DMARC report mailbox,
// and the DMARC policy we recommend. SPF/DKIM/DMARC must all resolve before a domain verifies.
const RELAY_SPF_INCLUDE = "include:leadawaker.com";
const DMARC_RUA = "mailto:dmarc@leadawaker.com";

type DnsRecordKind = "spf" | "dkim" | "dmarc";
interface DnsRecord {
  kind: DnsRecordKind;
  host: string;
  type: "TXT";
  value: string;
}
interface DnsCheck extends DnsRecord {
  ok: boolean;
  found: string | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────────────────

function domainFromAddress(address: string): string {
  const at = address.lastIndexOf("@");
  return at >= 0 ? address.slice(at + 1).trim().toLowerCase() : "";
}

// A pasted email address is the only user input we trust into From headers / SMTP MAIL FROM.
function isValidEmail(address: string): boolean {
  return /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(address);
}

// Generate a per-account DKIM keypair. The public key is the base64 SPKI DER (the p= value the
// client publishes); the private key is PKCS1 PEM (the format dkimpy reads in the engine).
function generateDkimKeypair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
  });
  return {
    privateKey: privateKey as string,
    publicKey: (publicKey as Buffer).toString("base64"),
  };
}

// The three DNS records the client must publish for `domain`, given their DKIM selector + key.
function expectedRecords(domain: string, selector: string, publicKey: string): DnsRecord[] {
  return [
    { kind: "spf", host: domain, type: "TXT", value: `v=spf1 ${RELAY_SPF_INCLUDE} ~all` },
    {
      kind: "dkim",
      host: `${selector}._domainkey.${domain}`,
      type: "TXT",
      value: `v=DKIM1; k=rsa; p=${publicKey}`,
    },
    {
      kind: "dmarc",
      host: `_dmarc.${domain}`,
      type: "TXT",
      value: `v=DMARC1; p=none; rua=${DMARC_RUA}`,
    },
  ];
}

// Resolve every TXT record at `host`, each joined into a single string (DNS chunks 255-char TXT).
async function resolveTxtJoined(host: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(host);
    return records.map((chunks) => chunks.join(""));
  } catch {
    // NXDOMAIN / ENODATA / timeout → treat as "not published yet", not a server error.
    return [];
  }
}

const stripWs = (s: string) => s.replace(/\s+/g, "");

// Check that all three records resolve correctly. We're lenient on SPF (the client adds our
// include to whatever SPF they already have) and exact on the DKIM public key.
async function verifyDns(domain: string, selector: string, publicKey: string): Promise<DnsCheck[]> {
  const want = expectedRecords(domain, selector, publicKey);
  const checks: DnsCheck[] = [];

  for (const rec of want) {
    const txts = await resolveTxtJoined(rec.host);
    let ok = false;
    let found: string | null = null;

    if (rec.kind === "spf") {
      const spf = txts.find((t) => /^v=spf1/i.test(t.trim()));
      found = spf ?? null;
      ok = !!spf && spf.toLowerCase().includes(RELAY_SPF_INCLUDE);
    } else if (rec.kind === "dkim") {
      const dkim = txts.find((t) => /v=DKIM1/i.test(t) && /p=/.test(t));
      found = dkim ?? null;
      if (dkim) {
        // Isolate the p= base64 token. DNS panels / key generators often append other tags
        // (e.g. `p=ABC; t=s`) or a trailing `;`, so stop at the next `;` and strip whitespace
        // rather than comparing the whole tail (which would fail an otherwise-correct record).
        const p = stripWs((dkim.split("p=")[1] ?? "").split(";")[0]);
        ok = p.length > 0 && p === stripWs(publicKey);
      }
    } else {
      const dmarc = txts.find((t) => /v=DMARC1/i.test(t.trim()));
      found = dmarc ?? null;
      ok = !!dmarc;
    }

    checks.push({ ...rec, ok, found });
  }

  return checks;
}

function buildStatus(a: any, records: DnsRecord[]) {
  return {
    fromName: a.emailFromName || null,
    fromAddress: a.emailFromAddress || null,
    sendingDomain: a.emailSendingDomain || null,
    verified: !!a.emailDomainVerified,
    verifiedAt: a.emailVerifiedAt || null,
    records,
  };
}

// Pure read: returns the DNS records to display based on the account's current stored state.
// Keypair provisioning happens in the POST handler so GET remains side-effect-free.
function recordsForAccount(a: any): DnsRecord[] {
  const domain = a.emailSendingDomain;
  if (!domain || !a.emailFromAddress || !a.emailDkimSelector || !a.emailDkimPublicKey) return [];
  return expectedRecords(domain, a.emailDkimSelector, a.emailDkimPublicKey);
}

// ── Routes ──────────────────────────────────────────────────────────────────────────────────

export function registerEmailSenderRoutes(app: Express): void {
  // Status + the DNS records to publish.
  app.get(
    "/api/accounts/:id/email-sender/status",
    requireAuth,
    requireAgency,
    wrapAsync(async (req, res) => {
      const account = await storage.getAccountById(Number(req.params.id));
      if (!account) return res.status(404).json({ message: "Account not found" });
      res.json(buildStatus(account, recordsForAccount(account)));
    }),
  );

  // Save the From identity. Derives the sending domain, (re)generates the keypair if the domain
  // changed, and resets verification (a new identity must be re-verified before it can send).
  app.post(
    "/api/accounts/:id/email-sender",
    requireAuth,
    requireAgency,
    wrapAsync(async (req, res) => {
      const id = Number(req.params.id);
      const account = await storage.getAccountById(id);
      if (!account) return res.status(404).json({ message: "Account not found" });

      const fromName = (req.body?.fromName ?? "").toString().trim();
      const fromAddress = (req.body?.fromAddress ?? "").toString().trim().toLowerCase();
      if (!fromAddress || !isValidEmail(fromAddress)) {
        return res.status(400).json({ message: "A valid From address is required" });
      }

      const domain = domainFromAddress(fromAddress);
      const domainChanged = domain !== (account.emailSendingDomain || "");
      const needsKeypair = domainChanged || !account.emailDkimSelector || !account.emailDkimPublicKey;

      // Generate a fresh keypair when the domain changes (old DKIM key no longer aligns) or when
      // none exists yet (covers accounts whose domain was set directly in the DB).
      const keyFields = needsKeypair
        ? (() => {
            const { privateKey, publicKey } = generateDkimKeypair();
            return {
              emailDkimSelector: `la-${id}`,
              emailDkimPrivateKey: privateKey,
              emailDkimPublicKey: publicKey,
            };
          })()
        : {};

      const updated = await storage.updateAccount(id, {
        emailFromName: fromName || null,
        emailFromAddress: fromAddress,
        emailSendingDomain: domain,
        // Only reset verification when the domain changed — updating the From name alone leaves the
        // existing DNS verification intact (SPF/DKIM/DMARC are domain-level, not name-level).
        ...(domainChanged ? { emailDomainVerified: false, emailVerifiedAt: null } : {}),
        ...keyFields,
      } as any);

      const saved = updated || account;
      res.json(buildStatus(saved, recordsForAccount(saved)));
    }),
  );

  // Run the DNS checks. Flips email_domain_verified only when SPF + DKIM + DMARC all pass.
  app.post(
    "/api/accounts/:id/email-sender/verify",
    requireAuth,
    requireAgency,
    wrapAsync(async (req, res) => {
      const id = Number(req.params.id);
      const account = await storage.getAccountById(id);
      if (!account) return res.status(404).json({ message: "Account not found" });

      const domain = account.emailSendingDomain;
      if (!domain || !account.emailDkimSelector || !account.emailDkimPublicKey) {
        return res.status(400).json({ message: "Set a From address before verifying" });
      }

      const checks = await verifyDns(domain, account.emailDkimSelector, account.emailDkimPublicKey);
      const verified = checks.every((c) => c.ok);

      // Only ever flip TO verified here. A failed re-check is often a transient DNS hiccup
      // (timeout / SERVFAIL → resolveTxt throws → all checks read false); demoting an
      // already-verified domain on that would silently drop the client back to the shared
      // sender. So on failure we leave the stored verification untouched and just report which
      // records are missing.
      let verifiedAt = account.emailVerifiedAt || null;
      if (verified) {
        const updated = await storage.updateAccount(id, {
          emailDomainVerified: true,
          // Timestamp server-side (Drizzle-Zod expects a Date, never an ISO string).
          emailVerifiedAt: new Date(),
        } as any);
        verifiedAt = updated?.emailVerifiedAt || verifiedAt;
      }

      res.json({
        verified,
        verifiedAt,
        records: checks.map(({ kind, host, type, value, ok, found }) => ({
          kind,
          host,
          type,
          value,
          ok,
          found,
        })),
      });
    }),
  );
}
