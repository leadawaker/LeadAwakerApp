// Every Voice tab editor that saves as you type (useAutosave) registers its flush
// here, so starting a test call can first wait for anything still in the debounce
// window or mid-save: the call then runs on the saved prompt (specs/voice-test-panel).
// Module-level on purpose: the editors and the test panel sit in different subtrees.

type Flush = () => Promise<void>;

const flushes = new Set<Flush>();

/** Adds a flush; the returned function removes it again (call it on unmount). */
export function registerFlush(fn: Flush): () => void {
  flushes.add(fn);
  return () => { flushes.delete(fn); };
}

/** How long a test call waits for the saves before it starts anyway. */
export const FLUSH_TIMEOUT_MS = 5_000;

/**
 * Runs every registered flush at once and resolves when all have settled, or after
 * `timeoutMs` so a hung save never blocks a start. A failed save never rejects this.
 */
export async function flushAllAutosaves({ timeoutMs = FLUSH_TIMEOUT_MS }: { timeoutMs?: number } = {}): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => { timer = setTimeout(resolve, timeoutMs); });
  try {
    await Promise.race([Promise.allSettled([...flushes].map((fn) => fn())), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
