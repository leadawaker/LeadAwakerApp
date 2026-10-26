// Line diff of the ElevenLabs prompt draft against the live text (Voice tab, draft card).
// Longest common subsequence over lines; inside each changed run the removed lines come
// before the added ones, so a rewritten paragraph reads as "old, then new".
export type DiffLine = { kind: "same" | "add" | "del"; text: string };

const linesOf = (s: string): string[] => (s === "" ? [] : s.split("\n"));

export function lineDiff(before: string, after: string): DiffLine[] {
  const a = linesOf(before);
  const b = linesOf(after);
  // The common head and tail never need the table: prompts mostly change in one place.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);

  // lcs[i * w + j]: length of the LCS of midA[i..] and midB[j..].
  const n = midA.length, m = midB.length, w = m + 1;
  const lcs = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * w + j] = midA[i] === midB[j]
        ? lcs[(i + 1) * w + j + 1] + 1
        : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
    }
  }

  const out: DiffLine[] = a.slice(0, head).map((text) => ({ kind: "same" as const, text }));
  let dels: DiffLine[] = [];
  let adds: DiffLine[] = [];
  const flushChange = () => { out.push(...dels, ...adds); dels = []; adds = []; };
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && midA[i] === midB[j]) {
      flushChange();
      out.push({ kind: "same", text: midA[i] });
      i++; j++;
    } else if (j >= m || (i < n && lcs[(i + 1) * w + j] >= lcs[i * w + j + 1])) {
      dels.push({ kind: "del", text: midA[i] });
      i++;
    } else {
      adds.push({ kind: "add", text: midB[j] });
      j++;
    }
  }
  flushChange();
  for (const text of a.slice(a.length - tail)) out.push({ kind: "same", text });
  return out;
}

export function diffCounts(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0, removed = 0;
  for (const l of lines) {
    if (l.kind === "add") added++;
    else if (l.kind === "del") removed++;
  }
  return { added, removed };
}
