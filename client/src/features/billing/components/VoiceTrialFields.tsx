import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { VoiceTrialFields as Fields } from "../utils/voiceTrialTemplate";

const LABEL = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export function VoiceTrialFields({ value, onChange }: { value: Fields; onChange: (patch: Partial<Fields>) => void }) {
  const { t } = useTranslation("billing");
  const field = (key: keyof Fields) => (
    <div className="space-y-1.5" key={key}>
      <Label className={LABEL}>{t(`contracts.form.voiceTrial.${key}`)}</Label>
      <Input value={value[key]} onChange={(e) => onChange({ [key]: e.target.value })} />
    </div>
  );
  return (
    <>
      {field("legalName")}
      {field("kvkNumber")}
      {field("address")}
      {field("website")}
      <div className="grid grid-cols-2 gap-3">
        {field("monthlyEstimate")}
        {field("monthlyCap")}
      </div>
    </>
  );
}
