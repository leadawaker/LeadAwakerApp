// Meta WhatsApp Embedded Signup for the Twilio ISV (Tech Provider) program.
// These IDs are public by design: Meta's own integration embeds them in browser JS.
const META_APP_ID = import.meta.env.VITE_META_APP_ID ?? "1431602527965445";
const META_CONFIG_ID = import.meta.env.VITE_META_WHATSAPP_CONFIG_ID ?? "1116998894227763";
const PARTNER_SOLUTION_ID = import.meta.env.VITE_WHATSAPP_PARTNER_SOLUTION_ID ?? "2099802720957463";

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

let sdkReady: Promise<void> | null = null;

function loadFacebookSdk(): Promise<void> {
  if (sdkReady) return sdkReady;
  sdkReady = new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB.init({ appId: META_APP_ID, version: "v21.0" });
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.onerror = () => { sdkReady = null; reject(new Error("Could not load Facebook SDK")); };
    document.body.appendChild(script);
  });
  return sdkReady;
}

export const embeddedSignupConfigured = !!META_APP_ID;

/** Opens Meta's Embedded Signup popup; resolves with the WhatsApp Business Account it connected. */
export async function launchWhatsAppEmbeddedSignup(): Promise<{ wabaId: string; phoneNumberId: string }> {
  if (!META_APP_ID) throw new Error("Meta App ID is not configured (VITE_META_APP_ID)");
  await loadFacebookSdk();

  return new Promise((resolve, reject) => {
    let finished = false;
    const onMessage = (event: MessageEvent) => {
      if (!/(^|\.)facebook\.com$/.test(new URL(event.origin).hostname)) return;
      let msg: any;
      try { msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
      if (msg?.type !== "WA_EMBEDDED_SIGNUP") return;
      window.removeEventListener("message", onMessage);
      if (msg.event === "FINISH" && msg.data?.waba_id) {
        finished = true;
        resolve({ wabaId: msg.data.waba_id, phoneNumberId: msg.data.phone_number_id });
      } else {
        reject(new Error(msg.data?.error_message || "WhatsApp signup was not completed"));
      }
    };
    window.addEventListener("message", onMessage);

    window.FB.login(
      (response: any) => {
        // FB.login's callback fires when the popup closes; FINISH arrives via postMessage just before.
        setTimeout(() => {
          if (finished) return;
          window.removeEventListener("message", onMessage);
          if (!response?.authResponse) reject(new Error("WhatsApp signup was cancelled"));
        }, 1500);
      },
      { config_id: META_CONFIG_ID, extras: { setup: { solutionID: PARTNER_SOLUTION_ID } } },
    );
  });
}

// ── Direct onboarding on Lead Awaker's own app (Tech Provider, no Twilio) ──────
// The config is "WhatsApp Business app onboarding" (coexistence): the client's
// number stays on the WhatsApp Business app on their phone and also works
// through the Cloud API. Meta answers twice: the session details by postMessage
// (which account and number were shared) and a short-lived code in FB.login's
// callback, which the server exchanges for the client's token.
const META_COEX_CONFIG_ID = import.meta.env.VITE_META_WHATSAPP_COEX_CONFIG_ID ?? "1438404178389195";
const FINISH_EVENTS = ["FINISH", "FINISH_ONLY_WABA", "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"];

export interface WhatsAppConnectResult { code: string; wabaId: string; phoneNumberId: string | null }

/**
 * "app": the client's number stays on their WhatsApp Business app (coexistence).
 * "new": a number that only the Cloud API uses; Meta verifies it in the window.
 * Same Meta configuration for both: the mode is the featureType passed here.
 */
export type WhatsAppConnectMode = "app" | "new";

export async function launchWhatsAppConnect(mode: WhatsAppConnectMode): Promise<WhatsAppConnectResult> {
  if (!META_APP_ID) throw new Error("Meta App ID is not configured (VITE_META_APP_ID)");
  await loadFacebookSdk();

  return new Promise((resolve, reject) => {
    let session: { wabaId: string; phoneNumberId: string | null } | null = null;
    let failure: string | null = null;
    const onMessage = (event: MessageEvent) => {
      let host = "";
      try { host = new URL(event.origin).hostname; } catch { return; }
      if (!/(^|\.)facebook\.com$/.test(host)) return;
      let msg: any;
      try { msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
      if (msg?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (FINISH_EVENTS.includes(msg.event) && msg.data?.waba_id) {
        session = { wabaId: String(msg.data.waba_id), phoneNumberId: msg.data.phone_number_id ? String(msg.data.phone_number_id) : null };
      } else if (msg.event === "ERROR") {
        failure = msg.data?.error_message || null;
      }
    };
    window.addEventListener("message", onMessage);

    window.FB.login(
      (response: any) => {
        // The session message can land just after the popup closes.
        setTimeout(() => {
          window.removeEventListener("message", onMessage);
          const code = response?.authResponse?.code;
          if (code && session) resolve({ code, ...session });
          else if (!code) reject(new Error(failure || "WhatsApp signup was cancelled"));
          else reject(new Error(failure || "WhatsApp signup was not completed"));
        }, 1500);
      },
      {
        config_id: META_COEX_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          sessionInfoVersion: "3",
          ...(mode === "app" ? { featureType: "whatsapp_business_app_onboarding" } : {}),
        },
      },
    );
  });
}
