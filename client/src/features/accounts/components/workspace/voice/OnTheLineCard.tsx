// What a caller hears around her voice: the recording notice before she
// answers, the office sound under her voice, and the region the call runs in.
// All three save on change and only apply to an attached number.
import { useVoiceT } from "./voiceGender";
import { AudioLines } from "lucide-react";
import { VoiceCardShell, helpStyle } from "./voiceAtoms";
import { RecordingNoticeControl } from "./RecordingNoticeControl";
import { OfficeSoundSwitch } from "./OfficeSoundSwitch";
import { RegionSelect } from "./RegionSelect";
import type { VoiceLine, VoiceLinePatch } from "./voiceApi";

export function OnTheLineCard({ line, canEdit, saving, onSave }: {
  line: VoiceLine; canEdit: boolean; saving: boolean; onSave: (patch: VoiceLinePatch) => Promise<boolean>;
}) {
  const { t } = useVoiceT();
  return (
    <VoiceCardShell card="line" icon={<AudioLines size={17} />} title={t("line.title")}>
      <p style={{ ...helpStyle, margin: 0 }}>{t(line.number ? "line.help" : "line.needsNumber")}</p>
      {line.number && (
        <>
          <RecordingNoticeControl line={line} canEdit={canEdit} saving={saving} onSave={onSave} />
          <OfficeSoundSwitch line={line} canEdit={canEdit} saving={saving} onSave={onSave} />
          <RegionSelect line={line} canEdit={canEdit} saving={saving} onSave={onSave} />
        </>
      )}
    </VoiceCardShell>
  );
}
