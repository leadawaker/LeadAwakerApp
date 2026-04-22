import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { apiFetch } from "@/lib/apiUtils";
import { queryClient } from "@/lib/queryClient";
import type { PageContext } from "./usePageContext";
import { subscribeSyncBus, broadcastSync, listenerCount } from "./chatSyncBus";

// ─── CRM tool → TanStack Query invalidation map ─────────────────────────────
// When the bot mutates data server-side, the page-level queries have no way to
// know. After a successful tool_result SSE event, invalidate the matching
// queries so visible lists refetch automatically (no page reload needed).

// Tools with a deterministic entity mapping (direct named tools).
const TOOL_INVALIDATION_MAP: Record<string, string[]> = {
  create_lead: ["/api/leads"],
  update_lead: ["/api/leads"],
  delete_lead: ["/api/leads"],
  create_campaign: ["/api/campaigns"],
  update_campaign: ["/api/campaigns"],
  delete_campaign: ["/api/campaigns"],
  create_tag: ["/api/tags", "/api/leads"],
  update_tag: ["/api/tags", "/api/leads"],
  delete_tag: ["/api/tags", "/api/leads"],
  add_lead_tag: ["/api/leads"],
  delete_lead_tag: ["/api/leads"],
};

// For raw SQL (query_database), sniff the statement for mutating keywords + table names.
const SQL_TABLE_TO_QUERY_KEY: Record<string, string[]> = {
  prospects: ["/api/prospects"],
  leads: ["/api/leads"],
  campaigns: ["/api/campaigns"],
  tags: ["/api/tags", "/api/leads"],
  accounts: ["/api/accounts"],
  tasks: ["/api/tasks"],
};

function queryKeysForTool(tool: string, args: Record<string, unknown> | undefined): string[] {
  if (TOOL_INVALIDATION_MAP[tool]) return TOOL_INVALIDATION_MAP[tool];

  if (tool === "query_database") {
    const sql = (args?.sql as string | undefined) || "";
    if (!/\b(INSERT|UPDATE|DELETE)\b/i.test(sql)) return []; // read-only query
    const keys = new Set<string>();
    for (const [table, qk] of Object.entries(SQL_TABLE_TO_QUERY_KEY)) {
      // Match "Prospects", "prospects", schema-qualified etc. Case-insensitive.
      const re = new RegExp(`"?${table}"?`, "i");
      if (re.test(sql)) qk.forEach((k) => keys.add(k));
    }
    return [...keys];
  }

  return [];
}

