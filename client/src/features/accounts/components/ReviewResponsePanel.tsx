import { useState, useEffect, useCallback } from "react";
import { MessageSquareReply, Star, Link2, RefreshCw, Check, X, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import {
  startReviewsOAuth,
  fetchReviewsConnection,
  fetchReviewLocations,
  selectReviewLocation,
  disconnectReviews,
  fetchReviews,
  pollReviewsNow,
  actOnReview,
  type ReviewsConnection,
  type ReviewLocation,
  type AccountReview,
} from "../api/reviewsApi";

interface Props {
  account: Record<string, any>;
  accountId: number;
}

const readEnabled = (a: Record<string, any>) =>
  Boolean(a.enable_review_response ?? a.enableReviewResponse);
const readAutoPositive = (a: Record<string, any>) =>
  Boolean(a.review_reply_auto_positive ?? a.reviewReplyAutoPositive);

const QUEUE_STATUSES = ["new", "drafted"];

function Stars({ rating }: { rating: number | null }) {
  const r = rating ?? 0;
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= r ? "fill-primary text-primary" : "text-foreground/20"}`}
        />
      ))}
    </span>
  );
}

export default function ReviewResponsePanel({ account, accountId }: Props) {
  const { t } = useTranslation("accounts");
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(() => readEnabled(account));
  const [autoPositive, setAutoPositive] = useState(() => readAutoPositive(account));
  const [savingFlags, setSavingFlags] = useState(false);

  const [conn, setConn] = useState<ReviewsConnection | null>(null);
  const [locations, setLocations] = useState<ReviewLocation[] | null>(null);
  const [busy, setBusy] = useState(false);

  const [reviews, setReviews] = useState<AccountReview[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [actingId, setActingId] = useState<number | null>(null);

  useEffect(() => {
    setEnabled(readEnabled(account));
    setAutoPositive(readAutoPositive(account));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const loadConnection = useCallback(() => {
    fetchReviewsConnection(accountId).then(setConn).catch(() => setConn({ connected: false }));
  }, [accountId]);

  const loadReviews = useCallback(() => {
    fetchReviews(accountId, QUEUE_STATUSES)
      .then((rows) => {
        setReviews(rows);
        setDrafts(Object.fromEntries(rows.map((r) => [r.id, r.draftReply || ""])));
      })
      .catch(() => {});
  }, [accountId]);

  useEffect(() => {
    loadConnection();
    loadReviews();
  }, [loadConnection, loadReviews]);

  // Persist the two account flags together.
  const saveFlags = useCallback(async (next: { enabled?: boolean; autoPositive?: boolean }) => {
    setSavingFlags(true);
    try {
      const res = await apiFetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enable_review_response: next.enabled ?? enabled,
          review_reply_auto_positive: next.autoPositive ?? autoPositive,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ description: t("reviewResponse.saved", "Review settings saved") });
    } catch {
      toast({ description: t("reviewResponse.saveError", "Could not save settings"), variant: "destructive" });
    }
    setSavingFlags(false);
  }, [accountId, enabled, autoPositive, t, toast]);

  const onToggleEnabled = (v: boolean) => { setEnabled(v); saveFlags({ enabled: v }); };
  const onToggleAuto = (v: boolean) => { setAutoPositive(v); saveFlags({ autoPositive: v }); };

  const handleLoadLocations = async () => {
    setBusy(true);
    try {
      setLocations(await fetchReviewLocations(accountId));
    } catch (e: any) {
      toast({ description: e.message || t("reviewResponse.locationsError", "Could not load locations"), variant: "destructive" });
    }
    setBusy(false);
  };

  const handleSelectLocation = async (loc: ReviewLocation) => {
    setBusy(true);
    try {
      await selectReviewLocation(accountId, loc);
      setLocations(null);
      loadConnection();
      toast({ description: t("reviewResponse.locationSet", "Location selected") });
    } catch {
      toast({ description: t("reviewResponse.saveError", "Could not save settings"), variant: "destructive" });
    }
    setBusy(false);
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await disconnectReviews(accountId);
      setLocations(null);
      loadConnection();
    } catch { /* ignore */ }
    setBusy(false);
  };

  const handleRefresh = async () => {
    setBusy(true);
    try {
      await pollReviewsNow(accountId);
      loadReviews();
      toast({ description: t("reviewResponse.refreshed", "Checked for new reviews") });
    } catch (e: any) {
      toast({ description: e.message || t("reviewResponse.refreshError", "Could not refresh"), variant: "destructive" });
    }
    setBusy(false);
  };

  const handleAction = async (review: AccountReview, action: "approve" | "reject") => {
    setActingId(review.id);
    try {
      await actOnReview(review.id, action, drafts[review.id]);
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      toast({
        description: action === "approve"
          ? t("reviewResponse.posted", "Reply posted")
          : t("reviewResponse.skipped", "Review skipped"),
      });
    } catch (e: any) {
      toast({ description: e.message || t("reviewResponse.actionError", "Action failed"), variant: "destructive" });
    }
    setActingId(null);
  };

  const connected = conn?.connected;
  const locationSelected = conn?.locationSelected;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquareReply className="w-4 h-4 text-primary" />
        <p className="text-[18px] font-semibold font-heading text-foreground">
          {t("reviewResponse.title", "Public review response")}
        </p>
      </div>
      <p className="text-[12px] text-foreground/50 leading-relaxed -mt-2">
        {t(
          "reviewResponse.description",
          "Monitor your public Google reviews and reply to them. AI drafts a reply for every review; negative reviews always wait for your approval before posting.",
        )}
      </p>

      {/* Enable toggle */}
      <div className="flex items-center justify-between gap-3 rounded-xl bg-foreground/[0.03] border border-border/30 px-3.5 py-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground">
            {t("reviewResponse.enableLabel", "Enable public review response")}
          </p>
          <p className="text-[11px] text-foreground/40">
            {t("reviewResponse.enableHint", "Poll Google reviews and draft AI replies for this account")}
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggleEnabled} disabled={savingFlags} />
      </div>

      <div className={enabled ? "space-y-4" : "space-y-4 opacity-50 pointer-events-none"}>
        {/* Connect card */}
        <div className="rounded-xl border border-border/30 px-3.5 py-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-foreground/70">
              <Link2 className="w-3.5 h-3.5 text-foreground/40" />
              {t("reviewResponse.connectTitle", "Google Business Profile")}
            </span>
            <span className={`text-[10.5px] font-mono px-2 py-0.5 rounded-full ${connected ? "bg-emerald-500/15 text-emerald-600" : "bg-foreground/[0.06] text-foreground/40"}`}>
              {connected ? t("reviewResponse.connected", "Connected") : t("reviewResponse.notConnected", "Not connected")}
            </span>
          </div>

          {!connected && (
            <button
              onClick={() => startReviewsOAuth(accountId)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors"
            >
              {t("reviewResponse.connect", "Connect Google Business Profile")}
            </button>
          )}

          {connected && !locationSelected && (
            <div className="space-y-2">
              <p className="text-[11px] text-foreground/50">
                {t("reviewResponse.pickLocationHint", "Connected as {{email}}. Choose which location to monitor.", { email: conn?.displayName || "" })}
              </p>
              {locations === null ? (
                <button onClick={handleLoadLocations} disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-foreground/[0.06] hover:bg-foreground/10 rounded-lg transition-colors disabled:opacity-50">
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {t("reviewResponse.loadLocations", "Choose location")}
                </button>
              ) : locations.length === 0 ? (
                <p className="text-[11px] text-foreground/40">{t("reviewResponse.noLocations", "No locations found on this Google account.")}</p>
              ) : (
                <div className="space-y-1.5">
                  {locations.map((loc) => (
                    <button key={loc.name} onClick={() => handleSelectLocation(loc)} disabled={busy}
                      className="w-full text-left text-[12px] px-2.5 py-2 rounded-lg border border-border/40 hover:border-primary/50 transition-colors disabled:opacity-50">
                      {loc.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {connected && locationSelected && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-foreground/50 truncate">
                {t("reviewResponse.monitoring", "Monitoring")}: <span className="text-foreground/70">{conn?.displayName}</span>
              </p>
              <button onClick={handleDisconnect} disabled={busy}
                className="text-[11px] text-foreground/40 hover:text-destructive transition-colors">
                {t("reviewResponse.disconnect", "Disconnect")}
              </button>
            </div>
          )}
        </div>

        {/* Auto-post positives toggle */}
        <div className="flex items-center justify-between gap-3 rounded-xl bg-foreground/[0.03] border border-border/30 px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground">
              {t("reviewResponse.autoPositiveLabel", "Auto-post positive replies")}
            </p>
            <p className="text-[11px] text-foreground/40">
              {t("reviewResponse.autoPositiveHint", "Automatically post thank-you replies to 4-5 star reviews. Negatives always need approval.")}
            </p>
          </div>
          <Switch checked={autoPositive} onCheckedChange={onToggleAuto} disabled={savingFlags} />
        </div>

        {/* Approval queue */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium text-foreground/70">
              {t("reviewResponse.queueTitle", "Needs reply")}{reviews.length ? ` · ${reviews.length}` : ""}
            </p>
            <button onClick={handleRefresh} disabled={busy}
              className="inline-flex items-center gap-1 text-[11px] text-foreground/40 hover:text-foreground transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3 h-3 ${busy ? "animate-spin" : ""}`} />
              {t("reviewResponse.refresh", "Refresh")}
            </button>
          </div>

          {reviews.length === 0 ? (
            <div className="text-[12px] text-foreground/40 text-center py-6 rounded-xl border border-dashed border-border/40">
              {t("reviewResponse.allCaughtUp", "All caught up — nothing needs a reply.")}
            </div>
          ) : (
            reviews.map((review) => {
              const negative = (review.rating ?? 0) <= 3;
              return (
                <div key={review.id}
                  className={`rounded-xl border px-3.5 py-3 space-y-2 ${negative ? "border-primary/30" : "border-border/30"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-foreground truncate">{review.authorName || t("reviewResponse.anonymous", "Anonymous")}</span>
                    <Stars rating={review.rating} />
                  </div>
                  <p className="text-[12px] text-foreground/60 leading-relaxed whitespace-pre-wrap">{review.reviewText}</p>

                  {review.status === "new" ? (
                    <p className="text-[11px] text-foreground/40 italic flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {t("reviewResponse.drafting", "AI is drafting a reply…")}
                    </p>
                  ) : (
                    <>
                      <p className="text-[10.5px] font-mono uppercase tracking-wide text-foreground/35">
                        {t("reviewResponse.draftLabel", "AI draft — review before posting")}
                      </p>
                      <textarea
                        value={drafts[review.id] ?? ""}
                        onChange={(e) => setDrafts((d) => ({ ...d, [review.id]: e.target.value }))}
                        rows={3}
                        className="w-full text-[12px] bg-background border border-border/40 rounded-lg px-2.5 py-2 outline-none focus:border-primary/50 transition-colors resize-y"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleAction(review, "reject")} disabled={actingId === review.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium text-foreground/60 hover:text-foreground bg-foreground/[0.04] hover:bg-foreground/[0.08] rounded-lg transition-colors disabled:opacity-50">
                          <X className="w-3.5 h-3.5" />
                          {t("reviewResponse.skip", "Skip")}
                        </button>
                        <button onClick={() => handleAction(review, "approve")} disabled={actingId === review.id || !drafts[review.id]?.trim()}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50">
                          {actingId === review.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          {t("reviewResponse.postReply", "Post reply")}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
