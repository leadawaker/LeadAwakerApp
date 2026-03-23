import { useState, useCallback, useRef, useEffect } from "react";
import { apiFetch } from "@/lib/apiUtils";

export interface FounderMessage {
  id?: number;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
}

interface FounderSession {
  id: number;
  sessionId: string;
  userId: number;
  accountId: number | null;
  channel: string;
  status: string;
  createdAt: string;
}

export function useFounderChat() {
  const [session, setSession] = useState<FounderSession | null>(null);
  const [messages, setMessages] = useState<FounderMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const initializedRef = useRef(false);
  const isOpenRef = useRef(false);

  const markAsRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const notifyOpen = useCallback((isOpen: boolean) => {
    isOpenRef.current = isOpen;
    if (isOpen) setUnreadCount(0);
  }, []);

  /** Create or resume a founder session + load history */
  const initialize = useCallback(async () => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    setLoading(true);
    try {
      const sessionRes = await apiFetch("/api/support-chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "founder" }),
      });
      if (!sessionRes.ok) throw new Error("Failed to create founder session");
      const sess: FounderSession = await sessionRes.json();
      setSession(sess);

      const msgsRes = await apiFetch(`/api/support-chat/messages/${sess.sessionId}`);
      if (msgsRes.ok) {
        const msgs: FounderMessage[] = await msgsRes.json();
        setMessages(msgs);
      }
    } catch (err) {
      console.error("[FounderChat] Init error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Send a message to the founder */
  const sendMessage = useCallback(async (content: string) => {
    if (!session || sending) return;
    const trimmed = content.trim();
    if (!trimmed) return;

    const optimisticMsg: FounderMessage = {
      sessionId: session.sessionId,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setSending(true);

    try {
      const res = await apiFetch("/api/support-chat/founder/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId, content: trimmed }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();

      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m !== optimisticMsg);
        return [...withoutOptimistic, data.message];
      });
    } catch (err) {
      console.error("[FounderChat] Send error:", err);
      setMessages((prev) => [
        ...prev,
        {
          sessionId: session.sessionId,
          role: "system",
          content: "Something went wrong. Please try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [session, sending]);

  /** Listen for founder replies via SSE */
  useEffect(() => {
    if (!session) return;
    const handler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.sessionId === session.sessionId && data.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
          if (!isOpenRef.current) {
            setUnreadCount((n) => n + 1);
          }
        }
      } catch {}
    };

    // Listen on the interactions SSE stream for founder_reply events
    const es = (window as any).__founderSSE;
    if (!es) {
      // Piggyback on existing EventSource if available, or set up a listener
      const onSSE = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail?.type === "founder_reply") handler(detail);
      };
      window.addEventListener("founder_reply", onSSE);
      return () => window.removeEventListener("founder_reply", onSSE);
    }
    return undefined;
  }, [session]);

  /** Close session and reset */
  const closeSession = useCallback(async () => {
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
    setUnreadCount(0);
    initializedRef.current = false;
  }, [session]);

  /** Clear context and start fresh */
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

    try {
      const sessionRes = await apiFetch("/api/support-chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "founder" }),
      });
      if (sessionRes.ok) {
        const sess: FounderSession = await sessionRes.json();
        setSession(sess);
      }
    } catch (err) {
      console.error("[FounderChat] clearContext error:", err);
    }
  }, [session]);

  const resetInit = useCallback(() => {
    initializedRef.current = false;
    setSession(null);
    setMessages([]);
  }, []);

  return {
    session,
    messages,
    sending,
    loading,
    unreadCount,
    markAsRead,
    notifyOpen,
    initialize,
    sendMessage,
    closeSession,
    clearContext,
    resetInit,
  };
}