export interface AgentMessage {
  id?: number;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  subAgentBlocks?: SubAgentBlock[];
  createdAt?: string;
  metadata?: Record<string, unknown> & {
    skillId?: string;
    skillName?: string;
  };
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

export interface PendingDestructiveAction {
  toolName: string;
  args: Record<string, unknown>;
  description: string;
}

export interface PendingConfirmation {
  sessionId: string;
  agentId: number;
  actions: PendingDestructiveAction[];
}

/** Activity indicator for what the AI is currently doing */
export interface AgentActivity {
  type: "thinking" | "tool";
  tool?: string;
  label?: string;
  timestamp: number;
}

export function useAgentChat() {
  const [agent, setAgent] = useState<AiAgent | null>(null);
  const [session, setSession] = useState<AiSession | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [activity, setActivity] = useState<AgentActivity | null>(null);
  const streamingTextRef = useRef("");
  const messagesRef = useRef<AgentMessage[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Unique identity for this hook instance (stable across re-renders)
  const syncId = useMemo(() => Symbol("useAgentChat"), []);
  // Flag to suppress broadcast when update came from sync bus
  const fromSyncRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    streamingTextRef.current = streamingText;
  }, [streamingText]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // --- Cross-view sync bus ---
  // Subscribe to the bus whenever sessionId changes; receive peer updates
  useEffect(() => {
    const sid = session?.sessionId;
    if (!sid) return;

    const unsub = subscribeSyncBus(
      sid,
      (data) => {
        // Incoming sync from peer — apply without re-broadcasting
        fromSyncRef.current = true;
        setMessages(data.messages);
        setStreaming(data.streaming);
        setStreamingText(data.streaming ? data.streamingText : "");
        streamingTextRef.current = data.streaming ? data.streamingText : "";
        // Reset flag after React batches the state updates
        queueMicrotask(() => {
          fromSyncRef.current = false;
        });
      },
      syncId,
    );

    return unsub;
  }, [session?.sessionId, syncId]);

  // Broadcast helper — only sends if peers exist and update is local
  const maybeBroadcast = useCallback(
    (msgs: AgentMessage[], isStreaming: boolean, sText: string) => {
      const sid = session?.sessionId;
      if (!sid || fromSyncRef.current) return;
      if (listenerCount(sid) <= 1) return; // no peer
      broadcastSync(sid, { messages: msgs, streaming: isStreaming, streamingText: sText }, syncId);
    },
    [session?.sessionId, syncId],
  );

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
    const newMsgs = [...messagesRef.current, optimistic];
    setMessages(newMsgs);
    setStreaming(true);
    setStreamingText("");
    streamingTextRef.current = "";
    // Sync: broadcast the optimistic user message to peer views
    maybeBroadcast(newMsgs, true, "");
    // Throttle token broadcasts (~100ms)
    let lastTokenBroadcast = 0;

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
              usage?: { inputTokens: number; outputTokens: number; costUsd?: number };
              cliSessionId?: string;
              message?: string;
              sessionId?: string;
              agentId?: number;
              actions?: PendingDestructiveAction[];
              activity?: string;
              tool?: string;
              label?: string;
              success?: boolean;
              args?: Record<string, unknown>;
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
              // Sync: throttle streaming text broadcasts (~100ms)
              const now = Date.now();
              if (now - lastTokenBroadcast > 100) {
                lastTokenBroadcast = now;
                maybeBroadcast(messagesRef.current, true, newText);
              }
            } else if (evt.type === "activity") {
              // Activity indicator: thinking, tool use, etc.
              setActivity({
                type: evt.activity === "tool" ? "tool" : "thinking",
                tool: evt.tool as string | undefined,
                label: evt.label as string | undefined,
                timestamp: Date.now(),
              });
            } else if (evt.type === "tool_result") {
              // When the bot mutates data, invalidate matching page queries so lists
              // refetch without a manual page reload.
              if (evt.success && evt.tool) {
                const keys = queryKeysForTool(evt.tool, evt.args);
                for (const key of keys) {
                  queryClient.invalidateQueries({ queryKey: [key] });
                }
                // Also notify custom useState/useEffect hooks that don't use TanStack Query
                window.dispatchEvent(new CustomEvent("crm-data-changed", { detail: { entity: evt.tool } }));
              }
            } else if (evt.type === "pending_confirmation") {
              // Destructive action requires user confirmation before execution
              setPendingConfirmation({
                sessionId: evt.sessionId || session.sessionId,
                agentId: evt.agentId || 0,
                actions: evt.actions || [],
              });
            } else if (evt.type === "done") {
              // Final event — add the complete assistant message
              const finalText = streamingTextRef.current;
              const subAgentBlocks: SubAgentBlock[] = evt.subAgentBlocks || [];
              const assistantMsg: AgentMessage = {
                sessionId: session.sessionId,
                role: "assistant",
                content: finalText,
                subAgentBlocks,
                createdAt: new Date().toISOString(),
              };
              setMessages((prev) => {
                const updated = [...prev, assistantMsg];
                // Sync: broadcast final messages to peer views
                maybeBroadcast(updated, false, "");
                return updated;
              });
              setStreamingText("");
              streamingTextRef.current = "";
              setStreaming(false);
              setActivity(null);

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
              // Show the error inline if it's a hard failure (no text accumulated yet)
              if (!streamingTextRef.current) {
                const errMsg: AgentMessage = {
                  sessionId: session.sessionId,
                  role: "assistant",
                  content: "I ran into an error with the AI service. Please try again in a moment.",
                  subAgentBlocks: [],
                  createdAt: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, errMsg]);
                setStreaming(false);
                setStreamingText("");
                streamingTextRef.current = "";
                setActivity(null);
              }
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
      const errMsg: AgentMessage = {
        sessionId: session.sessionId,
        role: "assistant",
        content: "I ran into an error connecting to the AI service. Please try sending your message again.",
        subAgentBlocks: [],
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => {
        const updated = [...prev, errMsg];
        maybeBroadcast(updated, false, "");
        return updated;
      });
    } finally {
      abortControllerRef.current = null;
      setStreaming(false);
      setStreamingText("");
      streamingTextRef.current = "";
    }
  }, [session, streaming, maybeBroadcast]);

  /** Execute a skill in the current conversation, streaming results */
  const executeSkill = useCallback(async (skillId: string, skillName: string, content?: string) => {
    if (!session || streaming) return;

    // Optimistic user message with skill metadata
    const userContent = content?.trim() || `Execute skill: ${skillName}`;
    const optimistic: AgentMessage = {
      sessionId: session.sessionId,
      role: "user",
      content: userContent,
      metadata: { skillId, skillName },
      createdAt: new Date().toISOString(),
    };
    const skillMsgs = [...messagesRef.current, optimistic];
    setMessages(skillMsgs);
    setStreaming(true);
    setStreamingText("");
    streamingTextRef.current = "";
    maybeBroadcast(skillMsgs, true, "");
    let lastSkillTokenBroadcast = 0;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await apiFetch("/api/agent-skills/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId, sessionId: session.sessionId, content: userContent }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error("Failed to execute skill");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedSkillMeta: { skillId?: string; skillName?: string } = {};

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
              skillId?: string;
              skillName?: string;
              subAgentBlocks?: SubAgentBlock[];
              message?: string;
              activity?: string;
              tool?: string;
              label?: string;
            };

            if (evt.type === "message_id") {
              setMessages((prev) =>
                prev.map((m) => m === optimistic ? { ...m, id: evt.id } : m)
              );
            } else if (evt.type === "skill_metadata") {
              receivedSkillMeta = { skillId: evt.skillId, skillName: evt.skillName };
            } else if (evt.type === "token") {
              const newText = streamingTextRef.current + (evt.text ?? "");
              streamingTextRef.current = newText;
              setStreamingText(newText);
              const now = Date.now();
              if (now - lastSkillTokenBroadcast > 100) {
                lastSkillTokenBroadcast = now;
                maybeBroadcast(messagesRef.current, true, newText);
              }
            } else if (evt.type === "activity") {
              setActivity({
                type: evt.activity === "tool" ? "tool" : "thinking",
                tool: evt.tool as string | undefined,
                label: evt.label as string | undefined,
                timestamp: Date.now(),
              });
            } else if (evt.type === "done") {
              setActivity(null);
              const finalText = streamingTextRef.current;
              const subAgentBlocks: SubAgentBlock[] = evt.subAgentBlocks || [];
              const skillAssistantMsg: AgentMessage = {
                sessionId: session.sessionId,
                role: "assistant",
                content: finalText,
                subAgentBlocks,
                metadata: {
                  skillId: receivedSkillMeta.skillId || skillId,
                  skillName: receivedSkillMeta.skillName || skillName,
                },
                createdAt: new Date().toISOString(),
              };
              setMessages((prev) => {
                const updated = [...prev, skillAssistantMsg];
                maybeBroadcast(updated, false, "");
                return updated;
              });
              setStreamingText("");
              streamingTextRef.current = "";
              setStreaming(false);
            } else if (evt.type === "error") {
              console.error("[AgentChat] Skill error:", evt.message);
              setMessages((prev) => [
                ...prev,
                {
                  sessionId: session.sessionId,
                  role: "assistant",
                  content: `⚠️ **Skill Error** (${skillName})\n\n${evt.message || "An unexpected error occurred while executing this skill."}`,
                  metadata: { skillId, skillName, error: true },
                  createdAt: new Date().toISOString(),
                },
              ]);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("[AgentChat] Skill execution error:", err);
      const failMsg: AgentMessage = {
        sessionId: session.sessionId,
        role: "assistant",
        content: `⚠️ **Skill Failed** (${skillName})\n\nThe skill could not be executed. Please try again.`,
        metadata: { skillId, skillName, error: true },
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => {
        const updated = [...prev, failMsg];
        maybeBroadcast(updated, false, "");
        return updated;
      });
    } finally {
      abortControllerRef.current = null;
      setStreaming(false);
      setStreamingText("");
      streamingTextRef.current = "";
    }
  }, [session, streaming, maybeBroadcast]);

  /** Abort current streaming response (connection drop cleanup) */
  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStreaming(false);
    setStreamingText("");
    streamingTextRef.current = "";
    setActivity(null);
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

  /** Delete the current conversation (hard delete: files, messages, session) and start fresh */
  const deleteConversation = useCallback(async () => {
    if (!session) return;
    try {
      await apiFetch(`/api/agent-conversations/${session.sessionId}`, { method: "DELETE" });
    } catch {
      // ignore
    }
    setSession(null);
    setMessages([]);
    setStreaming(false);
    setStreamingText("");
    streamingTextRef.current = "";
    // Reinitialize with a new session
    if (agent) await initialize(agent.id);
  }, [session, agent, initialize]);

  const newSession = useCallback(async () => {
    // Close current session if one exists
    if (session) {
      try {
        await apiFetch(`/api/agents/sessions/${session.sessionId}`, { method: "DELETE" });
      } catch {
        // ignore
      }
    }
    setSession(null);
    setMessages([]);
    setStreaming(false);
    setStreamingText("");
    streamingTextRef.current = "";
    // Reinitialize with a fresh session
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

  /** Confirm and execute pending destructive CRM actions */
  const confirmDestructiveActions = useCallback(async () => {
    if (!pendingConfirmation) return;
    try {
      const res = await apiFetch(
        `/api/agent-conversations/${pendingConfirmation.sessionId}/confirm-tools`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actions: pendingConfirmation.actions,
            agentId: pendingConfirmation.agentId,
          }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        // Add confirmation result as a system message in the chat
        const resultText = (data.results || []).map((r: { success: boolean; tool: string; data?: unknown; error?: string }) => {
          if (r.success) return `✅ ${r.tool}: completed successfully`;
          return `❌ ${r.tool}: ${r.error}`;
        }).join("\n");

        const confirmMsg: AgentMessage = {
          sessionId: pendingConfirmation.sessionId,
          role: "assistant",
          content: `**Destructive action(s) confirmed and executed:**\n\n${resultText}`,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => {
          const updated = [...prev, confirmMsg];
          maybeBroadcast(updated, false, "");
          return updated;
        });
      }
    } catch (err) {
      console.error("[AgentChat] Confirm destructive actions error:", err);
    } finally {
      setPendingConfirmation(null);
    }
  }, [pendingConfirmation, maybeBroadcast]);

  /** Cancel pending destructive CRM actions */
  const cancelDestructiveActions = useCallback(async () => {
    if (!pendingConfirmation) return;
    try {
      await apiFetch(
        `/api/agent-conversations/${pendingConfirmation.sessionId}/cancel-tools`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actions: pendingConfirmation.actions,
          }),
        },
      );
      const cancelMsg: AgentMessage = {
        sessionId: pendingConfirmation.sessionId,
        role: "assistant",
        content: "**Destructive action(s) cancelled.** No data was deleted.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => {
        const updated = [...prev, cancelMsg];
        maybeBroadcast(updated, false, "");
        return updated;
      });
    } catch (err) {
      console.error("[AgentChat] Cancel destructive actions error:", err);
    } finally {
      setPendingConfirmation(null);
    }
  }, [pendingConfirmation, maybeBroadcast]);


  return {
    agent,
    setAgent,
    session,
    messages,
    streaming,
    streamingText,
    loading,
    pendingConfirmation,
    activity,
    initialize,
    sendMessage,
    executeSkill,
    deleteConversation,
    newSession,
    loadSession,
    abortStream,
    updateSessionModel,
    updateSessionThinking,
    confirmDestructiveActions,
    cancelDestructiveActions,
  };
}
