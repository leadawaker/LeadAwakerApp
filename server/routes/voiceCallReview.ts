import type { Express, Request } from "express";
import { storage } from "../storage";
import { requireAuth, scopeToAccount } from "../auth";
import { wrapAsync } from "./_helpers";
import { resolveVoiceAccess } from "./voiceCallsAccess";
import { respondReview } from "./voiceCallReviewView";
import { loadCallReview } from "../storage/voiceCallReview";

const guards = [requireAuth, scopeToAccount];

function accessOf(req: Request) {
  const user = req.user!;
  return resolveVoiceAccess({
    role: user.role,
    accountsId: user.accountsId ?? null,
    impersonatedAccountId: req.session?.impersonation?.accountId ?? null,
    impersonatedRole: req.session?.impersonation?.role ?? null,
  });
}

/**
 * The call review (waveform, tool markers, reply delays, cost) for a call, in one shape for
 * both engines (storage/voiceCallReview.ts): the test panel's review and the Calls page's
 * call detail. Open to anyone who may open the call on the Calls page; what each viewer
 * sees (tool details agency only, cost Owner only) is voiceCallReviewView.ts.
 */
export function registerVoiceCallReviewRoutes(app: Express): void {
  app.get("/api/voice-calls/:callId/review", ...guards, wrapAsync(async (req, res) => {
    const out = await respondReview(
      accessOf(req),
      String(req.params.callId),
      (callId, opts) => storage.getVoiceCall(callId, opts),
      loadCallReview,
    );
    res.status(out.status).json(out.body);
  }));
}
