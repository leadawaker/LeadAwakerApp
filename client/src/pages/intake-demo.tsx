import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useTranslation } from "react-i18next";

type IntakeData = {
  firm_name: string;
  paralegal_name: string;
  already_submitted: boolean;
  prefill: {
    first_name: string;
    last_name: string;
    phone: string;
    incident_type: string | null;
    incident_date: string | null;
    injury_status: string | null;
    jurisdiction: string | null;
  };
};

const API_BASE = "https://webhooks.leadawaker.com";
const WHATSAPP_BACK_URL = "https://wa.me/31627458300";

const INCIDENT_TYPES = [
  "car accident",
  "slip and fall",
  "workplace",
  "medical malpractice",
  "other",
] as const;

const INJURY_STATUSES = ["in treatment", "recovered", "just starting"] as const;

export default function IntakeDemo() {
  const { t } = useTranslation("intakeDemo");
  const [, params] = useRoute("/intake/:token");
  const token = params?.token ?? "";

  const [data, setData] = useState<IntakeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [incidentType, setIncidentType] = useState<string>("");
  const [incidentDate, setIncidentDate] = useState<string>("");
  const [injuryStatus, setInjuryStatus] = useState<string>("");
  const [jurisdiction, setJurisdiction] = useState<string>("");
  const [consent, setConsent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/intake/${token}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: IntakeData = await res.json();
        if (cancelled) return;
        setData(json);
        setFirstName(json.prefill.first_name || "");
        setLastName(json.prefill.last_name || "");
        setPhone(json.prefill.phone || "");
        setIncidentType(json.prefill.incident_type || "");
        setIncidentDate(json.prefill.incident_date || "");
        setInjuryStatus(json.prefill.injury_status || "");
        setJurisdiction(json.prefill.jurisdiction || "");
        if (json.already_submitted) setSubmitted(true);
      } catch (err) {
        if (!cancelled) setErrorMsg((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/intake/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone,
          incident_type: incidentType || null,
          incident_date: incidentDate || null,
          injury_status: injuryStatus || null,
          jurisdiction: jurisdiction || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmitted(true);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const firmName = data?.firm_name || "Summit Injury Law";
  const paralegal = data?.paralegal_name || "Marcus Chen";

  return (
    <div className="relative min-h-svh w-full bg-slate-900 text-slate-100">
      <MockBackground firmName={firmName} tagline={t("header.tagline")} disclaimer={t("footer.disclaimer")} />

      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div className="relative z-10 flex min-h-svh items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-900 shadow-2xl sm:p-8">
          {loading && <LoadingState label={t("loading")} />}

          {!loading && errorMsg && !data && <ErrorState label={t("error")} />}

          {!loading && data && submitted && (
            <SuccessState
              title={t(data.already_submitted ? "alreadySubmitted.title" : "success.title")}
              body={t(data.already_submitted ? "alreadySubmitted.body" : "success.body", { paralegal })}
              back={t("success.back")}
              waUrl={WHATSAPP_BACK_URL}
            />
          )}

          {!loading && data && !submitted && (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="mb-6">
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  {firmName}
                </div>
                <h1 className="mt-1 text-xl font-semibold text-slate-900">
                  {t("modal.title")}
                </h1>
                <p className="mt-1 text-sm text-slate-600">{t("modal.subtitle")}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t("fields.first_name")}>
                  <input
                    type="text"
                    className={inputClass}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </Field>
                <Field label={t("fields.last_name")}>
                  <input
                    type="text"
                    className={inputClass}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </Field>
              </div>

              <Field label={t("fields.phone")}>
                <input
                  type="tel"
                  className={inputClass}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </Field>

              <Field label={t("fields.incident_type")}>
                <select
                  className={inputClass}
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value)}
                >
                  <option value="">—</option>
                  {INCIDENT_TYPES.map((v) => (
                    <option key={v} value={v}>
                      {t(`incidentTypes.${v}`)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("fields.incident_date")}>
                <input
                  type="date"
                  className={inputClass}
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                />
              </Field>

              <Field label={t("fields.injury_status")}>
                <div className="flex flex-col gap-2">
                  {INJURY_STATUSES.map((v) => (
                    <label key={v} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="injury_status"
                        value={v}
                        checked={injuryStatus === v}
                        onChange={() => setInjuryStatus(v)}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      {t(`injuryStatus.${v}`)}
                    </label>
                  ))}
                </div>
              </Field>

              <Field label={t("fields.jurisdiction")}>
                <input
                  type="text"
                  className={inputClass}
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                />
              </Field>

              <label className="flex items-start gap-2 pt-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-emerald-600"
                />
                <span>{t("consent")}</span>
              </label>

              <button
                type="submit"
                disabled={!consent || submitting}
                className="mt-2 w-full rounded-lg bg-[#25D366] py-3 text-base font-semibold text-white transition hover:bg-[#20BC5A] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? t("submitting") : t("submit")}
              </button>

              {errorMsg && (
                <p className="text-center text-xs text-red-600">{errorMsg}</p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-slate-500">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function ErrorState({ label }: { label: string }) {
  return (
    <div className="py-10 text-center text-sm text-slate-600">{label}</div>
  );
}

function SuccessState({
  title,
  body,
  back,
  waUrl,
}: {
  title: string;
  body: string;
  back: string;
  waUrl: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-7 w-7">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-600">{body}</p>
      <a
        href={waUrl}
        className="mt-2 inline-block rounded-lg bg-[#25D366] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#20BC5A]"
      >
        {back}
      </a>
    </div>
  );
}

function MockBackground({
  firmName,
  tagline,
  disclaimer,
}: {
  firmName: string;
  tagline: string;
  disclaimer: string;
}) {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-x-0 top-0 h-16 bg-slate-900/90 text-white">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
          <div className="text-lg font-bold tracking-wide">{firmName}</div>
          <div className="hidden gap-6 text-sm text-slate-300 sm:flex">
            <span>Practice Areas</span>
            <span>Results</span>
            <span>Contact</span>
          </div>
        </div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black" />
      <div className="absolute inset-x-0 top-40 px-6 text-center">
        <h2 className="text-3xl font-bold text-white sm:text-5xl">{firmName}</h2>
        <p className="mt-3 text-base text-slate-300 sm:text-lg">{tagline}</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 px-6 py-4 text-center text-[10px] text-slate-400">
        {disclaimer}
      </div>
    </div>
  );
}
