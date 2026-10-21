// Videos added to the upgrade panel: each is sent to the server one after the other (the server works
// on one video per user at a time) and comes back as a transcript. Only the text stays, in memory.
import { useRef, useState } from "react";
import { SocialApiError } from "../../../api/socialApi";
import { transcribeUpgradeVideo } from "./upgradeApi";

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export interface VideoItem {
  key: string;
  name: string;
  status: "waiting" | "working" | "done" | "error";
  text?: string;
  reason?: string;
}

export function useVideoTranscripts(accountId: number) {
  const [items, setItems] = useState<VideoItem[]>([]);
  const queue = useRef<{ key: string; file: File }[]>([]);
  const running = useRef(false);
  const seq = useRef(0);

  const patch = (key: string, p: Partial<VideoItem>) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...p } : it)));

  async function drain() {
    if (running.current) return;
    running.current = true;
    try {
      for (let next = queue.current.shift(); next; next = queue.current.shift()) {
        patch(next.key, { status: "working" });
        try {
          const { text } = await transcribeUpgradeVideo(accountId, next.file);
          patch(next.key, { status: "done", text });
        } catch (err) {
          patch(next.key, { status: "error", reason: err instanceof SocialApiError ? err.reason : "failed" });
        }
      }
    } finally {
      running.current = false;
    }
  }

  function add(files: FileList | File[]) {
    const fresh: VideoItem[] = [];
    for (const file of Array.from(files)) {
      const key = `v${++seq.current}`;
      if (file.size > MAX_VIDEO_BYTES) {
        fresh.push({ key, name: file.name, status: "error", reason: "size" });
        continue;
      }
      fresh.push({ key, name: file.name, status: "waiting" });
      queue.current.push({ key, file });
    }
    setItems((list) => [...list, ...fresh]);
    void drain();
  }

  function remove(key: string) {
    queue.current = queue.current.filter((q) => q.key !== key);
    setItems((list) => list.filter((it) => it.key !== key));
  }

  const transcripts = items.filter((it) => it.status === "done" && it.text).map((it) => it.text as string);
  const busy = items.some((it) => it.status === "waiting" || it.status === "working");
  return { items, add, remove, transcripts, busy };
}
