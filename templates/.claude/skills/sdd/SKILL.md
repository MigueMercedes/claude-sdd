---
name: sdd
description: Pragmatic Spec-Driven Development pipeline. Invoke ALWAYS when receiving a task that touches code in this project before planning or implementing. Decides mode (FULL/FAST/SHORT-CIRCUIT) based on heuristics, loads the project SDD context, and directs to the corresponding pipeline.
---

# Pragmatic SDD

This skill is the entry point of the SDD flow for individual tasks. Invoke it when starting any non-trivial task. It guides you to decide the mode of work, what docs to read, and when to write specs vs when not.

## When to invoke

- The user asks for any change to code (feature, bug, refactor, fix)
- Before touching files in the project
- Before invoking `superpowers:writing-plans` or `feature-dev:feature-dev` (this skill decides mode, those do the work)
- When a new session starts and you are not sure what process to follow

**Do NOT invoke** for pure conversational queries (questions about the codebase, "what does X do", "where does Y live"). For those use `Read`/`Bash` directly.

---

## Pre-check: is the project context set up?

Before classifying any task, glance at `AGENTS.md`. If it still contains literal `{{PLACEHOLDER}}` strings (e.g. `{{PROJECT_DESCRIPTION}}`, `{{REPO_LAYOUT}}`, `{{CONSTRAINTS}}`), the project was recently scaffolded by `pragspec init` but the per-project context was never filled in. Tell the user:

> Your `AGENTS.md` still has unresolved placeholders. Run `/sdd-init` first to customize it for this project — I can pick up the task right after.

The `sdd-init` skill handles first-time setup (and later refreshes). Don't try to do that work from inside `sdd` — keep this skill focused on task orchestration.

---

## Companion skill convention

Throughout the pipeline below you will see lines tagged `[if available: superpowers:X]` followed by an `[embedded fallback]`. The convention:

1. Check the skill list in your current `system-reminder`.
2. If `superpowers:X` is present, invoke it via the `Skill` tool — it handles the step.
3. If it is not present, follow the `[embedded fallback]` line — usually a prompt under `specs/prompts/` or an inline checklist.

