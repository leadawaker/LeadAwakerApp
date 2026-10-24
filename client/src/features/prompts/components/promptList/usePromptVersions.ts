// Version history of the selected prompt: list, save a new version, load an
// old one into the editor (keeping a snapshot to revert to), delete one.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import type { PromptVersion } from "../../types";

type Snapshot = { promptText: string | null; systemMessage: string | null; notes: string | null };

function snapshotOf(p: any): Snapshot {
  return {
    promptText: p?.promptText || p?.prompt_text || null,
    systemMessage: p?.systemMessage || p?.system_message || null,
    notes: p?.notes || null,
  };
}

export function usePromptVersions(
  selectedId: number | null,
  selectedPrompt: any,
  setSelectedPrompt: (updater: (prev: any) => any) => void,
) {
  const { t } = useTranslation("prompts");
  const { toast } = useToast();
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [versionOverride, setVersionOverride] = useState<PromptVersion | null>(null);
  const [liveSnap, setLiveSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    setVersions([]);
    setSelectedVersion("");
    setVersionOverride(null);
    setLiveSnap(null);
    if (!selectedId) return;
    setVersionsLoading(true);
    apiFetch(`/api/prompts/${selectedId}/versions`)
      .then((r) => r.json())
      .then((data) => setVersions(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setVersionsLoading(false));
  }, [selectedId]);

  async function saveVersion(bumpType: "minor" | "major", label: string) {
    if (!selectedId) return;
    setSavingVersion(true);
    try {
      const res = await apiFetch(`/api/prompts/${selectedId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bumpType, ...snapshotOf(selectedPrompt), label: label || null }),
      });
      if (!res.ok) throw new Error("Failed");
      const newVersion: PromptVersion = await res.json();
      setVersions((prev) => [newVersion, ...prev]);
      setSelectedPrompt((prev: any) => (prev ? { ...prev, version: newVersion.versionNumber } : prev));
      toast({ title: t("versions.saved"), description: `v${newVersion.versionNumber}` });
    } catch {
      toast({ title: t("versions.saveFailed"), variant: "destructive" });
    } finally {
      setSavingVersion(false);
    }
  }

  function loadVersion(v: PromptVersion) {
    if (!liveSnap) setLiveSnap(snapshotOf(selectedPrompt));
    setSelectedVersion(v.versionNumber);
    setVersionOverride(v);
    toast({ title: t("versions.loaded"), description: `v${v.versionNumber}` });
  }

  function revertToCurrent() {
    if (!liveSnap || !selectedId) return;
    setVersionOverride({
      id: -1, promptsId: selectedId,
      versionNumber: "", savedAt: "", savedBy: null, label: null,
      ...liveSnap,
    });
    setSelectedVersion("");
    setLiveSnap(null);
    toast({ title: t("versions.reverted") });
  }

  async function deleteVersion(versionId: number) {
    const target = versions.find((v) => v.id === versionId);
    const res = await apiFetch(`/api/prompts/${selectedId}/versions/${versionId}`, { method: "DELETE" });
    if (!res.ok) return toast({ title: t("versions.deleteFailed"), variant: "destructive" });
    setVersions((prev) => prev.filter((v) => v.id !== versionId));
    if (target && selectedVersion === target.versionNumber) {
      setSelectedVersion("");
      setVersionOverride(null);
    }
    toast({ title: t("versions.deleted") });
  }

  return {
    versions, versionsLoading, savingVersion, selectedVersion, versionOverride, liveSnap,
    saveVersion, loadVersion, revertToCurrent, deleteVersion,
  };
}

export type PromptVersionsState = ReturnType<typeof usePromptVersions>;
