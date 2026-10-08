// Creates the public website demo tables and seeds its settings row
// (db:push needs a TTY on the Pi). See specs/public-website-demo.
// Run: node --env-file=.env script/create-public-demo-tables.mjs
import pg from "pg";

const SCHEMA = "p2mxx34fvbf3ll6"; // nocodb pgSchema (matches shared/schema.ts)

const DEFAULT_SETTINGS = {
  enabled: true,
  allowedCountryCodes: ["31", "44", "55"],
  dailyBudgetEur: 10,
  maxDemosPerDay: 40,
  maxRequestsPerIpPerDay: 3,
  phoneCooldownDays: 30,
  domainCacheDays: 30,
  voiceMaxMinutesPerSession: 5,
  voiceMaxSessionsPerDemo: 3,
  unknownCallerMaxMinutes: 2,
  whatsappIdleCompleteMinutes: 30,
  feedbackMessage: { enabled: false, delayMinutes: 120 },
  costEstimates: { buildEur: 0.08, voiceMinuteEur: 0.2, chatTurnEur: 0.01 },
  callNumber: "+31738519847",
};

const sql = `
CREATE TABLE IF NOT EXISTS "${SCHEMA}"."Public_Demo_Requests" (
  "id" serial PRIMARY KEY,
  "token" text NOT NULL UNIQUE,
  "status" text NOT NULL DEFAULT 'awaiting_phone',
  "website_url" text NOT NULL,
  "domain" text NOT NULL,
  "language" text NOT NULL,
  "ip_hash" text NOT NULL,
  "user_agent" text,
  "consent_at" timestamptz NOT NULL,
  "phone" text,
  "lead_id" integer,
  "persona" jsonb,
  "company_name" text,
  "reason" text,
  "est_cost_eur" numeric(8,4) NOT NULL DEFAULT 0,
  "voice_sessions" integer NOT NULL DEFAULT 0,
  "voice_seconds" integer NOT NULL DEFAULT 0,
  "chat_turns" integer NOT NULL DEFAULT 0,
  "voice_ended_at" timestamptz,
  "feedback" text,
  "followup_task_id" integer,
  "feedback_sent_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "verified_at" timestamptz,
  "ready_at" timestamptz,
  "completed_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "public_demo_requests_domain_idx" ON "${SCHEMA}"."Public_Demo_Requests" ("domain", "ready_at");
CREATE INDEX IF NOT EXISTS "public_demo_requests_phone_idx" ON "${SCHEMA}"."Public_Demo_Requests" ("phone", "created_at");
CREATE INDEX IF NOT EXISTS "public_demo_requests_ip_idx" ON "${SCHEMA}"."Public_Demo_Requests" ("ip_hash", "created_at");
CREATE INDEX IF NOT EXISTS "public_demo_requests_status_idx" ON "${SCHEMA}"."Public_Demo_Requests" ("status");

CREATE TABLE IF NOT EXISTS "${SCHEMA}"."Public_Demo_Spend" (
  "day" date PRIMARY KEY,
  "est_cost_eur" numeric(10,4) NOT NULL DEFAULT 0,
  "demos_built" integer NOT NULL DEFAULT 0,
  "budget_alert_sent_at" timestamptz
);
`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(sql);
  await pool.query(
    `INSERT INTO "${SCHEMA}"."Demo_Settings" (service, settings, updated_at)
     VALUES ('public_demo', $1::jsonb, now())
     ON CONFLICT (service) DO NOTHING`,
    [JSON.stringify(DEFAULT_SETTINGS)],
  );
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 AND table_name LIKE 'Public_Demo_%'`,
    [SCHEMA],
  );
  console.log("Public demo tables ready:", rows.map((r) => r.table_name).join(", "));
} catch (err) {
  console.error("Failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