The canonical mapping of stages → companion skills lives in [`AGENTS.md` §Available Skills](../../../AGENTS.md#available-skills). Do not duplicate or rewrite it elsewhere; reference it.

---

## Step 1: classify the mode

Apply this decision tree:

```
Does the change touch user-observable behavior?
├─ NO (typo, lint, comment, dep bump, config doc, file rename without ref change)
│  → SHORT-CIRCUIT
│
└─ YES
   ├─ Is it a bug fix with clear test failure or module with existing tests?
   │  → FAST
   │
   └─ It's feature/refactor/schema/integration/auth boundary
      → FULL
```

**If you doubt between FAST and FULL: choose FULL.** The overhead of full spec (~30 min) is much less than the cost of discovering gaps in post-merge review.

**If you doubt between SHORT-CIRCUIT and FAST: choose FAST.** If you are going to touch behavior, the minimal spec is worth it.

### Classified examples

| Task | Mode | Reason |
|---|---|---|
| "Fix typo in pricing page" | SHORT-CIRCUIT | Just a string, no behavior |
| "Bump httpx 0.27 → 0.28" | SHORT-CIRCUIT | Dependency, no API change |
| "Reset password rejects expired tokens with message X" | FAST | Bug, tested module |
| "Implement installment payments via Stripe" | FULL | Feature, external integration, billing |
| "Migrate to new schema for users" | FULL | Schema change, multi-tenant if applicable, legacy data |
| "Add notes field to entity X" | FULL | Schema change |
| "Refactor notification_service to support push" | FULL | Behavior change + new integration |
| "Rename `getUsers` → `listUsers`" | SHORT-CIRCUIT | No behavior |

---

## Step 2: read critical context

Regardless of mode, read BEFORE touching code:

1. **`AGENTS.md`** — SDD philosophy, escape hatches, repo map, project constraints
2. **ADRs in `docs/adr/`** if your change touches active architectural patterns
3. **Existing specs** in `specs/features/<area>/` of the affected area (consistency, no-duplication)
4. **`TASKS.md`** if there is an associated ticket

For FULL/FAST: also read
5. **`SPEC_PIPELINE.md`** for the detail of each step

---

## Step 3: execute the corresponding pipeline

### FULL pipeline

For complex tasks (>1 day estimated, multi-file), do BEFORE Step 1:

- `[if available: superpowers:writing-plans]` → write the plan first; the plan feeds the spec
- `[if available: superpowers:using-git-worktrees]` → isolate the work in its own worktree
- `[embedded fallback]` → ask the user to outline scope in 5-10 bullets, then proceed

Then:

1. **SPEC**
   - `[if available: superpowers:brainstorming]` → explore intent + requirements first
   - `[embedded fallback]` → use `specs/prompts/spec-generator.md`, output to `specs/features/<area>/<slug>.spec.md`
2. **REVIEW**
   - `[embedded only]` → use `specs/prompts/spec-reviewer.md`, edit the same spec with `## Review notes` section
3. **TESTS**
   - `[if available: superpowers:test-driven-development]` → drives test-first per Selective TDD
   - `[embedded fallback]` → use `specs/prompts/test-generator.md`, respect Selective TDD
4. **IMPLEMENT**
   - `[if available + you have a plan: superpowers:executing-plans]` → execute with review checkpoints
   - `[if bug fix: superpowers:systematic-debugging]` → diagnose before proposing a fix
   - `[embedded fallback]` → use `specs/prompts/implementation.md`, respect ADRs and project architecture
5. **VERIFY**
   - `[if available: superpowers:verification-before-completion]` → preferred; evidence before assertions
   - `[embedded fallback]` → tests pass + lint clean + CI green + (smoke if UI) + (migration if schema)

After VERIFY, before opening PR:

- `[if available: superpowers:requesting-code-review]` → self-review against the spec

### FAST pipeline

1. **SPEC minimal**
   - `[embedded only]` → only Context + Validation Rules + Edge Cases + Errors + Tests strategy. Output to `specs/features/<area>/<slug>.spec.md` anyway. Skip brainstorming — FAST is for bugs / refinements with clear scope.
2. **TESTS**
   - `[if available: superpowers:test-driven-development]` → drives failing-test-first for bugs, test-first for new validation
   - `[embedded fallback]` → write a failing test reproducing the bug, then proceed
3. **IMPLEMENT**
   - `[if bug fix: superpowers:systematic-debugging]` → diagnose before fix
   - `[embedded fallback]` → respect architecture and ADRs
4. **VERIFY**
   - `[if available: superpowers:verification-before-completion]` → preferred
   - `[embedded fallback]` → tests + lint + CI green

Skip formal review — review happens in commit message.

### SHORT-CIRCUIT pipeline

1. **IMPLEMENT** direct
2. **VERIFY**
   - `[if available: superpowers:verification-before-completion]` → preferred even for short tasks
   - `[embedded fallback]` → existing tests pass + lint clean + CI green

Skip everything else. DO NOT write spec — would be noise.

---

## Step 4: project-specific skills

Beyond the companion skills referenced inline above (canonical list in [`AGENTS.md` §Available Skills](../../../AGENTS.md#available-skills)), check `.claude/skills/` in this project for skills specific to your domain — billing, auth, multi-tenant, etc. Apply them in the relevant step.

---

## Step 5: output format

### FULL/FAST

Your response when you complete the task follows this order:

```
## 1. SPEC
Path: specs/features/<area>/<slug>.spec.md
[link or summary of the spec]

## 2. SPEC REVIEW (FULL only)
Issues found, decisions taken

## 3. TEST CASES
List of tests written, with paths

## 4. IMPLEMENTATION
Summary of changes + paths of modified files

## 5. VERIFICATION
- Tests: <result>
- Lint: <result>
- CI: <link to run>
- Smoke (if applicable): <description>
```

### SHORT-CIRCUIT

Only:
```
## CHANGE
Diff summary + paths

## VERIFICATION
- Existing tests pass
- Lint clean
- CI: <link>
```

---

## Hard rules

- **Do not start implementing without classifying the mode**. Five minutes thinking the mode saves hours of reverting.
- **Do not write spec for SHORT-CIRCUIT**. It's noise and kills the discipline.
- **Do not skip VERIFY in any mode**. Even for SHORT-CIRCUIT, existing tests must pass.
- **If you find drift between spec and code during implementation**: update spec in the same commit. Drift without documenting is how SDD breaks silently.
- **If you doubt the mode, ask the user what they prefer**. A 30-second question vs 30 min of overhead.

---

## How to invoke downstream pipeline

When you've decided the mode, do not implement directly. For each step, prefer the companion skill if available; otherwise apply the embedded prompt:

- **SPEC**: `[if available: superpowers:brainstorming]` → then `specs/prompts/spec-generator.md`. If not available, just `specs/prompts/spec-generator.md`.
- **REVIEW**: `specs/prompts/spec-reviewer.md` (no companion skill — embedded only).
- **TESTS**: `[if available: superpowers:test-driven-development]` → then `specs/prompts/test-generator.md`. If not available, just `specs/prompts/test-generator.md`.
- **IMPLEMENT**: `[if available + plan exists: superpowers:executing-plans]`; `[if bug: superpowers:systematic-debugging]` → then `specs/prompts/implementation.md`. If neither companion is available, just `specs/prompts/implementation.md`.
- **VERIFY**: `[if available: superpowers:verification-before-completion]`. If not available, run the embedded checklist from `SPEC_PIPELINE.md` Step 5.

The prompts of each step have the project context already embedded (set by `/sdd-init`), so you don't need to re-explain it.
