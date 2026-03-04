# Continue Feature

Find and implement the next available task for a feature spec.

Feature: $ARGUMENTS

## Instructions

### 1. Locate the Feature

Find the feature folder at `/specs/{feature-name}/` containing:
- `requirements.md` — Feature requirements
- `implementation-plan.md` — Task breakdown
- `github.md` — GitHub references (optional)

If no feature name is provided as argument, list available features in `/specs/` and ask.

### 2. Determine Tracking Mode

**GitHub mode** (if `github.md` exists and `gh` is available):
- Parse `github.md` for `epic_issue`, `repository`, `project_number`
- Query open issues: `gh issue list --label "feature/{feature-name}" --state open --json number,title,body,labels --limit 100`
- Find the next unchecked task from phase issues

**Offline mode** (no `github.md` or no `gh`):
- Read `implementation-plan.md` directly
- Find the first unchecked task `- [ ]`
- Work from the markdown file

### 3. Select Next Work Item

**Priority order:**
1. Complex task issues first (if GitHub mode)
2. Earliest open phase, first unchecked task

If all tasks are done, report completion.

### 4. Display Task Info

Before implementing, show:
```
Next Task: {task description}
Phase: {phase number} - {phase title}
Task: {n} of {total}

Proceeding with implementation...
```

### 5. Read Context

Before implementing:
1. Read `requirements.md` for feature context
2. Review the phase's Technical Details section
3. Explore relevant parts of the codebase

### 6. Implement

Follow existing code patterns in the project:
- React components in `src/components/`, pages in `src/pages/`
- Use existing Tailwind CSS patterns and component styles
- API calls to automation engine at `192.168.1.107:8100`
- Shared types from `shared/schema.ts`
- Run `npx tsc --noEmit` after changes

### 7. Update Tracking

**GitHub mode:**
- Check off the task in the phase issue body
- Comment with implementation details and files changed
- Update project board status if applicable

**Offline mode:**
- Check off the task in `implementation-plan.md`: change `- [ ]` to `- [x]`

### 8. Commit Changes

```bash
git add -A
git commit -m "feat: {task title}"
```

### 9. Report Completion

```
Task complete: {task description}
Phase: {phase number} - {phase title}
Progress: {completed}/{total} tasks in this phase

Changes made:
- {summary of files changed}

Next: say "continue" or run /continue-feature {feature-name} again
```

## Edge Cases

- **No specs folder**: Ask user to run `/create-spec` first
- **All phases complete**: Celebrate and offer to close the epic
- **Phase complete**: Auto-advance to next phase
- **Lint/type errors**: Fix before committing

## Notes

- Implement ALL tasks in the current invocation unless user says otherwise
- Always run type checks before committing
- If a task is unclear, ask for clarification rather than guessing
