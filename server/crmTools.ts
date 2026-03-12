/**
 * CRM Tool Definitions and Executors for AI Agents
 *
 * Provides read, write, and delete CRM tools that agents can use to query/modify
 * leads, campaigns, conversations, tags, and accounts data in PostgreSQL.
 *
 * Tool calls are embedded in Claude's response using XML-like tags:
 *   <crm_tool_call name="get_leads" />
 *   <crm_tool_call name="get_lead_by_id">{"id": 123}</crm_tool_call>
 *   <crm_tool_call name="delete_lead">{"id": 123}</crm_tool_call>
 *
 * The backend parses these, executes them, and returns results.
 */

import { storage } from "./storage";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AgentPermissions {
  read?: boolean;
  write?: boolean;
  create?: boolean;
  delete?: boolean;
}

export interface CrmToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface CrmToolResult {
  tool: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

// ─── Tool Definitions ───────────────────────────────────────────────────────

export interface CrmToolDef {
  name: string;
  description: string;
  requiredPermission: "read" | "write" | "create" | "delete";
  parameters: { name: string; type: string; description: string; required: boolean }[];
}

const READ_TOOLS: CrmToolDef[] = [
  {
    name: "get_leads",
    description: "List all leads. Returns id, firstName, lastName, phone, email, conversionStatus, automationStatus, campaignId, accountId, leadScore, notes, and timestamps. Optionally filter by account_id or campaign_id.",
    requiredPermission: "read",
    parameters: [
      { name: "account_id", type: "number", description: "Filter leads by account ID", required: false },
      { name: "campaign_id", type: "number", description: "Filter leads by campaign ID", required: false },
      { name: "limit", type: "number", description: "Max results to return (default 50, max 200)", required: false },
    ],
  },
  {
    name: "get_lead_by_id",
    description: "Get a single lead by ID with all fields including firstName, lastName, notes, leadScore, conversionStatus, and message counts.",
    requiredPermission: "read",
    parameters: [
      { name: "id", type: "number", description: "Lead ID", required: true },
    ],
  },
  {
    name: "get_campaigns",
    description: "List all campaigns. Returns id, name, status, accountId, description, dailyLeadLimit, aiModel, and timestamps. Optionally filter by account_id.",
    requiredPermission: "read",
    parameters: [
      { name: "account_id", type: "number", description: "Filter campaigns by account ID", required: false },
    ],
  },
  {
    name: "get_campaign_by_id",
    description: "Get a single campaign by ID with all fields.",
    requiredPermission: "read",
    parameters: [
      { name: "id", type: "number", description: "Campaign ID", required: true },
    ],
  },
  {
    name: "get_conversations",
    description: "List recent interactions/conversations. Returns message content, direction, type, status, aiGenerated flag, and timestamps. Optionally filter by lead_id or account_id.",
    requiredPermission: "read",
    parameters: [
      { name: "lead_id", type: "number", description: "Filter by lead ID", required: false },
      { name: "account_id", type: "number", description: "Filter by account ID", required: false },
      { name: "limit", type: "number", description: "Max results (default 50, max 200)", required: false },
    ],
  },
  {
    name: "get_tags",
    description: "List all tags. Returns id, name, color, category, accountId. Optionally filter by account_id.",
    requiredPermission: "read",
    parameters: [
      { name: "account_id", type: "number", description: "Filter tags by account ID", required: false },
    ],
  },
  {
    name: "get_accounts",
    description: "List all accounts. Returns id, name, phone, email, type, status, timezone, and business details.",
    requiredPermission: "read",
    parameters: [],
  },
  {
    name: "get_account_by_id",
    description: "Get a single account by ID with all fields.",
    requiredPermission: "read",
    parameters: [
      { name: "id", type: "number", description: "Account ID", required: true },
    ],
  },
  {
    name: "get_lead_tags",
    description: "Get all tags assigned to a specific lead.",
    requiredPermission: "read",
    parameters: [
      { name: "lead_id", type: "number", description: "Lead ID", required: true },
    ],
  },
];

const DELETE_TOOLS: CrmToolDef[] = [
  {
    name: "delete_lead",
    description: "Delete a lead by ID. This permanently removes the lead and all associated data.",
    requiredPermission: "delete",
    parameters: [
      { name: "id", type: "number", description: "Lead ID to delete", required: true },
    ],
  },
  {
    name: "delete_campaign",
    description: "Delete a campaign by ID. This permanently removes the campaign.",
    requiredPermission: "delete",
    parameters: [
      { name: "id", type: "number", description: "Campaign ID to delete", required: true },
    ],
  },
  {
    name: "delete_tag",
    description: "Delete a tag by ID. This removes the tag and all lead-tag associations.",
    requiredPermission: "delete",
    parameters: [
      { name: "id", type: "number", description: "Tag ID to delete", required: true },
    ],
  },
  {
    name: "delete_lead_tag",
    description: "Remove a tag from a lead (unlink, not delete the tag itself).",
    requiredPermission: "delete",
    parameters: [
      { name: "lead_id", type: "number", description: "Lead ID", required: true },
      { name: "tag_id", type: "number", description: "Tag ID to remove", required: true },
    ],
  },
];

const WRITE_TOOLS: CrmToolDef[] = [
  {
    name: "update_lead",
    description: "Update an existing lead's fields. Only include the fields you want to change. Updatable fields: firstName, lastName, phone, email, conversionStatus (New/Contacted/Qualified/Converted/Lost), leadScore (0-100), notes, automationStatus (idle/running/paused/completed/error).",
    requiredPermission: "write",
    parameters: [
      { name: "id", type: "number", description: "Lead ID to update", required: true },
      { name: "firstName", type: "string", description: "First name", required: false },
      { name: "lastName", type: "string", description: "Last name", required: false },
      { name: "phone", type: "string", description: "Phone number", required: false },
      { name: "email", type: "string", description: "Email address", required: false },
      { name: "conversionStatus", type: "string", description: "Status: New, Contacted, Qualified, Converted, or Lost", required: false },
      { name: "leadScore", type: "number", description: "Lead score 0-100", required: false },
      { name: "notes", type: "string", description: "Notes about the lead", required: false },
      { name: "automationStatus", type: "string", description: "Automation status: idle, running, paused, completed, error", required: false },
    ],
  },
  {
    name: "update_campaign",
    description: "Update an existing campaign's fields. Only include the fields you want to change. Updatable fields: name, description, status (Draft/Active/Paused/Completed), dailyLeadLimit.",
    requiredPermission: "write",
    parameters: [
      { name: "id", type: "number", description: "Campaign ID to update", required: true },
      { name: "name", type: "string", description: "Campaign name", required: false },
      { name: "description", type: "string", description: "Campaign description", required: false },
      { name: "status", type: "string", description: "Status: Draft, Active, Paused, or Completed", required: false },
      { name: "dailyLeadLimit", type: "number", description: "Max leads per day", required: false },
    ],
  },
  {
    name: "update_tag",
    description: "Update an existing tag's fields. Only include the fields you want to change.",
    requiredPermission: "write",
    parameters: [
      { name: "id", type: "number", description: "Tag ID to update", required: true },
      { name: "name", type: "string", description: "Tag name", required: false },
      { name: "color", type: "string", description: "Tag color (hex code like #FF5733)", required: false },
      { name: "category", type: "string", description: "Tag category", required: false },
    ],
  },
  {
    name: "add_lead_tag",
    description: "Add a tag to a lead. Links an existing tag to an existing lead.",
    requiredPermission: "write",
    parameters: [
      { name: "lead_id", type: "number", description: "Lead ID", required: true },
      { name: "tag_id", type: "number", description: "Tag ID to add to the lead", required: true },
    ],
  },
];

const CREATE_TOOLS: CrmToolDef[] = [
  {
    name: "create_lead",
    description: "Create a new lead in the CRM. At minimum provide firstName. Other fields are optional but recommended for a complete record.",
    requiredPermission: "create",
    parameters: [
      { name: "firstName", type: "string", description: "First name (required)", required: true },
      { name: "lastName", type: "string", description: "Last name", required: false },
      { name: "phone", type: "string", description: "Phone number", required: false },
      { name: "email", type: "string", description: "Email address", required: false },
      { name: "conversionStatus", type: "string", description: "Status: New, Contacted, Qualified, Converted, or Lost (default: New)", required: false },
      { name: "leadScore", type: "number", description: "Lead score 0-100", required: false },
      { name: "notes", type: "string", description: "Notes about the lead", required: false },
      { name: "source", type: "string", description: "Lead source (e.g. Website, Referral, LinkedIn)", required: false },
      { name: "campaign_id", type: "number", description: "Campaign ID to assign the lead to", required: false },
      { name: "account_id", type: "number", description: "Account ID the lead belongs to", required: false },
    ],
  },
  {
    name: "create_campaign",
    description: "Create a new campaign in the CRM. Provide a name at minimum.",
    requiredPermission: "create",
    parameters: [
      { name: "name", type: "string", description: "Campaign name (required)", required: true },
      { name: "description", type: "string", description: "Campaign description", required: false },
      { name: "status", type: "string", description: "Status: Draft, Active, Paused, or Completed (default: Draft)", required: false },
      { name: "account_id", type: "number", description: "Account ID the campaign belongs to", required: false },
      { name: "dailyLeadLimit", type: "number", description: "Max leads per day", required: false },
      { name: "channel", type: "string", description: "Communication channel (e.g. sms, email, whatsapp)", required: false },
    ],
  },
  {
    name: "create_tag",
    description: "Create a new tag in the CRM. Provide a name at minimum.",
    requiredPermission: "create",
    parameters: [
      { name: "name", type: "string", description: "Tag name (required)", required: true },
      { name: "color", type: "string", description: "Tag color (hex code like #FF5733)", required: false },
      { name: "category", type: "string", description: "Tag category", required: false },
      { name: "account_id", type: "number", description: "Account ID the tag belongs to", required: false },
    ],
  },
];

export const ALL_TOOLS = [...READ_TOOLS, ...WRITE_TOOLS, ...CREATE_TOOLS, ...DELETE_TOOLS];

// ─── Tool Descriptions for System Prompt ────────────────────────────────────

/**
 * Build the CRM tools section for the agent's system prompt.
 * Only includes tools the agent has permission for.
 */
export function buildCrmToolsPrompt(permissions: AgentPermissions): string {
  const availableTools: CrmToolDef[] = [];

  if (permissions.read) {
    availableTools.push(...READ_TOOLS);
  }
  if (permissions.write) {
    availableTools.push(...WRITE_TOOLS);
  }
  if (permissions.create) {
    availableTools.push(...CREATE_TOOLS);
  }
  if (permissions.delete) {
    availableTools.push(...DELETE_TOOLS);
  }

  if (availableTools.length === 0) return "";

  let prompt = `\n\n[CRM Tools]\nYou have access to the following CRM tools to query and manage data. To use a tool, include a tool call block in your response using this exact format:\n\n<crm_tool_call name="tool_name">{"param": "value"}</crm_tool_call>\n\nFor tools with no parameters:\n<crm_tool_call name="tool_name">{}</crm_tool_call>\n\nYou may include multiple tool calls in a single response. The system will execute them and provide results.\n\nAvailable tools:\n`;

  for (const tool of availableTools) {
    prompt += `\n- ${tool.name}: ${tool.description}`;
    if (tool.parameters.length > 0) {
      prompt += `\n  Parameters:`;
      for (const p of tool.parameters) {
        prompt += `\n    - ${p.name} (${p.type}${p.required ? ", required" : ", optional"}): ${p.description}`;
      }
    }
  }

  prompt += `\n\nIMPORTANT: Always use CRM tools to fetch real data. Never guess or make up CRM data. If you need data to answer a question, use the appropriate tool first.`;

  if (permissions.write) {
    prompt += `\nWhen updating records, always fetch the record first (using a read tool) to confirm it exists and show the user what will change. Only include fields that need to be modified in your update call. Log all changes by describing what was updated in your response.`;
  }

  if (permissions.create) {
    prompt += `\nWhen creating new records, confirm the details with the user before creating. After creation, report the new record's ID and key fields so the user can reference it.`;
  }

  prompt += `\n`;

  return prompt;
}

// ─── Tool Call Parser ───────────────────────────────────────────────────────

/**
 * Parse CRM tool calls from Claude's response text.
 * Extracts all <crm_tool_call name="...">...</crm_tool_call> blocks.
 */
export function parseCrmToolCalls(text: string): CrmToolCall[] {
  const calls: CrmToolCall[] = [];
  const regex = /<crm_tool_call\s+name="([^"]+)"(?:\s*\/>|>([\s\S]*?)<\/crm_tool_call>)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const name = match[1];
    const argsStr = match[2]?.trim() || "{}";
    try {
      const args = JSON.parse(argsStr);
      calls.push({ name, args });
    } catch {
      calls.push({ name, args: {} });
    }
  }

  return calls;
}

