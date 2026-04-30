# {{PROJECT_NAME}}

> AI-assistant context for this project. Single source of truth — Codex, Cursor (fallback), and other tools that follow the [`AGENTS.md`](https://agents.md) standard read this file directly. Tools that load their own filename (Claude Code → `CLAUDE.md`, Gemini CLI → `GEMINI.md`, Copilot → `.github/copilot-instructions.md`) are pointed here via short shim files.
>
> Scaffolded by [`claude-sdd`](https://github.com/MigueMercedes/claude-sdd). Customize the placeholders below, then invoke the `sdd-init` skill (Claude Code) or its equivalent in your tool to fill them by reading the codebase.

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

`claude-sdd` ships two skills:

| Skill | When to use |
|---|---|
| `sdd-init` | Customizes this `AGENTS.md` after install (replaces `{{PLACEHOLDERS}}`, proposes extensions, drafts the first ADR). Re-invoke later for a refresh — audits drift and bloat, proposes targeted edits. |
| `sdd` | Entry point for any non-trivial task — decides FULL/FAST/SHORT-CIRCUIT mode and orchestrates the pipeline. |

If you also have the [`superpowers`](https://github.com/obra/superpowers) plugin installed, these companion skills pair well with the SDD pipeline. **They are optional** — `sdd` works without them by handling each step inline.

| Skill (optional) | When to use |
|---|---|
| `superpowers:brainstorming` | Before generating non-trivial specs — explore requirements |
| `superpowers:test-driven-development` | When applying test-first (services, endpoints, bug fixes) |
| `superpowers:verification-before-completion` | Step 5 of pipeline — before claiming done |
| `superpowers:systematic-debugging` | Any bug/test failure before proposing fix |
| `superpowers:writing-plans` | Before touching code in multi-step tasks |

Add your project-specific skills in `.claude/skills/<name>/SKILL.md` and document them here.

---

## Verification gate (step 5 of pipeline)

Before claiming "done" on any FULL or FAST task:

1. **Tests pass**: run the relevant test suite for your stack
2. **Lint clean**: run the linter for your stack
3. **CI green**: after pushing, wait for CI before continuing
4. **Smoke test if UI changed**: navigate the affected flow on staging/local
5. **Migration tested if DB schema changed**: up + down + idempotence

→ Skill `superpowers:verification-before-completion` enforces this systematically.

---

## Enforcement

- **Spec missing and FULL/FAST applies** → CREATE the spec before touching code
- **Ambiguous spec** → mark `## ASSUMPTIONS` explicitly in the spec, do not assume silently
- **Changes outside spec** → update the spec in the same commit, no drift
- **Tests must match spec** — if tests fail because the spec was wrong, update the spec first
- **Deterministic behavior** — do not introduce randomness/timing dependencies without documented reason
