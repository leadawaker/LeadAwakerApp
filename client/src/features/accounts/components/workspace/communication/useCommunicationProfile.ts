import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiUtils";
import { EMPTY_ANSWERS, type ProfileAnswers } from "./profileConstants";

export type ProfileStatus = "draft" | "in_progress" | "completed";

export interface CommunicationProfile {
  answers: ProfileAnswers;
  status: ProfileStatus;
}

// ── API (DB-keyed JSON) ⇄ model mapping ──────────────────────────────────────
// The account routes serialize rows with DB column names (toDbKeys/fromDbKeys),
// so we translate to/from the wizard's camelCase answer shape here.
function fromApi(raw: any): CommunicationProfile {
  if (!raw) return { answers: { ...EMPTY_ANSWERS }, status: "draft" };
  return {
    status: (raw.status as ProfileStatus) ?? "draft",
    answers: {
      openingStyle: raw.opening_style ?? null,
      addressForm: raw.address_form ?? null,
      statusQuestion: raw.status_question ?? null,
      brandFeel: raw.brand_feel ?? null,
      contactApproach: raw.contact_approach ?? null,
      distinctive: Array.isArray(raw.distinctive) ? raw.distinctive : [],
      distinctiveOther: raw.distinctive_other ?? "",
      preferredWords: raw.preferred_words && typeof raw.preferred_words === "object" ? raw.preferred_words : {},
      formality: raw.formality ?? null,
      perception: Array.isArray(raw.perception) ? raw.perception : [],
      agentName: raw.agent_name ?? null,
      agentNameNote: raw.agent_name_note ?? "",
    },
  };
}

function toApi(answers: ProfileAnswers, status: ProfileStatus) {
  return {
    opening_style: answers.openingStyle,
    address_form: answers.addressForm,
    status_question: answers.statusQuestion,
    brand_feel: answers.brandFeel,
    contact_approach: answers.contactApproach,
    distinctive: answers.distinctive,
    distinctive_other: answers.distinctiveOther || null,
    preferred_words: answers.preferredWords,
    formality: answers.formality,
    perception: answers.perception,
    agent_name: answers.agentName,
    agent_name_note: answers.agentNameNote || null,
    status,
  };
}

export function useCommunicationProfile(accountId: number) {
  const [profile, setProfile] = useState<CommunicationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/accounts/${accountId}/communication-profile`);
      if (res.ok) setProfile(fromApi(await res.json()));
    } catch { /* non-fatal */ }
    setLoading(false);
  }, [accountId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const save = useCallback(async (answers: ProfileAnswers, status: ProfileStatus) => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/accounts/${accountId}/communication-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toApi(answers, status)),
      });
      if (res.ok) setProfile(fromApi(await res.json()));
      return res.ok;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, [accountId]);

  return { profile, loading, saving, save };
}
