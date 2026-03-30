/**
 * Listens on PostgreSQL NOTIFY channel "new_interaction" and broadcasts
 * incoming messages to connected SSE clients in real time.
 *
 * The Python automation service fires NOTIFY after every create_interaction()
 * call, so this covers inbound Twilio messages, AI replies, and any other
 * interaction source that bypasses the Express API.
 */
import pg from "pg";
import { broadcast } from "./sse";

const CHANNEL = "new_interaction";
const RESET_CHANNEL = "lead_reset";
const RECONNECT_DELAY_MS = 5_000;

export function startSseListener() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

  client.connect().then(() => {
    client.query(`LISTEN ${CHANNEL}`);
    client.query(`LISTEN ${RESET_CHANNEL}`);
    console.log(`[sse-listener] Listening on channels "${CHANNEL}", "${RESET_CHANNEL}"`);

    client.on("notification", (msg) => {
      if (!msg.payload) return;
      try {
        const data = JSON.parse(msg.payload);
        const accountId = data.accounts_id ?? data.Accounts_id;
        const eventName = msg.channel === RESET_CHANNEL ? "lead_reset" : "new_interaction";
        console.log(`[sse-listener] NOTIFY received: channel=${msg.channel}, accountId=${accountId}, leadId=${data.leads_id}`);
        if (typeof accountId === "number") {
          broadcast(accountId, eventName, data);
          console.log(`[sse-listener] Broadcast sent: event=${eventName}, accountId=${accountId}`);
        } else {
          console.warn(`[sse-listener] Skipped broadcast: accountId is not a number (got ${JSON.stringify(accountId)})`);
        }
      } catch (e) {
        console.error("[sse-listener] Failed to parse notification payload:", e);
      }
    });
  }).catch((err) => {
    console.error("[sse-listener] Connection failed, retrying in 5s:", err.message);
    setTimeout(startSseListener, RECONNECT_DELAY_MS);
  });

  client.on("error", (err) => {
    console.error("[sse-listener] Client error, reconnecting:", err.message);
    client.end().catch(() => {});
    setTimeout(startSseListener, RECONNECT_DELAY_MS);
  });
}
