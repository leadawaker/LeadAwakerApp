import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

/* ------------------------------------------------------------------ */
/* Context — lets other components (e.g. try-demo success) hide bubble */
/* ------------------------------------------------------------------ */

type BubbleContextValue = { setHidden: (v: boolean) => void };

export const WhatsAppBubbleContext = createContext<BubbleContextValue>({
  setHidden: () => {},
});

export function useWhatsAppBubble() {
  return useContext(WhatsAppBubbleContext);
}

/* ------------------------------------------------------------------ */
/* WhatsApp SVG icon (official chat-bubble + phone glyph, white)       */
/* ------------------------------------------------------------------ */

function WhatsAppIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="white"
      width="28"
      height="28"
      aria-hidden="true"
    >
      <path d="M20.52 3.48A11.93 11.93 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.16 1.6 5.97L0 24l6.22-1.57A11.94 11.94 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.21-1.25-6.23-3.48-8.52zM12 22c-1.85 0-3.66-.5-5.24-1.43l-.37-.22-3.84.97.99-3.73-.24-.38A9.94 9.94 0 0 1 2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10zm5.44-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.48-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.6-.91-2.19-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.08 3.18 5.04 4.46.7.3 1.25.48 1.68.62.7.22 1.34.19 1.84.12.56-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.19-.57-.34z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Inner bubble (reads hidden from context state)                      */
/* ------------------------------------------------------------------ */

function BubbleInner({ hidden }: { hidden: boolean }) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  if (hidden) return null;

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-[55] flex flex-col items-end gap-2">
      {open && (
        <div
          role="menu"
          className="mb-2 w-56 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden"
        >
          <Link
            href="/try"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#25D366] transition-colors"
            role="menuitem"
          >
            {t("bubble.tryDemo")}
          </Link>
          <a
            href={`https://wa.me/5547974002162?text=${encodeURIComponent(t("bubble.founderPrefill"))}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#25D366] transition-colors border-t border-gray-100 dark:border-gray-700"
            role="menuitem"
          >
            {t("bubble.chatFounder")}
          </a>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t("bubble.ariaClose") : t("bubble.ariaOpen")}
        aria-expanded={open}
        className="w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#20BC5A] flex items-center justify-center shadow-lg focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2 transition-colors"
      >
        <WhatsAppIcon />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Provider — wrap marketing shell so pages can toggle bubble visibility */
/* ------------------------------------------------------------------ */

export function WhatsAppBubbleProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  return (
    <WhatsAppBubbleContext.Provider value={{ setHidden }}>
      {children}
      <BubbleInner hidden={hidden} />
    </WhatsAppBubbleContext.Provider>
  );
}

/**
 * Back-compat standalone mount. No way for descendants to call setHidden,
 * since the provider only wraps BubbleInner here. For pages that need to
 * hide the bubble (e.g. /try success view), wrap the shell in
 * <WhatsAppBubbleProvider> instead.
 */
export function WhatsAppBubble() {
  return <WhatsAppBubbleProvider>{null}</WhatsAppBubbleProvider>;
}
