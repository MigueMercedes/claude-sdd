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

Before classifying any task, glance at `AGENTS.md`. If it still contains literal `{{PLACEHOLDER}}` strings (e.g. `{{PROJECT_DESCRIPTION}}`, `{{REPO_LAYOUT}}`, `{{CONSTRAINTS}}`), the project was recently scaffolded by `claude-sdd init` but the per-project context was never filled in. Tell the user:

> Your `AGENTS.md` still has unresolved placeholders. Run `/sdd-init` first to customize it for this project — I can pick up the task right after.

The `sdd-init` skill handles first-time setup (and later refreshes). Don't try to do that work from inside `sdd` — keep this skill focused on task orchestration.

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

```
1. SPEC      → use specs/prompts/spec-generator.md, output to specs/features/<area>/<slug>.spec.md
2. REVIEW    → use specs/prompts/spec-reviewer.md, edit the same spec with Review notes section
3. TESTS     → use specs/prompts/test-generator.md, respect Selective TDD
4. IMPLEMENT → use specs/prompts/implementation.md, respect project architecture
5. VERIFY    → use superpowers:verification-before-completion
```

For complex tasks (>1 day estimated, multi-file): invoke `superpowers:writing-plans` BEFORE Step 1. The resulting plan feeds the spec.

### FAST pipeline

```
1. SPEC minimal → only Context + Validation Rules + Edge Cases + Errors + Tests strategy. Output to specs/features/<area>/<slug>.spec.md anyway
2. TESTS        → failing-test-first if it's a bug, test-first if new validation
3. IMPLEMENT    → respect architecture and ADRs
4. VERIFY       → tests + lint + CI green
```

Skip formal review — review happens in commit message.

### SHORT-CIRCUIT pipeline

```
1. IMPLEMENT direct
2. VERIFY: existing tests pass + lint clean + CI green
```

Skip everything else. DO NOT write spec — would be noise.

---

## Step 4: applicable skills

Identify and use relevant skills based on the area of change:

| Your change touches... | Use skill |
|---|---|
| Project-specific patterns | Look for skills in `.claude/skills/` of your project |
| Bug debugging | `superpowers:systematic-debugging` |
| TDD enforcement | `superpowers:test-driven-development` |
| Verification at the end | `superpowers:verification-before-completion` |
| Brainstorming requirements | `superpowers:brainstorming` |
| Multi-step plan | `superpowers:writing-plans` |

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

When you've decided the mode, do not implement directly: invoke the corresponding prompt:

- For **SPEC**: read `specs/prompts/spec-generator.md` and apply
- For **REVIEW**: read `specs/prompts/spec-reviewer.md` and apply
- For **TESTS**: read `specs/prompts/test-generator.md` and apply
- For **IMPLEMENT**: read `specs/prompts/implementation.md` and apply
- For **VERIFY**: invoke skill `superpowers:verification-before-completion`

The prompt of each step has the project context already embedded (set by `/sdd-init`), you don't need to re-explain it.
