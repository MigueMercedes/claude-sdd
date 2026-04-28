# claude-sdd

> **Pragmatic Spec-Driven Development for Claude Code.** Scaffold a complete, opinionated SDD workflow into any project in 30 seconds. The smarts live in a Claude Code skill that decides FULL/FAST/SHORT-CIRCUIT mode for each task and orchestrates the pipeline.

[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

```bash
npx github:MigueMercedes/claude-sdd init
```

---

## Table of contents

- [Why SDD?](#why-sdd)
- [What "Pragmatic" means](#what-pragmatic-means)
- [Quickstart](#quickstart)
- [End-to-end walk-through](#end-to-end-walk-through)
- [What gets installed](#what-gets-installed)
- [Anatomy of a spec](#anatomy-of-a-spec)
- [Extensions](#extensions)
- [Spec vs ADR](#spec-vs-adr)
- [Selective TDD](#selective-tdd)
- [Install options](#install-options)
- [The `sdd` skill](#the-sdd-skill)
- [FAQ](#faq)
- [Troubleshooting](#troubleshooting)
- [Comparison to alternatives](#comparison-to-alternatives)
- [Architecture of this package](#architecture-of-this-package)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Why SDD?

AI-assisted coding has a tax: agents need context to be useful. The first 30 minutes of every new session is "remind the agent of conventions, architecture, why we made decision X". Most teams solve this with `CLAUDE.md` files — but those grow into 500-line walls of text that nobody updates and the agent skims.

**Spec-Driven Development** flips that: the spec for each feature is the source of truth. The agent reads the spec, knows exactly what to build, and writes tests against the spec — not against its assumption of what you meant.

The catch: classical SDD is rigid. "No code without spec" sounds great until you need to fix a typo and the process forces you to write a 3-page document. People drop the discipline within a week.

**Pragmatic SDD** keeps the discipline where it pays off and adds **honest escape hatches** for everything else. That's what this package scaffolds.

## What "Pragmatic" means

Three modes, picked by the skill based on the task:

| Mode | When to use it | Steps |
|---|---|---|
| **FULL** | New feature, refactor with behavior change, schema change, external integration, auth/permissions change | Spec → Review → Tests → Implement → Verify |
| **FAST** | Bug fix in tested module, refinement of already-specified behavior | Minimal spec → Tests → Implement → Verify |
| **SHORT-CIRCUIT** | Typo, lint, format, comment, dep bump, hotfix during open incident | Implement → Verify |

**Golden rule**: if your change touches user-observable behavior (UI, API, DB schema, behavior), it goes through FULL or FAST. If it only touches code quality/form without changing behavior, SHORT-CIRCUIT.

The `sdd` skill applies this decision tree automatically. You describe the task in natural language, it picks the mode, you confirm or override.

## Quickstart

In your project root:

```bash
npx github:MigueMercedes/claude-sdd init
```

If you run `init` inside an existing project (manifest or `.git/` detected), the CLI skips the questions and only asks for one confirmation — stack and extensions are detected by the `sdd` skill on first invocation. In an empty directory the original 5-question flow runs. Use `--ask` to force the interactive flow regardless of detection. Either way, the CLI writes ~15 files and **existing files are never overwritten by default.**

Then open Claude Code in the same directory:

```
> /sdd
```

The skill reads your codebase, fills the placeholders in `CLAUDE.md` based on what it detects, and you're ready. From then on, every non-trivial task starts with `/sdd` to classify the work.

## End-to-end walk-through

Three real scenarios. Same project, three different kinds of task. Notice how the skill picks the right mode without you having to think about process.

### Scenario 1 — SHORT-CIRCUIT (typo)

```
You: Fix the typo "credito" → "crédito" in pricing-section.tsx

Claude (sdd skill):
  This is SHORT-CIRCUIT. No spec needed — string-only change, no behavior.

  ## CHANGE
  - src/components/landing/pricing-section.tsx:59
    "Sin tarjeta de credito" → "Sin tarjeta de crédito"

  ## VERIFICATION
  - Existing tests pass (310/310)
  - Lint clean
  - Smoke: pricing section renders correctly

  Done.
```

Total time: under 2 minutes. No spec written. No process overhead.

### Scenario 2 — FAST (bug fix in tested module)

```
You: The reset-password endpoint accepts expired tokens. It should reject them with "Token expired", not "Token invalid".

Claude (sdd skill):
  This is FAST. Bug fix in an already-tested module (auth_service has a
  test_reset_password_rejects_expired test slot). Writing minimal spec
  and reproducing failing test first.

  ## 1. SPEC
  Path: specs/features/auth/reset-password-error-message.spec.md
  - Context: UX clarity. Users on expired link confused, contacted support 4x in last week.
  - Errors: HTTP 400 with detail "Token expired" instead of "Token invalid"
  - Tests: failing test reproduces current "Token invalid" message

  ## 3. TEST CASES
  - tests/test_auth.py::test_reset_password_rejects_expired_token (NEW, failing)
  - tests/test_auth.py::test_reset_password_rejects_invalid_token (UPDATE for new message)

  ## 4. IMPLEMENTATION
  - app/services/auth_service.py:123 — distinguish ExpiredTokenError from InvalidTokenError
  - app/routers/auth.py:67 — return correct detail per exception type

  ## 5. VERIFICATION
  - 2 new tests pass
  - 312/312 total tests pass
  - Ruff clean
  - CI green: <link>

  Done.
```

Total time: ~20 minutes. Spec is 15 lines. Review skipped (commit message is the review). Tests reproduce bug first, then fix.

### Scenario 3 — FULL (new feature)

```
You: Implement installment payments via Stripe. Owner can offer 3, 6 or 12 month plans. Customer chooses on checkout.

Claude (sdd skill):
  This is FULL. New billing feature, external integration (Stripe Subscriptions
  with installments), multi-tenant boundary, will need rollout flag. Walking
  through full pipeline.

  ## 1. SPEC
  Path: specs/features/billing/installment-payments.spec.md (extension blocks
  active: multi-tenant, persistent-data, production-rollout, external-deps)

  - Context: ARR retention. 30% of churn cite "annual price too high".
  - Affected actors: owner (configures), customer (selects), webhook handler
  - Inputs: POST /api/checkout/installment-plan, Stripe webhook handlers
  - Validation Rules: amount > 0, plan_months ∈ {3,6,12}, owner is on Pro+ plan
  - Flows: [mermaid diagram]
  - Edge Cases: customer cancels mid-installment, payment fails, currency mismatch
  - Errors: 402 (payment failed), 403 (plan not allowed), 404 (plan not found)
  - Side Effects: Stripe subscription created, audit log, email confirmation
  - Multi-tenant: business_id boundary on plan creation + payment
  - Migration impact: new tables installment_plans + installment_payments
  - Rollout plan: flag FEATURE_INSTALLMENTS_ENABLED, default false, pilot 5 owners
  - External deps: Stripe Subscriptions API + 3 webhook events
  - [...full spec, ~180 lines]

  ## 2. SPEC REVIEW
  Issues found:
  - [HIGH] Missing failure mode: webhook arrives out-of-order (e.g.
    invoice.paid before customer.created). Resolution: idempotency by
    stripe_event_id + reorder buffer for 5 min.
  - [MEDIUM] Currency mismatch not in spec but Stripe returns 400 if
    plan currency != amount currency. Resolution: validate at endpoint.

  ## 3. TEST CASES
  - tests/services/test_stripe_installment_service.py (new file, 12 tests)
  - tests/routers/test_checkout.py (4 new tests)
  - tests/services/test_webhook_handler.py (6 new tests for idempotency + reorder)

  ## 4. IMPLEMENTATION
  - app/models/installment_plan.py (new)
  - app/models/installment_payment.py (new)
  - alembic migrations 070_installment_plans + 071_installment_payments
  - app/services/stripe_installment_service.py (new)
  - app/routers/checkout.py (extend with /installment-plan endpoint)
  - app/services/webhook_handler.py (3 new event handlers + idempotency)
  - feature flag in app/config.py

  ## 5. VERIFICATION
  - 22 new tests pass
  - 412/412 total
  - Ruff clean
  - CI green
  - Stripe sandbox: created plan, charged customer, webhook received OK
  - FEATURE_INSTALLMENTS_ENABLED stays false in prod until pilot ready

  Done.
```

Total time: half a day to a day depending on scope. Spec ends up being the design document, the test plan, the rollout plan, and the contract for review — all in one file that lives next to the code.

## What gets installed

```
your-project/
├── CLAUDE.md                       # Pragmatic SDD philosophy + project constraints (you fill via skill)
├── SPEC_PIPELINE.md                # Process detail with mermaid flow + per-step checklists
├── README.md                       # If missing — skeleton with your project name
├── TASKS.md                        # Lightweight ticket dashboard
├── .gitignore                      # SDD-specific lines appended (idempotent)
├── specs/
│   ├── templates/
│   │   ├── feature.spec.md         # Lean base + selected extensions merged in
│   │   └── extensions/             # 6 fragments + catalog README (the `sdd` skill merges fragments on demand)
│   ├── prompts/                    # 4 prompts: spec-generator, reviewer, test, implementation
│   └── features/                   # Empty — populated as you write specs
├── docs/
│   ├── adr/0000-template.md        # ADR template based on Michael Nygard's format
│   └── runbooks/                   # Empty — populated as you write runbooks
└── .claude/
    └── skills/
        └── sdd/SKILL.md            # The skill that orchestrates everything
```

Existing files are **never overwritten by default** — the CLI prompts you per file. Use `--overwrite` if you really want to replace.

## Anatomy of a spec

The base `feature.spec.md` template has 11 universal sections that apply to every spec, plus opt-in extensions for project-specific concerns.

### Universal sections

| Section | Purpose |
|---|---|
| **Context** | Why this exists. 2-5 lines. Link incidents/feedback if applicable. |
| **Affected actors** | Who's touched: end user, admin, API consumer, background job, webhook receiver, etc. |
| **Inputs** | Endpoints, events, triggers, CLI commands. Reference existing schemas. |
| **Validation Rules** | What the system accepts/rejects. Be explicit — exceptions are documented. |
| **Flows** | Step-by-step happy path. Mermaid welcome. Show the call sequence. |
| **Edge Cases** | Empty/null/large inputs, races, time zones, integration failures, legacy data. |
| **Errors** | Status codes / exception types + user-visible messages. |
| **Side Effects** | DB writes, notifications, events, cache invalidation, metrics, logs. |
| **Testing strategy** | Unit / integration / e2e / manual smoke. Aligned with Selective TDD. |
| **Assumptions** | Decisions taken without explicit evidence. Don't assume silently in code. |
| **Out of scope** | What's NOT in this feature. Avoids scope creep in review. |

### Header metadata

```
> **Mode**: FULL | FAST · **Ticket**: <link> · **Status**: draft | review | implemented | deprecated
```

The status field is intentional — deprecated specs stay in the repo as history, marked with reason and replacement.

### Why this template

Each section corresponds to a kind of question reviewers actually ask. Rather than a free-form doc that varies per author, the structure forces you to address the same kinds of risk every time. That's exactly what makes review fast and consistent.

## Extensions

The base 11 sections are universal. Anything else goes in **opt-in extensions** so the template stays lean for projects that don't need it.

### Catalog

| Extension | Enable when | What it adds |
|---|---|---|
| `multi-tenant` | Per-customer/account/business data isolation | Tenant boundary, cross-tenant query rules, isolation layer, isolation test |
| `persistent-data` | DB schema changes need migration plans | Migration tool/revision, idempotence, backfill, rollback, BC tolerance window |
| `production-rollout` | Feature flags, gradual rollouts, kill-switch | Flag location, default, gradual rollout %, kill-switch, success metric, sunset |
| `operational` | Observability, alerting, runbooks | Logs, metrics, dashboards, alerts, runbook path, SLO impact |
| `external-deps` | APIs, webhooks, billing providers | Per-provider failure modes, retries, costs, sandbox, webhook idempotence |
| `public-api` | Semver, breaking changes (libs/SDKs) | Surface affected, semver bump, breaking changes, deprecation policy, type tests |

### Three ways to use them

**Auto-detected (default for existing projects):** the `sdd` skill reads your codebase on first invocation, proposes extensions whose heuristics match (e.g. `persistent-data` if it sees `alembic/` or a Prisma schema), and merges the chosen fragments into `feature.spec.md`. You confirm.

**CLI flag (manual override):** pass `--extensions` to lock in choices at install time without waiting for the skill.

```bash
npx github:MigueMercedes/claude-sdd init --extensions multi-tenant,persistent-data,operational
```

**Per-spec:** if only some specs need a particular extension, copy the fragment into individual specs as needed.

```bash
cat specs/templates/extensions/persistent-data.md >> specs/features/auth/password-reset.spec.md
```

### Adding your own

If your project has recurring concerns not covered (compliance, real-time, offline-first, accessibility, security review, etc.), create your own extensions in `specs/templates/extensions/`. The reviewer prompt has a checklist hook for "active extensions" — match the pattern.

## Spec vs ADR

| | **Spec** | **ADR** |
|---|---|---|
| Captures | what/how of a feature or behavior | architectural decision with tradeoffs |
| Typical size | 50-200 lines | 80-150 lines |
| Path | `specs/features/<area>/<slug>.spec.md` | `docs/adr/NNN-<slug>.md` |
| Audience | engineering + product | engineering (future maintainers) |
| Lifecycle | as long as the feature exists | permanent — reflects WHY something is the way it is |
| Examples | "Customer reschedules appointment with TZ-aware policy", "Add notes field to user" | "Phone canonical = E.164 with no exceptions", "Auth via JWT in localStorage, no refresh tokens" |

**Rule**: if your work introduces or changes a pattern that affects multiple future features → write ADR (in addition to spec). If only affects one specific feature → only spec.

The `0000-template.md` follows Michael Nygard's classic ADR format (Context / Decision / Consequences / Alternatives) with one addition: a **Tech debt created** subsection inside Consequences. Specs can solve a problem cleanly; ADRs often create debt by design (deprecation windows, fallbacks, etc.) and that's worth tracking.

## Selective TDD

The framework opts out of dogmatic "always test first." Different code types deserve different strategies:

| Code type | Strategy |
|---|---|
| Services, utils, business logic | **Test-first** |
| Endpoints / API handlers | **Test-first** (define request/response in test) |
| Bug fixes | **Failing-test-first** (reproduce bug, then fix) |
| Hooks, lib functions | **Test-first** |
| UI components / pages | **Code-first** (implement visual, test if logic reusable) |
| Any change to a tested module | **Update tests in same commit** |

This sits in `CLAUDE.md` after install. The `test-generator.md` prompt enforces it.

## Install options

```bash
# Interactive (recommended for first time)
npx github:MigueMercedes/claude-sdd init

# Non-interactive with defaults (no extensions — lean base)
npx github:MigueMercedes/claude-sdd init --yes

# Explicit project name + stack + extensions
npx github:MigueMercedes/claude-sdd init --yes \
  --project-name "my-app" \
  --stack node \
  --extensions multi-tenant,persistent-data,operational

# Skill only (you already have a CLAUDE.md you don't want touched)
npx github:MigueMercedes/claude-sdd init --skill-only

# Overwrite existing files
npx github:MigueMercedes/claude-sdd init --overwrite

# Skip .gitignore modification
npx github:MigueMercedes/claude-sdd init --no-gitignore

# Force the 5-question interactive flow even in an existing project
npx github:MigueMercedes/claude-sdd init --ask
```

### Stacks supported by the picker

`node` · `python` · `rust` · `go` · `mixed` · `other`

The stack value is informational — it shows up in `CLAUDE.md` as `**Stack**: <X>` and the `sdd` skill uses it as a hint for things like test runner conventions during first-time setup. It's not enforcing anything.

## The `sdd` skill

This is where the framework earns its keep. Templates are inert text; the skill is the active part.

### What it does

1. **First-time setup** (only on its first invocation in a project)
   - Reads the codebase to detect language, framework, test runner, deploy target
   - Replaces `{{PROJECT_NAME}}`, `{{STACK}}`, `{{REPO_LAYOUT}}`, `{{CONSTRAINTS}}` placeholders in `CLAUDE.md`
   - Asks 3-4 questions about product-specific constraints (auth provider? notification channels? compliance?)
   - Optionally generates the first ADR placeholder with project context

2. **Every subsequent invocation**
   - Classifies the task: FULL / FAST / SHORT-CIRCUIT
   - Loads the relevant context files (CLAUDE.md, ADRs, related specs)
   - Walks through the corresponding pipeline
   - Outputs in the standardized format (FINAL SPEC → REVIEW → TESTS → IMPL → VERIFY)
   - At the end, invokes the verification skill if you have `superpowers:verification-before-completion` installed

### When NOT to invoke

Pure conversational queries — "what does X do", "where does Y live", "explain this function". Use Read/Bash directly. The skill is for tasks that change code.

### Working alongside other skills

The `sdd` skill orchestrates; it doesn't reinvent. Recommended companion skills (you install separately):

- `superpowers:brainstorming` — runs before SPEC for non-trivial features
- `superpowers:test-driven-development` — runs during TESTS step
- `superpowers:verification-before-completion` — runs at VERIFY step
- `superpowers:systematic-debugging` — replaces FAST mode for hairy bugs
- `superpowers:writing-plans` — runs before SPEC for multi-day work

## FAQ

### Why a Claude Code skill, not just templates?

Templates are static. They can't say "your test framework is vitest, not jest, so this is the test setup snippet you need." A skill runs inside Claude Code with full context: it reads your codebase, detects your stack, and customizes the framework per-project.

### Do I need Claude Code to use this?

The CLI part (`npx claude-sdd init`) writes files that any AI assistant or human can read. But the skill — the part that automates mode classification and pipeline orchestration — only works inside Claude Code. Without Claude Code, you'd have to read `SPEC_PIPELINE.md` and apply the modes manually.

### Can I use this without `npx`?

Yes. Clone the repo, run `node /path/to/claude-sdd/bin/cli.js init` in your project. Or eventually `npm install -g claude-sdd` once we publish to the registry (currently distributed via git URL while in pre-1.0).

### Does this work in monorepos?

Yes. Run `init` in the root of your monorepo. The skill detects the multi-package layout during first setup and adapts the `CLAUDE.md` repo map. Each subpackage can optionally have its own thin `CLAUDE.md` referencing the root (the same pattern AgenClic uses internally).

### What if I already have a `CLAUDE.md`?

The CLI doesn't overwrite by default. You get prompted per file. Use `--skill-only` to install just the skill without touching your existing docs, and integrate the SDD pipeline incrementally.

### Can I customize the prompts?

Yes — they're plain markdown files in `specs/prompts/` after install. Edit freely. The skill reads them at invocation time, so changes take effect immediately. If you find improvements that would help others, PR them upstream.

### How do I update to a newer version?

Re-run the `init` command and choose to overwrite the `.claude/skills/sdd/SKILL.md` file (and any other prompt/template you want updated). Your specs in `specs/features/` are never touched.

```bash
npx github:MigueMercedes/claude-sdd init --skill-only --overwrite
```

We'll add a proper `update` command in a later version.

### Can I use this for client work / commercial projects?

Yes — MIT licensed. Use commercially without attribution required.

### Why isn't this on npm yet?

It's pre-1.0 and being battle-tested in the author's projects. Public npm release once the API is stable enough that we won't be making breaking changes weekly. Until then, `npx github:MigueMercedes/claude-sdd` works just as well.

### How is this different from just adding "always write specs first" to my CLAUDE.md?

Three things:
1. **Escape hatches.** "Always" rules get ignored. Pragmatic SDD has explicit modes and the skill picks them automatically.
2. **Structure.** A standardized spec template is faster to write, faster to review, and the same shape across all features.
3. **Pipeline orchestration.** The skill chains spec → review → tests → implement → verify. You don't have to remember the steps.

### What if I disagree with one of the modes?

Override it in conversation: "Treat this as FULL even though you classified it as FAST." The skill respects your call.

## Troubleshooting

### The `sdd` skill doesn't appear in Claude Code

Skills under `.claude/skills/<name>/SKILL.md` are auto-discovered. Verify:

```bash
ls -la .claude/skills/sdd/SKILL.md
```

If missing: re-run `npx github:MigueMercedes/claude-sdd init --skill-only`.

If present but Claude Code doesn't show it: restart your Claude Code session. Skills are loaded at session start.

### `npx` says "command not found" or hangs

The first run downloads the package (a few MB). If you're behind a corporate proxy, configure npm:

```bash
npm config set proxy http://proxy.example.com:8080
npm config set https-proxy http://proxy.example.com:8080
```

If you're on Node <18, upgrade. The package requires Node 18+.

### My `CLAUDE.md` still has `{{PLACEHOLDERS}}` after running the skill

The skill only resolves placeholders during its first invocation in a project. If it failed midway (e.g. you cancelled), invoke it again. To force a fresh setup, delete the `CLAUDE.md` and run `init` again to get a new template.

### The skill keeps suggesting FULL mode for tiny changes

The decision tree is conservative on purpose. If you find it consistently over-classifying, two options:
1. Override per-task ("treat this as SHORT-CIRCUIT")
2. Edit the skill's classification heuristics in `.claude/skills/sdd/SKILL.md` directly to match your taste

### CI started failing after install

The CLI doesn't change CI configuration. If your CI now fails, it's because:
- New tests fail (expected if you wrote tests test-first)
- Lint fails on the new spec/markdown files (rare — markdown is usually not linted)

If you want CI to pass before integrating, run `--skill-only` and integrate the templates manually after CI is set up to handle them.

### I want to remove claude-sdd

Delete the files: `CLAUDE.md`, `SPEC_PIPELINE.md`, `specs/`, `docs/adr/`, `.claude/skills/sdd/`. There's no install registry to clean — the package only writes files, doesn't add dependencies to your project's `package.json`.

## Comparison to alternatives

### vs. Claude Code's built-in `/init`

`/init` writes a single `CLAUDE.md` based on your codebase. claude-sdd writes that **plus** a complete SDD process (spec templates, prompts, ADR conventions, pipeline skill). Use `/init` if you just want a CLAUDE.md. Use claude-sdd if you want a process to follow.

### vs. `feature-dev` skill

`feature-dev` is a workflow for implementing one feature with codebase exploration. claude-sdd is a project-wide framework that includes feature-dev-style workflows but also covers bug fixes, refactors, hotfixes, and trivial changes — each with the right amount of process.

### vs. Cursor rules

Cursor rules are auto-loaded context. claude-sdd's `CLAUDE.md` plays a similar role for Claude Code. The rest (specs, prompts, skill, ADR templates) is independent of editor — it lives in your repo as plain markdown.

### vs. classical TDD docs

TDD says "test first." claude-sdd embraces **Selective TDD**: test-first for services and bug fixes, code-first for UI. The framework documents which strategy applies where, so the team doesn't argue about it per-PR.

### vs. RFC processes (Python PEPs, Rust RFCs, etc.)

RFCs are heavyweight, public, and target large architectural changes. Specs in claude-sdd are lightweight, internal, and target individual features. ADRs in `docs/adr/` are the equivalent of RFCs for this framework.

## Architecture of this package

A few decisions that might surprise you, with rationale:

### Why JavaScript (not TypeScript)

This is a tiny CLI that reads files, writes files, and shells out a couple of prompts. JSDoc gives us type hints in editors without the build step. TypeScript here would be cargo-culting overhead.

### Why minimal deps (commander + prompts + kleur)

These three are the de facto standard for CLI UX in Node. Anyone reading the source recognizes them. Going dep-free with `node:util.parseArgs` + raw stdin is technically possible but adds ~100 lines of low-value code. We picked recognizability over zero-deps purity.

### Why distributed via git URL (not npm registry)

The package is pre-1.0 and the API is still moving. `npx github:MigueMercedes/claude-sdd` works just as well as `npx claude-sdd` for users, and avoids the npm versioning ceremony while we iterate. Once stable, we'll publish to the registry.

### Why ESM (`"type": "module"`)

It's 2026. Node has supported ESM in production for years. Modern shape, no CommonJS workarounds.

### Why we don't bundle a `update` command

The framework is mostly markdown templates. An `update` would have to merge user customizations with upstream changes — a hard problem with low ROI for now. Re-running `init --skill-only --overwrite` updates the skill (the most-iterated piece) without touching prompts the user may have customized. Good enough for v0.x.

### Why no telemetry

No phone-home. No "anonymous usage stats." If we want feedback we'll ask for it explicitly via GitHub issues.

## Roadmap

### v0.1.x (current)
- Lean base + 6 opt-in extensions
- 3-mode skill (FULL / FAST / SHORT-CIRCUIT)
- Manual update via `init --skill-only --overwrite`

### v0.2 (planned)
- `update` command that detects framework version and merges upstream improvements
- More extensions: `compliance` (GDPR/HIPAA hooks), `real-time` (websocket/streaming), `accessibility-audit`
- `validate` command that checks an existing spec against the template (catches missing sections, wrong status field, etc.)
- Init-time stack auto-detection (read `package.json` / `pyproject.toml` and pre-fill stack)

### v0.3 (planned)
- Plug-in system for custom extensions distributed as separate packages
- Spec-to-ticket bridge (auto-create Linear/GitHub issues from new specs)
- Lint rules for specs (require Status field, require Mode field, etc.)

### v1.0 (target)
- API frozen
- npm registry publish
- Public, with documentation site and example projects
- Migration guide for users on v0.x

### Won't do (intentionally out of scope)
- AI fine-tuning on user specs (privacy concerns + low ROI)
- Web UI for spec management (keep specs in the repo with the code)
- Replace Claude Code skills system with custom runtime (we extend, not replace)

## Contributing

Pre-1.0, the API is moving. Issues and small PRs are welcome; large PRs should start with an issue to discuss direction.

### Local development

```bash
git clone https://github.com/MigueMercedes/claude-sdd
cd claude-sdd
npm install
npm test                        # 19 tests across CLI + extension composition
node bin/cli.js init --yes      # smoke test in a temp dir
```

### Adding a new extension

1. Create `templates/specs/templates/extensions/<id>.md` with a single `## Section name` block (one section per fragment, by convention)
2. Add the entry to the `EXTENSIONS` array in `lib/install.js`
3. Add the entry to the catalog table in `templates/specs/templates/extensions/README.md`
4. Add a test case in `tests/install.test.js` for "extension X is included when selected"
5. Add a checklist hook in `templates/specs/prompts/spec-reviewer.md` under "Extension-specific checklists"

### Improving prompts

Prompts in `templates/specs/prompts/` are read by Claude Code at runtime — there's no compilation step. Edit, run a smoke test (install in temp dir, invoke skill), commit if it improves quality.

### Test conventions

Tests use vitest. Unit tests for CLI logic in `tests/`. CI runs the unit tests across Node 18/20/22 and a smoke test that does a real `init` in a temp dir to catch end-to-end regressions.

### Releasing

While in 0.x: just push to `main`. Users picking up the package via `npx github:` get the latest commit on each install.

When stable enough for npm: tag with `v1.0.0`, GitHub Action publishes to the registry.

### Code of conduct

Be kind. Be specific in feedback. No drive-by criticism without proposed alternatives.

## License

MIT — see [LICENSE](./LICENSE).

If you ship something with this and it goes well, a quick mention on social media or your blog is appreciated but not required.
