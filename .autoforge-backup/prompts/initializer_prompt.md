# Initializer Prompt — Lead Awaker Agents

## YOUR ROLE

You are the **Project Initializer** — responsible for reading the app specification and creating the feature set that autonomous coding agents will implement across multiple sessions.

## INSTRUCTIONS

1. Read the app specification at `.autoforge/prompts/app_spec.txt`
2. Create the complete feature set using the `feature_create_bulk` tool
3. Ensure features are ordered by dependency (infrastructure first, then foundation, then dependent features)

## REQUIRED FEATURE COUNT

**CRITICAL:** You must create exactly **80** features using the `feature_create_bulk` tool. This count was agreed upon during the specification phase and must be respected exactly.

## MANDATORY INFRASTRUCTURE FEATURES (Indices 0-4)

The first 5 features MUST be Infrastructure features with NO dependencies:

| Index | Feature | Category |
|-------|---------|----------|
| 0 | Database connection established | Infrastructure |
| 1 | Database schema applied correctly (ai_agents, agent_conversations, agent_messages, agent_files tables) | Infrastructure |
| 2 | Data persists across server restart | Infrastructure |
| 3 | No mock data patterns in codebase | Infrastructure |
| 4 | Backend API queries real database | Infrastructure |

## FEATURE CATEGORIES AND ORDERING

After infrastructure (0-4), create features in this order:

### Agent Management (indices 5-14, ~10 features)
- CRUD operations for agents
- Clone from Code Runner template
- Admin-only access gate
- Link prompts from Prompts library
- Model and thinking defaults
- Permission configuration

### Chat Core (indices 15-28, ~14 features)
- Send/receive messages
- SSE streaming token-by-token
- Message persistence
- Conversation history
- Clear/close conversations
- Auto-generated titles
- Multiple concurrent conversations
- Markdown rendering
- Code blocks with syntax highlighting + copy
- Token usage display
- Error handling

### Model & Thinking Controls (indices 29-33, ~5 features)
- Model switcher (Sonnet/Opus/Haiku)
- Thinking toggle
- Defaults (Sonnet, medium thinking)
- Settings persist per agent

### Files & Media (indices 34-41, ~8 features)
- PDF, image, spreadsheet uploads
- Voice memo recording
- Voice transcription
- File preview in chat
- Agent file analysis
- GOG integration

### Skills (indices 42-44, ~3 features)
- Load global skills
- Execute skills in chat
- Display skill results

### Page Awareness (indices 45-50, ~6 features)
- Current page detection
- On-screen data detection
- Context injection to system prompt
- Auto-update on navigation
- Toggle to disable

### CRM Actions & Permissions (indices 51-57, ~7 features)
- Read/write/create/delete CRM data
- Per-agent permission config
- Confirmation for destructive actions
- Direct database access

### Persistent Chat Widget (indices 58-66, ~9 features)
- Widget persists across navigation
- Agent tab icons
- Widget ↔ full page sync
- Conversation title display
- Open/close/resize
- State preservation

### Full Page Chat (indices 67-70, ~4 features)
- Agent chat in Conversations page
- Agent selection/switching
- Full-width experience
- Agent list

### Mobile (indices 71-75, ~5 features)
- Responsive chat UI
- Touch-friendly controls
- Mobile voice recording
- Mobile file upload
- Mobile widget behavior

### Campaign Crafter (indices 76-79, ~4 features)
- Campaign context prompt
- Suggestion generation
- Client account analysis
- Spreadsheet analysis

## DEPENDENCY RULES

- All features depend on Infrastructure (0-4)
- Chat Core depends on Agent Management
- Model & Thinking Controls depend on Chat Core
- Files & Media depends on Chat Core
- Skills depends on Chat Core
- Page Awareness depends on Chat Core
- CRM Actions depends on Chat Core + Agent Management
- Persistent Chat Widget depends on Chat Core
- Full Page Chat depends on Chat Core
- Mobile depends on Chat Core + Widget + Full Page
- Campaign Crafter depends on Chat Core + Files & Media + CRM Actions

## IMPORTANT NOTES

- This is an **evolution** of an existing system — Campaign Crafter and Code Runner already exist but need fixing
- The CRM already has: Conversations page, SupportChatWidget, Prompts library, lead/campaign data
- Tech stack: React/TypeScript frontend, Node.js/Express backend, PostgreSQL, Tailwind CSS
- Admin-only feature — no regular user access to agents
- All agent chat uses the user's own Anthropic API key
- GOG CLI is used for Google Workspace access (not MCP)
