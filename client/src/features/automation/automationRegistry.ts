import type { LucideIcon } from "lucide-react";
import { Bot, PhoneOutgoing, AlertTriangle, Workflow, BarChart3 } from "lucide-react";

export interface AutomationType {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  patterns: RegExp[];
}

const AUTOMATION_TYPES: AutomationType[] = [
  {
    id: "ai_conversation",
    label: "AI Conversation",
    description: "AI-powered lead interaction",
    icon: Bot,
    patterns: [/bot|ai|agent|awaker|langchain|groq|openai/i],
  },
  {
    id: "messaging",
    label: "Messaging",
    description: "Message delivery and outreach",
    icon: PhoneOutgoing,
    patterns: [/message|whatsapp|sms|contact|outreach|twilio|telegram/i],
  },
  {
    id: "error_handler",
    label: "Error Handler",
    description: "Error logging and recovery",
    icon: AlertTriangle,
    patterns: [/error[_\s-]*handler|fallback|recovery/i],
  },
  {
    id: "scoring",
    label: "Scoring",
    description: "Lead scoring and qualification",
    icon: BarChart3,
    patterns: [/score|rating|qualify|qualification/i],
  },
];

const FALLBACK_TYPE: AutomationType = {
  id: "generic",
  label: "Workflow",
  description: "Custom automation workflow",
  icon: Workflow,
  patterns: [],
};

export function resolveAutomationType(workflowName: string): AutomationType {
  if (!workflowName) return FALLBACK_TYPE;
  for (const t of AUTOMATION_TYPES) {
    if (t.patterns.some((p) => p.test(workflowName))) return t;
  }
  return FALLBACK_TYPE;
}

export { AUTOMATION_TYPES, FALLBACK_TYPE };
