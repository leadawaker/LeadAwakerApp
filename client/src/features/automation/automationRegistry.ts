import type { LucideIcon } from "lucide-react";
import {
  Bot, PhoneOutgoing, PhoneIncoming, AlertTriangle, Workflow,
  BarChart3, CalendarCheck, Clock, Megaphone, TrendingUp, Bell,
} from "lucide-react";

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
    patterns: [/bot|ai[_\s]|agent|awaker|langchain|groq|openai|ai_conv/i],
  },
  {
    id: "inbound",
    label: "Inbound",
    description: "Inbound lead handling",
    icon: PhoneIncoming,
    patterns: [/inbound|incoming/i],
  },
  {
    id: "booking",
    label: "Booking",
    description: "Booking and appointment webhooks",
    icon: CalendarCheck,
    patterns: [/book|appointment/i],
  },
  {
    id: "scheduler",
    label: "Scheduler",
    description: "Timed and bump scheduling",
    icon: Clock,
    patterns: [/bump|scheduler/i],
  },
  {
    id: "campaign",
    label: "Campaign",
    description: "Campaign launch and management",
    icon: Megaphone,
    patterns: [/campaign/i],
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Metrics aggregation and reporting",
    icon: TrendingUp,
    patterns: [/metric|analytic|aggregat|report/i],
  },
  {
    id: "tasks",
    label: "Tasks",
    description: "Task and reminder automation",
    icon: Bell,
    patterns: [/task|reminder/i],
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
