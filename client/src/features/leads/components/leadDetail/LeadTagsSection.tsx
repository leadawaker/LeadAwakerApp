// Lead tags section (chips + add/remove dropdown) for the Lead detail panel.
// JSX moved verbatim from LeadDetailPanel.tsx; props are named to match the
// original local variables so the markup is unchanged (structural split).
import React from "react";
import { useTranslation } from "react-i18next";
import { Loader2, X, Plus, Tag } from "lucide-react";
import { SectionTitle } from "./atoms";
import type { TagData } from "./types";

interface LeadTagsSectionProps {
  loadingTags: boolean;
  leadTags: TagData[];
  availableTags: TagData[];
  unassignedTags: TagData[];
  removingTagId: number | null;
  addingTag: boolean;
  showTagDropdown: boolean;
  setShowTagDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  handleAddTag: (tag: TagData) => void;
  handleRemoveTag: (tagId: number) => void;
}

export function LeadTagsSection({
  loadingTags,
  leadTags,
  availableTags,
  unassignedTags,
  removingTagId,
  addingTag,
  showTagDropdown,
  setShowTagDropdown,
  handleAddTag,
  handleRemoveTag,
}: LeadTagsSectionProps) {
  const { t } = useTranslation("leads");
  return (
    <>
          <SectionTitle icon={<Tag className="h-3.5 w-3.5" />} title={t("detail.sections.tags")} />
          <div
            className="rounded-xl border border-border/40 bg-muted/20 px-3 py-3"
            data-testid="lead-detail-tags-section"
          >
            {loadingTags ? (
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("tags.loadingTags")}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5" data-testid="lead-tags-chips">
                {/* Existing tag chips */}
                {leadTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/20"
                    data-testid={`lead-tag-chip-${tag.id}`}
                    data-tag-id={tag.id}
                    data-tag-name={tag.name}
                  >
                    <Tag className="h-2.5 w-2.5 shrink-0" />
                    {tag.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag.id)}
                      disabled={removingTagId === tag.id}
                      className="ml-0.5 rounded-full hover:bg-violet-500/20 transition-colors disabled:opacity-50"
                      aria-label={t("tags.removeTag", { name: tag.name })}
                      data-testid={`lead-tag-remove-${tag.id}`}
                    >
                      {removingTagId === tag.id
                        ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        : <X className="h-2.5 w-2.5" />
                      }
                    </button>
                  </span>
                ))}

                {/* Add tag button + dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTagDropdown((v) => !v)}
                    disabled={addingTag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-dashed border-black/[0.125] text-muted-foreground hover:text-foreground hover:border-black/[0.175] transition-colors disabled:opacity-50"
                    data-testid="lead-tag-add-button"
                    aria-label={t("tags.addTag")}
                  >
                    {addingTag
                      ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      : <Plus className="h-2.5 w-2.5" />
                    }
                    {t("tags.addTag")}
                  </button>

                  {/* Tag selection dropdown */}
                  {showTagDropdown && (
                    <div
                      className="absolute left-0 top-7 z-50 min-w-[160px] max-w-[calc(100vw-2rem)] max-h-[200px] overflow-y-auto rounded-xl border border-border bg-popover shadow-lg py-1"
                      data-testid="lead-tag-dropdown"
                    >
                      {unassignedTags.length === 0 ? (
                        <div className="px-3 py-2 text-[12px] text-muted-foreground">
                          {availableTags.length === 0 ? t("tags.noTagsAvailable") : t("tags.allTagsAssigned")}
                        </div>
                      ) : (
                        unassignedTags.map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => handleAddTag(tag)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left hover:bg-muted/50 transition-colors"
                            data-testid={`lead-tag-option-${tag.id}`}
                          >
                            <Tag className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="truncate">{tag.name}</span>
                            {tag.category && (
                              <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{tag.category}</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {leadTags.length === 0 && !showTagDropdown && (
                  <span className="text-[12px] text-muted-foreground italic">{t("tags.noTagsAssigned")}</span>
                )}
              </div>
            )}
          </div>
    </>
  );
}
