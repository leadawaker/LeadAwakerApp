# Agentic Coding Workflow — LeadAwakerApp

A spec-driven development workflow adapted from [leonvanzyl/agentic-coding-starter-kit](https://github.com/leonvanzyl/agentic-coding-starter-kit) for the LeadAwaker projects.

---

## What Was Added

### Slash Commands (`.claude/commands/`)

| Command | What it does |
|---------|-------------|
| `/create-spec` | Creates a structured feature spec in `specs/{feature-name}/` with requirements, implementation plan, and manual action items |
| `/continue-feature {name}` | Picks the next unchecked task from a spec and implements it autonomously, then marks it done |
| `/publish-to-github {name}` | Publishes a spec to GitHub as an epic issue + phase issues + project board for tracking |
| `/checkpoint` | Creates a comprehensive git commit of all current changes |

### Agents (`.claude/agents/`)

| Agent | What it does |
|-------|-------------|
| `coder` | A disciplined implementation agent that researches first, implements second, and verifies third. Knows the LeadAwakerApp stack (React 19, TypeScript, Vite, Tailwind, shared Drizzle schema) |

### Directory

| Path | Purpose |
|------|---------|
| `specs/` | Feature specifications live here. Each feature gets its own subfolder |

---

## How To Use It

### The Full Workflow (New Feature, Start to Finish)

**Step 1 — Plan the feature with Claude:**

Have a conversation about what you want to build. Describe the feature, discuss options, work out the details. Then:

```
/create-spec
```

Claude will generate three files in `specs/{feature-name}/`:
- `requirements.md` — what and why
- `implementation-plan.md` — phased tasks with technical details
- `action-required.md` — manual steps you need to do (API keys, env vars, etc.)

**Step 2 — Review and adjust:**

Read the generated spec. Edit anything that's wrong or missing. The implementation plan is the single source of truth — if it's not in there, Claude won't know about it.

**Step 3 — (Optional) Publish to GitHub:**

```
/publish-to-github {feature-name}
```

Creates an epic issue, phase issues with task checklists, labels, and a project board. Great for tracking progress visually. Requires `gh` CLI to be authenticated.

**Step 4 — Implement task by task:**

```
/continue-feature {feature-name}
```

Claude will:
1. Find the next unchecked task
2. Show you what it's about to do
3. Implement it following project patterns
4. Run type checks
5. Mark the task as done
6. Commit the change

Run it again to do the next task. Repeat until done.

---

### Quick Use Cases

**"I just want to plan, not implement yet":**
```
/create-spec
```
Review the spec at your own pace. Come back later with `/continue-feature`.

**"I want Claude to implement something specific right now":**
Just describe the task directly — you don't need the spec workflow for small changes. The spec workflow shines for multi-step features.

**"I want to save my progress":**
```
/checkpoint
```
Creates a descriptive git commit of everything staged and unstaged.

**"I want to use the coder agent for higher-quality implementation":**
When working on a task, you can reference the coder agent in your conversation for more disciplined, research-first implementation.

---

## Works With Both Projects

The same commands and workflow are installed in **both** projects:

| Project | Location |
|---------|----------|
| **LeadAwakerApp** (frontend) | `/config/workspace/LeadAwakerApp/.claude/` |
| **Automations** (backend engine) | `/home/gabriel/docker/code-server/automations/.claude/` |

Each project's commands and agents are tailored to its specific stack and conventions. The `create-spec` command knows about React components for the app, and Python services for the engine.

---

## Tips

- **Keep specs updated** — If you change your mind during implementation, update the spec so future `/continue-feature` calls know the latest plan
- **One feature per spec folder** — Don't mix unrelated work in the same spec
- **The implementation plan is king** — Technical details in there are what Claude uses for context. Be thorough
- **Offline mode works fine** — You don't need GitHub integration. Without it, tasks are tracked directly in `implementation-plan.md` via checkboxes
- **Complex tasks get `[complex]`** — Tag tasks that need their own GitHub issue or have sub-tasks. This helps with tracking and parallel work
