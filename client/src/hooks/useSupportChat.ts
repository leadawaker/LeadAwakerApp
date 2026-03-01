import { useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/apiUtils";

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
  name: "Sophie",
  photoUrl: null,
  enabled: true,
};

export function useSupportChat() {
  const [session, setSession] = useState<SupportSession | null>(null);
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [botConfig, setBotConfig] = useState<SupportBotConfig>(DEFAULT_BOT_CONFIG);
  const initializedRef = useRef(false);

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
          if (cfg) setBotConfig({ ...DEFAULT_BOT_CONFIG, ...cfg });
        }
      } catch {
        // Use defaults
      }

      // Create or get active session
      const sessionRes = await apiFetch("/api/support-chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
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
        body: JSON.stringify({ sessionId: session.sessionId, content: trimmed }),
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
    initializedRef.current = false;
  }, [session]);

  return {
    session,
    messages,
    sending,
    loading,
    escalated,
    botConfig,
    initialize,
    sendMessage,
    escalate,
    closeSession,
  };
}
