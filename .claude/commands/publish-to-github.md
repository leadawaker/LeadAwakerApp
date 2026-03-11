# Publish Feature to GitHub

Publish a feature spec to GitHub as an epic with phase issues and a project board.

Feature: $ARGUMENTS

## Prerequisites

- `gh` CLI must be authenticated (`gh auth status`)
- Project scopes needed: `gh auth refresh -s project,read:project`
- Feature folder must exist in `/specs/` with `requirements.md` and `implementation-plan.md`

## Instructions

### 1. Identify the Feature

Find the feature folder at `/specs/{feature-name}/`. If no argument provided, list available specs and ask.

### 2. Extract Info

- **Feature name**: folder name (kebab-case)
- **Feature title**: main heading from `requirements.md`
- **Phases**: all phases from `implementation-plan.md` with titles, descriptions, task checklists

### 3. Get Repository Info

```bash
gh repo view --json nameWithOwner,owner -q '.nameWithOwner + " " + .owner.login'
```

### 4. Create Labels

```bash
gh label create "epic" --color "7057ff" --description "Feature epic" 2>/dev/null || true
gh label create "feature/{feature-name}" --color "0E8A16" --description "Feature: {title}" 2>/dev/null || true
```

Create `phase-N` labels for each phase.

### 5. Create Epic Issue

```bash
gh issue create \
  --title "Epic: {Feature Title}" \
  --label "epic" \
  --label "feature/{feature-name}" \
  --body-file specs/{feature-name}/requirements.md
```

### 6. Create Phase Issues

For each phase, create an issue with the task checklist and technical details from the implementation plan. Label with `feature/{feature-name}` and `phase-N`.

For tasks marked `[complex]` or with nested sub-tasks, optionally create separate issues linked to the parent phase.

### 7. Update Epic with Phase Links

Edit the epic to append a checklist of all phase issues.

### 8. Create GitHub Project

```bash
gh project create --title "Feature: {Feature Title}" --owner {owner}
gh project link {project-number} --owner {owner} --repo {repository}
```

Add all issues to the project.

### 9. Create github.md

Save all references in `specs/{feature-name}/github.md`:

```markdown
---
feature_name: {feature-name}
feature_title: {Feature Title}
repository: {repository}
epic_issue: {epic-number}
project_number: {project-number}
published_at: {date}
---

# GitHub References

- [Epic Issue](https://github.com/{repository}/issues/{epic-number})
- [Project Board](https://github.com/users/{owner}/projects/{project-number})

## Phase Issues
| # | Title | Tasks | Status |
|---|-------|-------|--------|
| #{n} | Phase N: {Title} | {count} | Open |
```

### 10. Report Summary

Show: epic URL, phase count, total tasks, project board URL, and github.md location.

Remind user to use `/continue-feature {feature-name}` to start implementing.
