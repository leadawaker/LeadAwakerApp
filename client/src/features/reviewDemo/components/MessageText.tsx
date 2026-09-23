import { DEMO_REVIEW_URL } from "../types";

/** Renders bubble text; the demo review link opens the in-page popup instead of navigating. */
export function MessageText({ text, onOpenReview }: { text: string; onOpenReview: () => void }) {
  const parts = text.split(DEMO_REVIEW_URL);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <button type="button" onClick={onOpenReview} className="break-all text-left text-[#4ea1ff] underline">
              {DEMO_REVIEW_URL.replace("https://", "")}
            </button>
          )}
        </span>
      ))}
    </span>
  );
}
