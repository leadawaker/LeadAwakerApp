import { useState, useCallback, useRef, useEffect } from "react";
import { apiFetch } from "@/lib/apiUtils";
import type { PageContext } from "./usePageContext";

export interface AgentMessage {
  id?: number;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  subAgentBlocks?: SubAgentBlock[];
  createdAt?: string;
  metadata?: Record<string, unknown>;
  attachments?: Record<string, unknown>;
  files?: AgentFile[];
}

export interface AgentFile {
  id: number;
  conversationId: string;
  messageId: number | null;
  filename: string;
  mimeType: string | null;
  filePath: string;
  fileSize: number | null;
  transcription: string | null;
  createdAt: string;
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
  systemPromptId?: number | null;
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

      // Load full conversation with messages and attachments in one call
      const convRes = await apiFetch(`/api/agent-conversations/${sess.sessionId}`);
      if (convRes.ok) {
        const conv = await convRes.json();
        // Update session with latest metadata from combined endpoint
        setSession({
          id: conv.id,
          sessionId: conv.sessionId,
          userId: conv.userId,
          agentId: conv.agentId,
          title: conv.title,
          status: conv.status,
          model: conv.model,
          thinkingLevel: conv.thinkingLevel,
          totalInputTokens: conv.totalInputTokens,
          totalOutputTokens: conv.totalOutputTokens,
          createdAt: conv.createdAt,
        });
        const msgs: AgentMessage[] = (conv.messages || []).map((msg: any) => ({
          id: msg.id,
          sessionId: msg.sessionId,
          role: msg.role,
          content: msg.content,
          subAgentBlocks: msg.subAgentBlocks ?? [],
          createdAt: msg.createdAt,
          metadata: msg.metadata,
          attachments: msg.attachments,
          files: msg.files ?? [],
        }));
        setMessages(msgs);
      }
    } catch (err) {
      console.error("[AgentChat] Init error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (text: string, attachment?: string, fileId?: number, pageContext?: PageContext) => {
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
          ...(fileId ? { fileId } : {}),
          ...(pageContext ? { pageContext } : {}),
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

              // Refresh session after a delay to pick up AI-generated title
              setTimeout(async () => {
                try {
                  const sessRes = await apiFetch(`/api/agents/sessions/${session.sessionId}`);
                  if (sessRes.ok) {
                    const updated: AiSession = await sessRes.json();
                    setSession(updated);
                  }
                } catch {
                  // ignore - title will appear on next load
                }
              }, 5000);
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

  /** Load a specific existing session by sessionId (for switching between conversations) */
  const loadSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    try {
      // Load full conversation with messages and attachments in one call
      const convRes = await apiFetch(`/api/agent-conversations/${sessionId}`);
      if (!convRes.ok) throw new Error("Conversation not found");
      const conv = await convRes.json();

      setSession({
        id: conv.id,
        sessionId: conv.sessionId,
        userId: conv.userId,
        agentId: conv.agentId,
        title: conv.title,
        status: conv.status,
        model: conv.model,
        thinkingLevel: conv.thinkingLevel,
        totalInputTokens: conv.totalInputTokens,
        totalOutputTokens: conv.totalOutputTokens,
        createdAt: conv.createdAt,
      });

      // Load agent if not already loaded or different agent
      if (!agent || agent.id !== conv.agentId) {
        const agentRes = await apiFetch(`/api/agents/${conv.agentId}`);
        if (agentRes.ok) {
          const found: AiAgent = await agentRes.json();
          setAgent(found);
        }
      }

      const msgs: AgentMessage[] = (conv.messages || []).map((msg: any) => ({
        id: msg.id,
        sessionId: msg.sessionId,
        role: msg.role,
        content: msg.content,
        subAgentBlocks: msg.subAgentBlocks ?? [],
        createdAt: msg.createdAt,
        metadata: msg.metadata,
        attachments: msg.attachments,
        files: msg.files ?? [],
      }));
      setMessages(msgs);
    } catch (err) {
      console.error("[AgentChat] Load session error:", err);
    } finally {
      setLoading(false);
    }
  }, [agent]);

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

  /** Update the current session's model (Sonnet/Opus/Haiku) */
  const updateSessionModel = useCallback(
    async (model: string) => {
      if (!session) return;
      try {
        const res = await apiFetch(
          `/api/agents/sessions/${session.sessionId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model }),
          },
        );
        if (res.ok) {
          const updated: AiSession = await res.json();
          setSession(updated);
        }
      } catch (err) {
        console.error("[AgentChat] Failed to update model:", err);
      }
    },
    [session],
  );

  /** Update the current session's thinking level (none/low/medium/high) */
  const updateSessionThinking = useCallback(
    async (thinkingLevel: string) => {
      if (!session) return;
      try {
        const res = await apiFetch(
          `/api/agents/sessions/${session.sessionId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ thinkingLevel }),
          },
        );
        if (res.ok) {
          const updated: AiSession = await res.json();
          setSession(updated);
        }
      } catch (err) {
        console.error("[AgentChat] Failed to update thinking level:", err);
      }
    },
    [session],
  );

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
    loadSession,
    abortStream,
    updateSessionModel,
    updateSessionThinking,
  };
}
