import { useTranslation } from "react-i18next";
import { HelpCircle, X, Plus } from "lucide-react";
import { InfoRow } from "../formFields";

/**
 * Objection playbook: up to 5 owner-approved objection/answer pairs, injected
 * into the AI's system prompt (Part 3 of the trust-kit spec; the engine reads
 * `objection_playbook` in conversation/prompt_builder.py).
 *
 * Lifted out of BusinessSectionFields so Chats > Settings > Advanced edits the
 * receptionist campaign's playbook with the same rows.
 */

// Distinct example objections per row (price / competitor / stalling) so the
// playbook demonstrates its range instead of repeating the same example 3x.
const OBJECTION_PLACEHOLDER_KEYS = [
  "config.objectionPlaceholder",
  "config.objectionPlaceholder2",
  "config.objectionPlaceholder3",
  "config.objectionPlaceholder4",
  "config.objectionPlaceholder5",
] as const;

const MAX_OBJECTIONS = 5;

type ObjectionRow = { objection: string; answer: string };

interface ObjectionPlaybookFieldProps {
  campaign: any;
  draft: Record<string, unknown>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  /** Read-only: the rows show but cannot change. */
  disabled?: boolean;
}

export function ObjectionPlaybookField({ campaign, draft, setDraft, disabled = false }: ObjectionPlaybookFieldProps) {
  const { t } = useTranslation("campaigns");

  const objectionRows = (): ObjectionRow[] => {
    const raw = (draft.objection_playbook ?? campaign.objection_playbook) as ObjectionRow[] | undefined;
    return raw && raw.length > 0 ? raw : [{ objection: "", answer: "" }];
  };
  const updateObjectionRow = (idx: number, patch: Partial<ObjectionRow>) => {
    const rows = [...objectionRows()];
    rows[idx] = { ...rows[idx], ...patch };
    setDraft(d => ({ ...d, objection_playbook: rows }));
  };
  const addObjectionRow = () => {
    const rows = objectionRows();
    if (rows.length >= MAX_OBJECTIONS) return;
    setDraft(d => ({ ...d, objection_playbook: [...rows, { objection: "", answer: "" }] }));
  };
  const removeObjectionRow = (idx: number) => {
    const rows = objectionRows().filter((_, i) => i !== idx);
    setDraft(d => ({ ...d, objection_playbook: rows.length > 0 ? rows : [{ objection: "", answer: "" }] }));
  };

  return (
    <InfoRow icon={HelpCircle} label={t("config.objectionPlaybook")} value={null}
      editChild={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md, 12px)' }}>
          {objectionRows().map((row, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
              <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, fontWeight: 600, color: 'var(--mute-2)' }}>
                {t("config.objectionLabel", { n: idx + 1 })}
              </span>
              <div className="neu-inset-crisp" style={{ borderRadius: 'var(--r-button)', overflow: 'hidden', position: 'relative' }}>
                <input
                  value={row.objection}
                  onChange={(e) => updateObjectionRow(idx, { objection: e.target.value.slice(0, 500) })}
                  placeholder={t(OBJECTION_PLACEHOLDER_KEYS[idx])}
                  disabled={disabled}
                  style={{
                    width: '100%', padding: '9px 13px', fontSize: 13, fontFamily: 'inherit',
                    border: 'none', background: 'transparent', color: 'var(--ink-soft)',
                    borderBottom: '1px solid var(--line)',
                  }}
                />
                <textarea
                  value={row.answer}
                  onChange={(e) => updateObjectionRow(idx, { answer: e.target.value.slice(0, 500) })}
                  rows={2}
                  placeholder={t("config.answerPlaceholder")}
                  disabled={disabled}
                  style={{
                    width: '100%', padding: '9px 13px', fontSize: 13, fontFamily: 'inherit',
                    border: 'none', background: 'transparent', color: 'var(--ink-soft)',
                    resize: 'none', display: 'block',
                  }}
                />
                {idx > 0 && !disabled && (
                  <button
                    type="button"
                    onClick={() => removeObjectionRow(idx)}
                    className="la-btn la-btn--soft la-btn--icon"
                    title={t("config.objectionRemove")}
                    aria-label={t("config.objectionRemove")}
                    style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22 }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {objectionRows().length < MAX_OBJECTIONS && !disabled && (
            <button type="button" className="la-btn la-btn--inset" style={{ alignSelf: 'flex-start' }} onClick={addObjectionRow}>
              <Plus size={13} />{t("config.objectionAdd")}
            </button>
          )}
        </div>
      }
    />
  );
}
