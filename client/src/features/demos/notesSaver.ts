// The notes field's save logic, apart from React so its ordering can be tested. Pure.

export interface NotesSaver {
  /** The text now in the field. */
  set: (text: string) => void;
  /** Sends the text if it differs from what was last sent. Resolves once this and every earlier send has finished; never rejects. */
  save: () => Promise<void>;
  /** Counts the current text as saved, so a later `save` sends nothing (used right before the prospect is deleted). */
  discard: () => void;
}

/**
 * Sends of one prospect's notes, one after another: a send still in flight lands before the next
 * one starts, and before whatever awaits `save` (a delete, which must not be overtaken by a note
 * that would recreate the prospect's row). A failed send is reported through `onError` and the
 * text counts as unsent, so the next `save` tries it again.
 */
export function createNotesSaver(
  initial: string,
  { send, onError }: { send: (text: string) => Promise<void>; onError: (error: unknown) => void },
): NotesSaver {
  let saved = initial;
  let latest = initial;
  let queue: Promise<void> = Promise.resolve();

  return {
    set: (text) => {
      latest = text;
    },
    save: () => {
      const text = latest;
      if (text === saved) return queue;
      const before = saved;
      saved = text;
      queue = queue.then(async () => {
        try {
          await send(text);
        } catch (e) {
          saved = before;
          onError(e);
        }
      });
      return queue;
    },
    discard: () => {
      saved = latest;
    },
  };
}
