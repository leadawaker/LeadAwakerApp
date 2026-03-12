import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Cpu, Zap, Plus, MessageSquare, Loader2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { apiFetch } from "@/lib/apiUtils";
import type { AiAgent } from "../hooks/useAgentChat";

function AgentIcon({ agent }: { agent: AiAgent }) {
  if (agent.photoUrl) {
    return (
      <Avatar className="h-14 w-14">
        <AvatarImage src={agent.photoUrl} alt={agent.name} />
        <AvatarFallback className="bg-brand-indigo/10 text-brand-indigo font-bold text-lg">
          {agent.name[0]}
        </AvatarFallback>
      </Avatar>
    );
  }
  return (
    <div className="h-14 w-14 rounded-full bg-brand-indigo/10 flex items-center justify-center">
      {agent.type === "code_runner" ? (
        <Zap className="h-7 w-7 text-brand-indigo" />
      ) : agent.type === "campaign_crafter" ? (
        <MessageSquare className="h-7 w-7 text-brand-indigo" />
      ) : (
        <Cpu className="h-7 w-7 text-brand-indigo" />
      )}
    </div>
  );
}

function AgentCard({ agent }: { agent: AiAgent }) {
  const [, setLocation] = useLocation();

  const tagline =
    agent.type === "code_runner"
      ? "Full codebase access · Pi live reload"
      : agent.type === "campaign_crafter"
      ? "Campaigns · Web browsing · PDF support"
      : "Custom AI assistant";

  return (
    <button
      onClick={() => setLocation(`/agency/ai-agents/${agent.id}`)}
      className="group flex flex-col items-center gap-3 p-5 rounded-2xl bg-card border border-border/50 hover:border-brand-indigo/30 hover:shadow-md transition-all text-center"
    >
      <AgentIcon agent={agent} />
      <div>
        <div className="font-semibold text-sm text-foreground">{agent.name}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{tagline}</div>
      </div>
      {agent.type === "code_runner" && (
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-[10px] text-muted-foreground font-medium">Connected</span>
        </div>
      )}
      <div className="flex gap-2 w-full">
        <div className="flex-1 text-[11px] font-semibold text-brand-indigo bg-brand-indigo/10 rounded-lg py-1.5 group-hover:bg-brand-indigo/15 transition-colors">
          Open Chat
        </div>
      </div>
    </button>
  );
}

export function AgentsPage() {
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/ai-agents")
      .then((r) => r.json())
      .then((data: unknown) => {
        setAgents(Array.isArray(data) ? (data as AiAgent[]) : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-heading text-foreground">AI Agents</h1>
        <p className="text-sm text-muted-foreground mt-1">Your specialized AI assistants — powered by Claude Code</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
          {/* Placeholder for adding custom agents */}
          <button
            disabled
            className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed border-border/40 text-muted-foreground/50 cursor-not-allowed"
            title="Add custom agent (coming soon)"
          >
            <Plus className="h-7 w-7" />
            <span className="text-[11px] font-medium">Add Agent</span>
            <span className="text-[10px]">Coming soon</span>
          </button>
        </div>
      )}
    </div>
  );
}