// ─── Tool Executor ──────────────────────────────────────────────────────────

/**
 * Execute a single CRM tool call. Validates permissions before execution.
 */
export async function executeCrmTool(
  toolCall: CrmToolCall,
  permissions: AgentPermissions,
): Promise<CrmToolResult> {
  const toolDef = ALL_TOOLS.find((t) => t.name === toolCall.name);
  if (!toolDef) {
    return { tool: toolCall.name, success: false, error: `Unknown tool: ${toolCall.name}` };
  }

  // Check permission
  const perm = toolDef.requiredPermission;
  if (perm === "read" && !permissions.read) {
    return { tool: toolCall.name, success: false, error: "Agent does not have read permission" };
  }
  if (perm === "write" && !permissions.write) {
    return { tool: toolCall.name, success: false, error: "Agent does not have write permission" };
  }
  if (perm === "create" && !permissions.create) {
    return { tool: toolCall.name, success: false, error: "Agent does not have create permission" };
  }
  if (perm === "delete" && !permissions.delete) {
    return { tool: toolCall.name, success: false, error: "Agent does not have delete permission" };
  }

  // Validate required parameters
  for (const param of toolDef.parameters) {
    if (param.required && (toolCall.args[param.name] === undefined || toolCall.args[param.name] === null)) {
      return { tool: toolCall.name, success: false, error: `Missing required parameter: ${param.name}` };
    }
  }

  try {
    const result = await executeToolFunction(toolCall);
    return { tool: toolCall.name, success: true, data: result };
  } catch (err: any) {
    return { tool: toolCall.name, success: false, error: err.message || "Tool execution failed" };
  }
}

