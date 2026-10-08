// Unwanted calls (engine call_screening.py): one switch per kind she turns
// away, plus the numbers blocked for abuse on this line, each liftable.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldBan, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { VoiceCardShell, FieldLabel, helpStyle } from "./voiceAtoms";
import {
  SCREENING_KINDS, blockedKey, fetchBlockedCallers, unblockCaller,
  type ScreeningKind, type VoiceLine, type VoiceLinePatch,
} from "./voiceApi";

export function UnwantedCallsCard({ line, canEdit, saving, onSave }: {
  line: VoiceLine; canEdit: boolean; saving: boolean; onSave: (patch: VoiceLinePatch) => Promise<boolean>;
}) {
  const { t, i18n } = useTranslation("voiceTab");
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const blocked = useQuery({
    queryKey: blockedKey(line.accountId),
    queryFn: () => fetchBlockedCallers(line.accountId),
    staleTime: 30 * 1000,
  });
  const unblock = useMutation({
    mutationFn: (blockId: number) => unblockCaller(line.accountId, blockId),
    onSuccess: () => qc.invalidateQueries({ queryKey: blockedKey(line.accountId) }),
    onError: () => setError(t("common.saveFailed")),
  });

  const flip = async (kind: ScreeningKind, on: boolean) => {
    setError(null);
    if (!(await onSave({ screening: { [kind]: on } }))) setError(t("common.saveFailed"));
  };
  const until = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { day: "numeric", month: "short" });

  return (
    <VoiceCardShell card="screening" icon={<ShieldBan size={17} />} title={t("screening.title")}>
      <p style={helpStyle}>{t("screening.help")}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {SCREENING_KINDS.map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <Switch checked={line.screening?.[k] ?? true} onCheckedChange={(v) => flip(k, v)}
              disabled={!canEdit || saving} aria-label={t(`screening.${k}.label`)} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: "var(--ink)", fontWeight: 600 }}>{t(`screening.${k}.label`)}</div>
              <div style={{ ...helpStyle, margin: "2px 0 0" }}>{t(`screening.${k}.help`)}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        <FieldLabel>{t("screening.blocked.label")}</FieldLabel>
        {blocked.isLoading ? (
          <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute-2)" }} />
        ) : (blocked.data ?? []).length === 0 ? (
          <p style={{ ...helpStyle, margin: 0 }}>{t("screening.blocked.empty")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(blocked.data ?? []).map((b) => (
              <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 13.5, color: "var(--ink)" }}>{b.phone}</span>
                <span style={{ fontSize: 12.5, color: "var(--mute)" }}>
                  {t("screening.blocked.until", { date: until(b.blockedUntil) })}
                </span>
                {canEdit && (
                  <button type="button" className="la-btn la-btn--soft" onClick={() => unblock.mutate(b.id)}
                    disabled={unblock.isPending}>
                    {t("screening.blocked.unblock")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {error && <p role="alert" style={{ ...helpStyle, margin: "12px 0 0", color: "var(--stage-lost)" }}>{error}</p>}
    </VoiceCardShell>
  );
}
