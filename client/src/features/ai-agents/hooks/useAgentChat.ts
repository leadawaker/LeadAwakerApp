import { useState, useCallback, useRef, useEffect } from "react";
import { apiFetch } from "@/lib/apiUtils";

export interface AgentMessage {
  id?: number;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  subAgentBlocks?: SubAgentBlock[];
  createdAt?: string;
}

export interface SubAgentBlock {
  name: string;
  content: string;
}

export interface AiAgent {
  id: number;
  name: string;
  type: string;
  systemPrompt: string | null;
  photoUrl: string | null;
  enabled: boolean;
  displayOrder: number;
}

export interface AiSession {
  id: number;
  sessionId: string;
  userId: number;
  agentId: number;
  title: string | null;
  status: string;
  createdAt: string;
}

export function useAgentChat() {
  const [agent, setAgent] = useState<AiAgent | null>(null);
  const [session, setSession] = useState<AiSession | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [loading, setLoading] = useState(false);
  const streamingTextRef = useRef("");

  // Keep ref in sync with state
  useEffect(() => {
    streamingTextRef.current = streamingText;
  }, [streamingText]);

  const initialize = useCallback(async (agentId: number) => {
    setLoading(true);
    try {
      // Load agent info
      const agentsRes = await apiFetch("/api/ai-agents");
      if (agentsRes.ok) {
        const agents: AiAgent[] = await agentsRes.json();
        const found = agents.find((a) => a.id === agentId);
        if (found) setAgent(found);
      }

      // Create or resume session
      const sessRes = await apiFetch("/api/ai-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      if (!sessRes.ok) throw new Error("Failed to create session");
      const sess: AiSession = await sessRes.json();
      setSession(sess);

      // Load message history
      const msgsRes = await apiFetch(`/api/ai-sessions/${sess.sessionId}/messages`);
      if (msgsRes.ok) {
        const rawMsgs = await msgsRes.json();
        const msgs: AgentMessage[] = rawMsgs.map((m: unknown) => {
          const msg = m as Record<string, unknown>;
          return {
            ...msg,
            subAgentBlocks: typeof msg.subAgentBlocks === "string"
              ? JSON.parse(msg.subAgentBlocks)
              : (msg.subAgentBlocks ?? []),
          };
        });
        setMessages(msgs);
      }
    } catch (err) {
      console.error("[AgentChat] Init error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (text: string, attachment?: string) => {
    if (!session || streaming) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    // Optimistic user message
    const optimistic: AgentMessage = {
      sessionId: session.sessionId,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setStreaming(true);
    setStreamingText("");
    streamingTextRef.current = "";

    try {
      const res = await apiFetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.sessionId,
          message: trimmed,
          attachmentBase64: attachment,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Failed to start stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as { type: string; text?: string; subAgentBlocks?: SubAgentBlock[]; message?: string };
            if (evt.type === "token") {
              const newText = streamingTextRef.current + (evt.text ?? "");
              streamingTextRef.current = newText;
              setStreamingText(newText);
            } else if (evt.type === "done") {
              const finalText = streamingTextRef.current;
              const subAgentBlocks: SubAgentBlock[] = evt.subAgentBlocks || [];
              setMessages((prev) => [
                ...prev,
                {
                  sessionId: session.sessionId,
                  role: "assistant",
                  content: finalText,
                  subAgentBlocks,
                  createdAt: new Date().toISOString(),
                },
              ]);
              setStreamingText("");
              streamingTextRef.current = "";
              setStreaming(false);
            } else if (evt.type === "error") {
              console.error("[AgentChat] Stream error:", evt.message);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      console.error("[AgentChat] Send error:", err);
      setMessages((prev) => [
        ...prev,
        {
          sessionId: session.sessionId,
          role: "assistant",
          content: "Something went wrong. Please try again.",
          subAgentBlocks: [],
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setStreaming(false);
      setStreamingText("");
      streamingTextRef.current = "";
    }
  }, [session, streaming]);

  const newSession = useCallback(async () => {
    if (!session) return;
    // Close current session
    try {
      await apiFetch(`/api/ai-sessions/${session.sessionId}/close`, { method: "POST" });
    } catch {
      // ignore
    }
    setSession(null);
    setMessages([]);
    setStreaming(false);
    setStreamingText("");
    streamingTextRef.current = "";
    // Reinitialize
    if (agent) await initialize(agent.id);
  }, [session, agent, initialize]);

  return {
    agent,
    session,
    messages,
    streaming,
    streamingText,
    loading,
    initialize,
    sendMessage,
    newSession,
  };
}
