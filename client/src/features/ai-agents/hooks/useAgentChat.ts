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

export interface AgentPermissions {
  read: boolean;
  write: boolean;
  create: boolean;
  delete: boolean;
}

export interface AiAgent {
  id: number;
  name: string;
  type: string;
  systemPrompt: string | null;
  photoUrl: string | null;
  enabled: boolean;
  displayOrder: number;
  model?: string;
  thinkingLevel?: string;
  permissions?: AgentPermissions;
  pageAwarenessEnabled?: boolean;
  createdAt?: string;
}

export interface AiSession {
  id: number;
  sessionId: string;
  userId: number;
  agentId: number;
  title: string | null;
  status: string;
  model?: string;
  thinkingLevel?: string;
  totalInputTokens?: number;
  totalOutputTokens?: number;
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
  const abortControllerRef = useRef<AbortController | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    streamingTextRef.current = streamingText;
  }, [streamingText]);

  // Cleanup on unmount — abort any in-flight stream
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const initialize = useCallback(async (agentId: number) => {
    setLoading(true);
    try {
      // Load agent info
      const agentRes = await apiFetch(`/api/agents/${agentId}`);
      if (agentRes.ok) {
        const found: AiAgent = await agentRes.json();
        setAgent(found);
      }

      // Create or resume session for this agent
      const sessRes = await apiFetch(`/api/agents/${agentId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!sessRes.ok) throw new Error("Failed to create session");
      const sess: AiSession = await sessRes.json();
      setSession(sess);

      // Load message history
      const msgsRes = await apiFetch(`/api/agents/sessions/${sess.sessionId}/messages`);
      if (msgsRes.ok) {
        const rawMsgs = await msgsRes.json();
        const msgs: AgentMessage[] = rawMsgs.map((m: unknown) => {
          const msg = m as Record<string, unknown>;
          return {
            ...msg,
            subAgentBlocks: typeof msg.subAgentBlocks === "string"
              ? JSON.parse(msg.subAgentBlocks as string)
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

    // Create AbortController for this stream
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // POST to the agent-conversations endpoint which stores the message
      // and streams the Claude response via SSE
      const res = await apiFetch(`/api/agent-conversations/${session.sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed,
          ...(attachment ? { attachment } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error("Failed to start stream");

      // Read SSE stream using fetch ReadableStream API
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
            const evt = JSON.parse(line.slice(6)) as {
              type: string;
              id?: number;
              text?: string;
              subAgentBlocks?: SubAgentBlock[];
              usage?: { inputTokens: number; outputTokens: number };
              message?: string;
            };

            if (evt.type === "message_id") {
              // Update the optimistic user message with the real ID
              setMessages((prev) =>
                prev.map((m) =>
                  m === optimistic ? { ...m, id: evt.id } : m
                )
              );
            } else if (evt.type === "token") {
              // Append token text incrementally for real-time rendering
              const newText = streamingTextRef.current + (evt.text ?? "");
              streamingTextRef.current = newText;
              setStreamingText(newText);
            } else if (evt.type === "done") {
              // Final event — add the complete assistant message
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
            // ignore parse errors for incomplete JSON
          }
        }
      }
    } catch (err) {
      // Don't show error message if user intentionally aborted
      if (err instanceof DOMException && err.name === "AbortError") {
        console.log("[AgentChat] Stream aborted by user");
        return;
      }
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
      abortControllerRef.current = null;
      setStreaming(false);
      setStreamingText("");
      streamingTextRef.current = "";
    }
  }, [session, streaming]);

  /** Abort current streaming response (connection drop cleanup) */
  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStreaming(false);
    setStreamingText("");
    streamingTextRef.current = "";
  }, []);

  const newSession = useCallback(async () => {
    if (!session) return;
    // Close current session
    try {
      await apiFetch(`/api/agents/sessions/${session.sessionId}`, { method: "DELETE" });
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
    setAgent,
    session,
    messages,
    streaming,
    streamingText,
    loading,
    initialize,
    sendMessage,
    newSession,
    abortStream,
  };
}
