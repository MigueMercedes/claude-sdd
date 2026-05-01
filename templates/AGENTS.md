# {{PROJECT_NAME}}

> AI-assistant context for this project. Single source of truth — Codex, Cursor (fallback), and other tools that follow the [`AGENTS.md`](https://agents.md) standard read this file directly. Tools that load their own filename (Claude Code → `CLAUDE.md`, Gemini CLI → `GEMINI.md`, Copilot → `.github/copilot-instructions.md`) are pointed here via short shim files.
>
> Scaffolded by [`pragspec`](https://github.com/MigueMercedes/pragspec). Customize the placeholders below, then invoke the `sdd-init` skill (Claude Code) or its equivalent in your tool to fill them by reading the codebase.

## Project Overview

{{PROJECT_DESCRIPTION}}

**Stack**: {{STACK}}

---

## Repo Layout

{{REPO_LAYOUT}}

→ See `SPEC_PIPELINE.md` for the SDD process detail
→ See `docs/adr/` for architecture decisions
→ See `docs/runbooks/` for operational playbooks
→ See `specs/features/` for feature specifications

---

## Development Philosophy: Pragmatic SDD

This project uses **Pragmatic Spec-Driven Development** — spec by default for non-trivial changes, honest escape hatches for trivial fixes. The rigid "NO CODE without SPEC" rule does not apply: excessive friction kills the discipline and gets ignored.

### Pipeline (4 steps + verify)

```
1. SPEC          → 2. REVIEW       → 3. TESTS         → 4. IMPLEMENT     → 5. VERIFY
   (what/why)       (gaps/risks)      (Selective TDD)    (architecture)     (run/lint/smoke)
```

Detail: [SPEC_PIPELINE.md](./SPEC_PIPELINE.md).

### When to use each mode

| Mode | When it applies | Examples |
|---|---|---|
| **FULL** (all steps) | New feature, refactor with behavior change, schema/DB change, external integration, auth/permissions change | "Add recurring orders", "Migrate to new API version", "Integrate Stripe" |
| **FAST** (minimal spec + tests + impl + verify) | Bug fix with clear test failure, change in module with existing tests, refinement of already-specified behavior | "Reset token endpoint rejects expired", "Fix typo in error message" |
| **SHORT-CIRCUIT** (only impl + verify) | Typo, lint, format, comment-only change, documented dep bump, documented config change, hotfix during open incident | "Fix typo", "ruff fix", "bump httpx 0.27→0.28" |

**Golden rule**: if your change touches user-observable behavior (UI, API, DB schema, behavior), use FULL or FAST. If it only touches code quality/form without touching behavior, use SHORT-CIRCUIT.

### Output format (FULL/FAST modes)

For FULL/FAST the output follows this order:

1. **FINAL SPEC** (path: `specs/features/<area>/<slug>.spec.md`)
2. **SPEC REVIEW** (issues found, decisions)
3. **TEST CASES** (list of tests to write, aligned with Selective TDD)
4. **IMPLEMENTATION** (summary of changes + paths)
5. **VERIFICATION** (tests pass, lint clean, smoke result)

SHORT-CIRCUIT skips directly to diff + verify.

---

## Selective TDD

Test-first is NOT uniform. Depends on the type of code:

| Type of code | Strategy |
|---|---|
| Services, utils, business logic | **Test-first** — write the test, make it fail, implement |
| Endpoints / API handlers | **Test-first** — define request/response shape in test, then implement |
| Bug fixes (any layer) | **Failing-test-first** — reproduce the bug in test, then fix |
| Hooks, utils, lib functions | **Test-first** |
| UI components / pages | **Code-first** — implement visual, add tests if logic is reusable |
| Any change to a tested module | **Update tests in same commit** |

---

## Spec vs ADR — when to write each

| | **Spec** | **ADR** |
|---|---|---|
| Captures | what/how of a feature or behavior | architectural decision with tradeoffs |
| Typical size | 50-200 lines | 80-150 lines |
| Path | `specs/features/<area>/<slug>.spec.md` | `docs/adr/NNN-<slug>.md` |
| Audience | engineering + product | engineering (future maintainers) |
| Lifecycle | as long as the feature exists | permanent, reflects WHY something is the way it is |

**Rule**: if your work introduces or changes a pattern that affects multiple future features → write ADR (in addition to spec). If only affects one specific feature → only spec.

ADR template: `docs/adr/0000-template.md`.

---

## Project Constraints

{{CONSTRAINTS}}

<!--
TIP: invoke the `sdd` skill in Claude Code to populate this section based on
your codebase. Common constraints to document:
- Multi-tenancy boundaries
- Auth provider and required guards
- Notification channels (primary + fallback)
- External integrations (rate limits, costs, retries)
- Compliance requirements (GDPR, HIPAA, etc.)
- Performance budgets
- Browser/device support matrix
-->

---

## Available Skills

`pragspec` ships two skills:

| Skill | When to use |
|---|---|
| `sdd-init` | Customizes this `AGENTS.md` after install (replaces `{{PLACEHOLDERS}}`, proposes extensions, drafts the first ADR). Re-invoke later for a refresh — audits drift and bloat, proposes targeted edits. |
| `sdd` | Entry point for any non-trivial task — decides FULL/FAST/SHORT-CIRCUIT mode and orchestrates the pipeline. |

### Companion skills (optional, recommended)

If you have the [`superpowers`](https://github.com/obra/superpowers) plugin installed, these skills pair tightly with the SDD pipeline. **They are optional** — `sdd` works without them by handling each step inline. The `sdd` skill references this table at runtime: when a step says `[if available: superpowers:X]`, invoke X if installed; otherwise follow the embedded flow.

| Pipeline stage | Skill | Role |
|---|---|---|
| Pre-SPEC (intent) | `superpowers:brainstorming` | Explore requirements before non-trivial specs |
| Pre-SPEC (planning) | `superpowers:writing-plans` | Multi-day / multi-file tasks; plan feeds the spec |
| Pre-IMPLEMENT | `superpowers:executing-plans` | Execute a written plan with review checkpoints |
| TESTS | `superpowers:test-driven-development` | Enforce test-first where Selective TDD applies |
| IMPLEMENT (bugs) | `superpowers:systematic-debugging` | Any bug / test failure before proposing fix |
| VERIFY | `superpowers:verification-before-completion` | Evidence-based "done" gate at end of pipeline |
| Pre-PR | `superpowers:requesting-code-review` | Self-review before opening PR |
| Workspace setup | `superpowers:using-git-worktrees` | Isolate feature work in its own worktree |

If a skill above is missing, `sdd` falls back to the inline guidance in its `SKILL.md` and in `SPEC_PIPELINE.md`. No configuration needed — the model checks the skill list at runtime.

### Project-specific skills

Add your own under `.claude/skills/<name>/SKILL.md` and document them above.

---

## Verification gate (step 5 of pipeline)

Before claiming "done" on any FULL or FAST task:

1. **Tests pass**: run the relevant test suite for your stack
2. **Lint clean**: run the linter for your stack
3. **CI green**: after pushing, wait for CI before continuing
4. **Smoke test if UI changed**: navigate the affected flow on staging/local
5. **Migration tested if DB schema changed**: up + down + idempotence

See §Available Skills above for the companion skill that automates this gate.

---

## Enforcement

- **Spec missing and FULL/FAST applies** → CREATE the spec before touching code
- **Ambiguous spec** → mark `## ASSUMPTIONS` explicitly in the spec, do not assume silently
- **Changes outside spec** → update the spec in the same commit, no drift
- **Tests must match spec** — if tests fail because the spec was wrong, update the spec first
- **Deterministic behavior** — do not introduce randomness/timing dependencies without documented reason