/**
 * Execute multiple CRM tool calls and return all results.
 */
export async function executeCrmToolCalls(
  toolCalls: CrmToolCall[],
  permissions: AgentPermissions,
): Promise<CrmToolResult[]> {
  const results: CrmToolResult[] = [];
  for (const call of toolCalls) {
    const result = await executeCrmTool(call, permissions);
    results.push(result);
  }
  return results;
}

// ─── Internal Tool Function Dispatcher ──────────────────────────────────────

async function executeToolFunction(toolCall: CrmToolCall): Promise<unknown> {
  const { name, args } = toolCall;

  switch (name) {
    // ─── Read tools ─────────────────────────────────────────────────

    case "get_leads": {
      const limit = Math.min(Number(args.limit) || 50, 200);
      let leads;
      if (args.campaign_id) {
        leads = await storage.getLeadsByCampaignId(Number(args.campaign_id));
      } else if (args.account_id) {
        leads = await storage.getLeadsByAccountId(Number(args.account_id));
      } else {
        leads = await storage.getLeads();
      }
      // Trim to limit and return safe subset of fields
      return leads.slice(0, limit).map((l) => ({
        id: l.id,
        firstName: l.firstName,
        lastName: l.lastName,
        phone: l.phone,
        email: l.email,
        conversionStatus: l.conversionStatus,
        automationStatus: l.automationStatus,
        campaignId: l.campaignsId,
        accountId: l.accountsId,
        leadScore: l.leadScore,
        notes: l.notes ? (l.notes.length > 200 ? l.notes.slice(0, 200) + "…" : l.notes) : null,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      }));
    }

    case "get_lead_by_id": {
      const lead = await storage.getLeadById(Number(args.id));
      if (!lead) throw new Error(`Lead #${args.id} not found`);
      return lead;
    }

    case "get_campaigns": {
      let campaigns;
      if (args.account_id) {
        campaigns = await storage.getCampaignsByAccountId(Number(args.account_id));
      } else {
        campaigns = await storage.getCampaigns();
      }
      return campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        accountId: c.accountsId,
        description: c.description,
        dailyLeadLimit: c.dailyLeadLimit,
        aiModel: c.aiModel,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));
    }

    case "get_campaign_by_id": {
      const campaign = await storage.getCampaignById(Number(args.id));
      if (!campaign) throw new Error(`Campaign #${args.id} not found`);
      return campaign;
    }

    case "get_conversations": {
      const limit = Math.min(Number(args.limit) || 50, 200);
      let interactions;
      if (args.lead_id) {
        interactions = await storage.getInteractionsByLeadId(Number(args.lead_id));
      } else if (args.account_id) {
        interactions = await storage.getInteractionsByAccountId(Number(args.account_id));
      } else {
        interactions = await storage.getInteractions();
      }
      return interactions.slice(0, limit).map((i) => ({
        id: i.id,
        leadId: i.leadsId,
        direction: i.direction,
        content: i.content ? (i.content.length > 500 ? i.content.slice(0, 500) + "…" : i.content) : null,
        type: i.type,
        status: i.status,
        aiGenerated: i.aiGenerated,
        createdAt: i.createdAt,
      }));
    }

    case "get_tags": {
      let tags;
      if (args.account_id) {
        tags = await storage.getTagsByAccountId(Number(args.account_id));
      } else {
        tags = await storage.getTags();
      }
      return tags.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        category: t.category,
        accountId: t.accountsId,
      }));
    }

    case "get_accounts": {
      const accounts = await storage.getAccounts();
      return accounts.map((a) => ({
        id: a.id,
        name: a.name,
        phone: a.phone,
        ownerEmail: a.ownerEmail,
        type: a.type,
        status: a.status,
        timezone: a.timezone,
        businessNiche: a.businessNiche,
        businessDescription: a.businessDescription,
      }));
    }

    case "get_account_by_id": {
      const account = await storage.getAccountById(Number(args.id));
      if (!account) throw new Error(`Account #${args.id} not found`);
      return account;
    }

    case "get_lead_tags": {
      const leadTags = await storage.getTagsByLeadId(Number(args.lead_id));
      return leadTags;
    }

    // ─── Write tools ────────────────────────────────────────────────

    case "update_lead": {
      const id = Number(args.id);
      const existing = await storage.getLeadById(id);
      if (!existing) throw new Error(`Lead #${id} not found`);

      // Build update payload from allowed fields only
      const updateData: Record<string, unknown> = {};
      const allowedFields = ["firstName", "lastName", "phone", "email", "conversionStatus", "leadScore", "notes", "automationStatus"];
      for (const field of allowedFields) {
        if (args[field] !== undefined) {
          updateData[field] = args[field];
        }
      }
      if (Object.keys(updateData).length === 0) {
        throw new Error("No valid fields to update. Provide at least one of: " + allowedFields.join(", "));
      }

      // Validate conversionStatus if provided
      const validStatuses = ["New", "Contacted", "Qualified", "Converted", "Lost"];
      if (updateData.conversionStatus && !validStatuses.includes(updateData.conversionStatus as string)) {
        throw new Error(`Invalid conversionStatus. Must be one of: ${validStatuses.join(", ")}`);
      }

      // Validate leadScore if provided
      if (updateData.leadScore !== undefined) {
        const score = Number(updateData.leadScore);
        if (isNaN(score) || score < 0 || score > 100) {
          throw new Error("leadScore must be a number between 0 and 100");
        }
        updateData.leadScore = score;
      }

      const updated = await storage.updateLead(id, updateData);
      if (!updated) throw new Error(`Failed to update lead #${id}`);
      console.log(`[CRM Tool] update_lead #${id}: ${JSON.stringify(updateData)}`);
      return {
        updated: true,
        id,
        type: "lead",
        changes: updateData,
        lead: {
          id: (updated as any).id,
          firstName: (updated as any).firstName,
          lastName: (updated as any).lastName,
          conversionStatus: (updated as any).conversionStatus,
          leadScore: (updated as any).leadScore,
        },
      };
    }

    case "update_campaign": {
      const id = Number(args.id);
      const existing = await storage.getCampaignById(id);
      if (!existing) throw new Error(`Campaign #${id} not found`);

      const updateData: Record<string, unknown> = {};
      const allowedFields = ["name", "description", "status", "dailyLeadLimit"];
      for (const field of allowedFields) {
        if (args[field] !== undefined) {
          updateData[field] = args[field];
        }
      }
      if (Object.keys(updateData).length === 0) {
        throw new Error("No valid fields to update. Provide at least one of: " + allowedFields.join(", "));
      }

      // Validate status if provided
      const validCampaignStatuses = ["Draft", "Active", "Paused", "Completed"];
      if (updateData.status && !validCampaignStatuses.includes(updateData.status as string)) {
        throw new Error(`Invalid status. Must be one of: ${validCampaignStatuses.join(", ")}`);
      }

      const updated = await storage.updateCampaign(id, updateData);
      if (!updated) throw new Error(`Failed to update campaign #${id}`);
      console.log(`[CRM Tool] update_campaign #${id}: ${JSON.stringify(updateData)}`);
      return {
        updated: true,
        id,
        type: "campaign",
        changes: updateData,
        campaign: {
          id: (updated as any).id,
          name: (updated as any).name,
          status: (updated as any).status,
        },
      };
    }

    case "update_tag": {
      const id = Number(args.id);
      const updateData: Record<string, unknown> = {};
      const allowedFields = ["name", "color", "category"];
      for (const field of allowedFields) {
        if (args[field] !== undefined) {
          updateData[field] = args[field];
        }
      }
      if (Object.keys(updateData).length === 0) {
        throw new Error("No valid fields to update. Provide at least one of: " + allowedFields.join(", "));
      }

      const updated = await storage.updateTag(id, updateData);
      if (!updated) throw new Error(`Tag #${id} not found`);
      console.log(`[CRM Tool] update_tag #${id}: ${JSON.stringify(updateData)}`);
      return {
        updated: true,
        id,
        type: "tag",
        changes: updateData,
        tag: { id: (updated as any).id, name: (updated as any).name, color: (updated as any).color },
      };
    }

    case "add_lead_tag": {
      const leadId = Number(args.lead_id);
      const tagId = Number(args.tag_id);

      // Verify lead exists
      const lead = await storage.getLeadById(leadId);
      if (!lead) throw new Error(`Lead #${leadId} not found`);

      // Verify tag exists
      const existingTags = await storage.getTagsByLeadId(leadId);
      const alreadyHasTag = existingTags.some((t: any) => t.id === tagId || t.tagsId === tagId);
      if (alreadyHasTag) {
        return { added: false, leadId, tagId, type: "lead_tag", message: "Tag already assigned to this lead" };
      }

      const row = await storage.createLeadTag({ leadsId: leadId, tagsId: tagId });
      console.log(`[CRM Tool] add_lead_tag: lead #${leadId} + tag #${tagId}`);
      return { added: true, leadId, tagId, type: "lead_tag" };
    }

    // ─── Create tools ────────────────────────────────────────────────

    case "create_lead": {
      const leadData: Record<string, unknown> = {
        firstName: args.firstName as string,
      };

      // Optional fields
      if (args.lastName) leadData.lastName = args.lastName;
      if (args.phone) leadData.phone = args.phone;
      if (args.email) leadData.email = args.email;
      if (args.notes) leadData.notes = args.notes;
      if (args.source) leadData.source = args.source;
      if (args.campaign_id) leadData.campaignsId = Number(args.campaign_id);
      if (args.account_id) leadData.accountsId = Number(args.account_id);

      // Validate and set conversionStatus
      if (args.conversionStatus) {
        const validStatuses = ["New", "Contacted", "Qualified", "Converted", "Lost"];
        if (!validStatuses.includes(args.conversionStatus as string)) {
          throw new Error(`Invalid conversionStatus. Must be one of: ${validStatuses.join(", ")}`);
        }
        leadData.conversionStatus = args.conversionStatus;
      } else {
        leadData.conversionStatus = "New";
      }

      // Validate leadScore if provided
      if (args.leadScore !== undefined) {
        const score = Number(args.leadScore);
        if (isNaN(score) || score < 0 || score > 100) {
          throw new Error("leadScore must be a number between 0 and 100");
        }
        leadData.leadScore = score;
      }

      const created = await storage.createLead(leadData as any);
      console.log(`[CRM Tool] create_lead: ${JSON.stringify({ id: (created as any).id, firstName: args.firstName })}`);
      return {
        created: true,
        type: "lead",
        lead: {
          id: (created as any).id,
          firstName: (created as any).firstName,
          lastName: (created as any).lastName,
          email: (created as any).email,
          phone: (created as any).phone,
          conversionStatus: (created as any).conversionStatus,
        },
      };
    }

    case "create_campaign": {
      const campaignData: Record<string, unknown> = {
        name: args.name as string,
      };

      if (args.description) campaignData.description = args.description;
      if (args.account_id) campaignData.accountsId = Number(args.account_id);
      if (args.dailyLeadLimit) campaignData.dailyLeadLimit = Number(args.dailyLeadLimit);
      if (args.channel) campaignData.channel = args.channel;

      // Validate status if provided
      if (args.status) {
        const validStatuses = ["Draft", "Active", "Paused", "Completed"];
        if (!validStatuses.includes(args.status as string)) {
          throw new Error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
        }
        campaignData.status = args.status;
      } else {
        campaignData.status = "Draft";
      }

      const created = await storage.createCampaign(campaignData as any);
      console.log(`[CRM Tool] create_campaign: ${JSON.stringify({ id: (created as any).id, name: args.name })}`);
      return {
        created: true,
        type: "campaign",
        campaign: {
          id: (created as any).id,
          name: (created as any).name,
          status: (created as any).status,
          description: (created as any).description,
        },
      };
    }

    case "create_tag": {
      const tagData: Record<string, unknown> = {
        name: args.name as string,
      };

      if (args.color) tagData.color = args.color;
      if (args.category) tagData.category = args.category;
      if (args.account_id) tagData.accountsId = Number(args.account_id);

      const created = await storage.createTag(tagData as any);
      console.log(`[CRM Tool] create_tag: ${JSON.stringify({ id: (created as any).id, name: args.name })}`);
      return {
        created: true,
        type: "tag",
        tag: {
          id: (created as any).id,
          name: (created as any).name,
          color: (created as any).color,
          category: (created as any).category,
        },
      };
    }

    // ─── Delete tools ───────────────────────────────────────────────

    case "delete_lead": {
      const success = await storage.deleteLead(Number(args.id));
      if (!success) throw new Error(`Lead #${args.id} not found or already deleted`);
      return { deleted: true, id: args.id, type: "lead" };
    }

    case "delete_campaign": {
      const success = await storage.deleteCampaign(Number(args.id));
      if (!success) throw new Error(`Campaign #${args.id} not found or already deleted`);
      return { deleted: true, id: args.id, type: "campaign" };
    }

    case "delete_tag": {
      const success = await storage.deleteTag(Number(args.id));
      if (!success) throw new Error(`Tag #${args.id} not found or already deleted`);
      return { deleted: true, id: args.id, type: "tag" };
    }

    case "delete_lead_tag": {
      const success = await storage.deleteLeadTag(Number(args.lead_id), Number(args.tag_id));
      if (!success) throw new Error(`Lead-tag association not found`);
      return { deleted: true, leadId: args.lead_id, tagId: args.tag_id, type: "lead_tag" };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
