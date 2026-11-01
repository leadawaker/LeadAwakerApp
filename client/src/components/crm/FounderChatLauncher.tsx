import { MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Bottom-right bubble for the "Message Gabriel" chat (a person, no AI). It uses
 * the website widget's chat symbol in black. The click is decided by the shell:
 * Gabriel gets his inbox, everyone else the chat with him. Desktop only: on mobile
 * the bottom bar and the message composer sit in that corner.
 */
export function FounderChatLauncher({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation("crm");
  const label = t("sidebar.messageFounder");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-testid="button-founder-chat-launcher"
      className="hidden md:flex items-center justify-center fixed bottom-6 right-6 z-[55] h-12 w-12 rounded-full bg-card shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ color: "var(--ink)" }}
    >
      <MessageCircle size={22} strokeWidth={2} />
    </button>
  );
}
