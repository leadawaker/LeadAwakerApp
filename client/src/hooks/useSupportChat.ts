import { useState, useCallback, useRef, useEffect } from "react";
import { apiFetch } from "@/lib/apiUtils";
import i18n from "@/i18n";

export interface SupportChatMessage {
  id?: number;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
}

interface SupportSession {
  id: number;
  sessionId: string;
  userId: number;
  accountId: number | null;
  status: "active" | "escalated" | "closed";
  createdAt: string;
}

export interface SupportBotConfig {
  name: string;
  photoUrl: string | null;
  enabled: boolean;
}

const DEFAULT_BOT_CONFIG: SupportBotConfig = {
  name: "Tom",
  photoUrl: null,
  enabled: true,
};

const BOT_CONFIG_CACHE_KEY = "support-bot-config";

function loadCachedBotConfig(): SupportBotConfig | null {
  try {
    const raw = localStorage.getItem(BOT_CONFIG_CACHE_KEY);
    if (raw) return { ...DEFAULT_BOT_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return null;
}

function saveBotConfigCache(cfg: SupportBotConfig) {
  try {
    localStorage.setItem(BOT_CONFIG_CACHE_KEY, JSON.stringify(cfg));
    window.dispatchEvent(new CustomEvent("support-bot-config-changed"));
  } catch {}
}

export function useSupportChat() {
  const [session, setSession] = useState<SupportSession | null>(null);
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [botConfig, setBotConfig] = useState<SupportBotConfig>(() => {
    return loadCachedBotConfig() ?? DEFAULT_BOT_CONFIG;
  });
  // Ref so callbacks (sendMessage, initialize, clearContext) always see the current name
  const botConfigRef = useRef<SupportBotConfig>(loadCachedBotConfig() ?? DEFAULT_BOT_CONFIG);
  useEffect(() => { botConfigRef.current = botConfig; }, [botConfig]);

  const [unreadCount, setUnreadCount] = useState(0);
  const initializedRef = useRef(false);
  const isOpenRef = useRef(false);

  // Sync botConfig across multiple hook instances (floating widget ↔ Conversations page)
  useEffect(() => {
    const handler = () => {
      const cached = loadCachedBotConfig();
      if (cached) {
        setBotConfig(cached);
        botConfigRef.current = cached;
      }
    };
    window.addEventListener("support-bot-config-changed", handler);
    return () => window.removeEventListener("support-bot-config-changed", handler);
  }, []);

  /** Mark all messages as read (resets unread badge) */
  const markAsRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  /** Called by Topbar when the widget opens/closes. Also marks as read on open. */
  const notifyOpen = useCallback((isOpen: boolean) => {
    isOpenRef.current = isOpen;
    if (isOpen) {
      setUnreadCount(0);
    }
  }, []);

  /** Create or resume a session + load history + fetch bot config */
  const initialize = useCallback(async () => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    setLoading(true);
    try {
      // Fetch bot config from account settings
      try {
        const cfgRes = await apiFetch("/api/support-chat/config");
        if (cfgRes.ok) {
          const cfg = await cfgRes.json();
          if (cfg && (cfg.name || cfg.photoUrl !== undefined)) {
            // API is source of truth — overrides localStorage cache
            const merged = { ...DEFAULT_BOT_CONFIG, ...cfg };
            setBotConfig(merged);
            saveBotConfigCache(merged);
          }
        }
        // If API fails, already initialized from localStorage in useState initializer
      } catch {
        // Use cached value from useState initializer
      }

      // Create or get active session — include botName so backend can use it in system prompt
      const sessionRes = await apiFetch("/api/support-chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botName: botConfigRef.current.name }),
      });
      if (!sessionRes.ok) throw new Error("Failed to create session");
      const sess: SupportSession = await sessionRes.json();
      setSession(sess);
      setEscalated(sess.status === "escalated");

      // Load existing messages
      const msgsRes = await apiFetch(`/api/support-chat/messages/${sess.sessionId}`);
      if (msgsRes.ok) {
        const msgs: SupportChatMessage[] = await msgsRes.json();
        setMessages(msgs);
      }
    } catch (err) {
      console.error("[SupportChat] Init error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Send a message and get AI response — handles auto-escalation */
  const sendMessage = useCallback(async (content: string) => {
    if (!session || sending) return;
    const trimmed = content.trim();
    if (!trimmed) return;

    // Optimistic: add user message immediately
    const optimisticMsg: SupportChatMessage = {
      sessionId: session.sessionId,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setSending(true);

    try {
      const res = await apiFetch("/api/support-chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId, content: trimmed, botName: botConfigRef.current.name, language: i18n.language?.split("-")[0] || "en" }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();

      // Replace optimistic message with real ones
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m !== optimisticMsg);
        const newMsgs = [data.userMessage, data.assistantMessage];
        // If auto-escalation happened, include the system escalation message too
        if (data.escalationMessage) newMsgs.push(data.escalationMessage);
        return [...withoutOptimistic, ...newMsgs];
      });

      // If widget is not open, increment unread count for the assistant reply
      if (!isOpenRef.current) {
        setUnreadCount((n) => n + 1);
      }

      // Handle auto-escalation triggered by AI
      if (data.escalated) {
        setEscalated(true);
      }
    } catch (err) {
      console.error("[SupportChat] Send error:", err);
      setMessages((prev) => [
        ...prev,
        {
          sessionId: session.sessionId,
          role: "assistant",
          content: "Something went wrong. Please try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
      // Count error reply as unread too if widget is closed
      if (!isOpenRef.current) {
        setUnreadCount((n) => n + 1);
      }
    } finally {
      setSending(false);
    }
  }, [session, sending]);

  /** Escalate to human agent (kept for programmatic use) */
  const escalate = useCallback(async () => {
    if (!session) return;
    try {
      const res = await apiFetch("/api/support-chat/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
      if (!res.ok) throw new Error("Failed to escalate");
      setEscalated(true);

      const msgsRes = await apiFetch(`/api/support-chat/messages/${session.sessionId}`);
      if (msgsRes.ok) {
        const msgs: SupportChatMessage[] = await msgsRes.json();
        setMessages(msgs);
      }
    } catch (err) {
      console.error("[SupportChat] Escalation error:", err);
    }
  }, [session]);

  /** Update bot config (name/photo) and persist via API + localStorage */
  const updateBotConfig = useCallback(async (updates: Partial<SupportBotConfig>) => {
    const prevName = botConfigRef.current.name;
    // Build the full merged config — never send partial updates or the backend
    // resets missing fields to defaults (e.g. photoUrl → null, name → "Tom")
    const full = { ...botConfigRef.current, ...updates };

    // Update locally + cache immediately
    setBotConfig(full);
    saveBotConfigCache(full);

    // Sync full config to server
    try {
      await apiFetch("/api/support-chat/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(full),
      });
    } catch (err) {
      console.error("[SupportChat] Config update error:", err);
    }

    // If name changed, also update the Prompt Library system message so the AI uses the new name
    if (updates.name && updates.name !== prevName) {
      try {
        const promptsRes = await apiFetch("/api/prompts");
        if (promptsRes.ok) {
          const raw = await promptsRes.json();
          const list: any[] = Array.isArray(raw) ? raw : (raw.items ?? raw.data ?? []);
          const botPrompt = list.find((p: any) =>
            (p.name || p.Name) === "Lead Awaker Support Bot"
          );
          if (botPrompt) {
            const promptId = botPrompt.id || botPrompt.Id;
            const oldMsg: string = botPrompt.systemMessage || botPrompt.system_message || "";
            if (oldMsg) {
              // Replace "You are <OldName>," → "You are <NewName>,"
              const newMsg = oldMsg.replace(/You are \w+,/, `You are ${updates.name},`);
              if (newMsg !== oldMsg) {
                await apiFetch(`/api/prompts/${promptId}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ...botPrompt, systemMessage: newMsg }),
                });
              }
            }
          }
        }
      } catch {
        // Best-effort — UI name already updated, AI will use old name until next manual edit
      }
    }
  }, []);

  /** Clear conversation context — closes current session and starts a new one */
  const clearContext = useCallback(async () => {
    if (session) {
      try {
        await apiFetch("/api/support-chat/close", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.sessionId }),
        });
      } catch {}
    }
    setSession(null);
    setMessages([]);
    setEscalated(false);
    setSending(false);

    // Create a fresh session immediately — include botName so backend system prompt is correct
    try {
      const sessionRes = await apiFetch("/api/support-chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botName: botConfigRef.current.name }),
      });
      if (sessionRes.ok) {
        const sess: SupportSession = await sessionRes.json();
        setSession(sess);
        setEscalated(sess.status === "escalated");
      }
    } catch (err) {
      console.error("[SupportChat] clearContext error:", err);
    }
  }, [session]);

  /**
   * Reset init state WITHOUT closing the backend session.
   * Call this before handing off to the Conversations page inline view,
   * so the floating widget re-fetches fresh messages when reopened.
   */
  const resetInit = useCallback(() => {
    initializedRef.current = false;
    setSession(null);
    setMessages([]);
    setEscalated(false);
  }, []);

  /** Close session and reset state */
  const closeSession = useCallback(async () => {
    if (session) {
      try {
        await apiFetch("/api/support-chat/close", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.sessionId }),
        });
      } catch {
        // Best-effort close
      }
    }
    setSession(null);
    setMessages([]);
    setEscalated(false);
    setUnreadCount(0);
    initializedRef.current = false;
  }, [session]);

  return {
    session,
    messages,
    sending,
    loading,
    escalated,
    botConfig,
    unreadCount,
    markAsRead,
    notifyOpen,
    initialize,
    sendMessage,
    escalate,
    closeSession,
    clearContext,
    resetInit,
    updateBotConfig,
  };
}
