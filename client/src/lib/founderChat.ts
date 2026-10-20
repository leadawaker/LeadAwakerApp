/** Opens the founder chat panel, optionally with a draft message already in the input (never sent for the user). */
export function openFounderChat(draft?: string): void {
  window.dispatchEvent(new CustomEvent("open-founder-chat", { detail: { draft } }));
}
