# Create Feature Spec

Create a structured feature specification for a new feature.

## Instructions

### Given the above conversation:

1. **Create feature folder**
   - Store in `/specs/{feature-name}/` (kebab-case)

2. **Create requirements.md**
   - What the feature does and why
   - Acceptance criteria
   - Related features or dependencies

3. **Create implementation-plan.md**
   - Split into phases with actionable tasks
   - Each task has a checkbox: `- [ ] Task description`
   - Tasks must be specific enough for an agent to implement independently
   - Mark complex tasks with `[complex]` suffix
   - Add `### Technical Details` after each phase's tasks
   - Capture ALL technical specifics: CLI commands, schemas, code snippets, file paths, config values
   - **This is the single source of truth** — anything not captured here is lost

4. **Create action-required.md**
   - Manual steps requiring human action (API keys, accounts, env vars, etc.)
   - Each task has a checkbox and brief context
   - If none needed, note "No manual steps required"

5. **Exclude testing tasks** unless the user explicitly asks for them

### If no conversation exists:

Ask the user what the requirements are first, then create the spec.

## Implementation Plan Format

```markdown
# Implementation Plan: {Feature Name}

## Overview
Brief summary of what will be built.

## Phase 1: {Phase Name}
{Brief description of this phase's goal}

### Tasks
- [ ] Task 1 description
- [ ] Task 2 description (depends on Task 1)
- [ ] Task 3 description [complex]
  - [ ] Sub-task 3a
  - [ ] Sub-task 3b

### Technical Details
{CLI commands, code snippets, schemas, file paths, env vars, API endpoints relevant to this phase}

## Phase 2: {Phase Name}
...
```

## Project-Specific Notes

This is the **LeadAwakerApp** project (React 19 + TypeScript + Vite frontend):
- UI components are in `src/components/`
- Pages/routes in `src/pages/`
- Shared schema (Drizzle ORM) at `shared/schema.ts`
- API calls go to the automation engine at `192.168.1.107:8100`
- Use existing component patterns and Tailwind CSS styling
- Run `npx tsc --noEmit` after changes to verify types

## action-required.md Format

```markdown
# Action Required: {Feature Name}

Manual steps that must be completed by a human.

## Before Implementation
- [ ] **{Action}** - {Brief reason}

## During Implementation
- [ ] **{Action}** - {Brief reason}

## After Implementation
- [ ] **{Action}** - {Brief reason}
```

## Next Steps

After creating the spec, inform the user:

> Feature specification created at `specs/{feature-name}/`
>
> **Next steps:**
> 1. Review `action-required.md` for manual tasks
> 2. Review the requirements and implementation plan
> 3. Run `/publish-to-github` to create GitHub issues (optional)
> 4. Use `/continue-feature` to start implementing

## Notes

- Keep tasks atomic — each implementable in a single session
- Tasks should produce working, testable code when complete
- Note dependencies explicitly when tasks must be done in order
- Mark a task `[complex]` when it has sub-tasks, spans multiple files/systems, or needs architectural decisions
