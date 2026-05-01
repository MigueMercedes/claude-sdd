# Spec extensions

The base `feature.spec.md` template covers what every spec needs. **Extensions** are opt-in sections for projects with specific concerns (multi-tenancy, persistent data, production rollout, etc.).

## Catalog

| Extension | When to enable | What it adds |
|---|---|---|
| `multi-tenant.md` | Your product isolates data per customer/account/business | "Multi-tenant boundary" section: which `tenant_id` applies, intentional cross-tenant queries, isolation guarantees |
| `persistent-data.md` | Your feature touches DB schema or existing user data | "Migration impact" + "Backwards compatibility" sections: alembic/prisma migration, backfill plan, deprecation timeline, tolerance window |
| `production-rollout.md` | Your feature is risky and needs flags / gradual rollout | "Rollout plan" section: feature flag, default value, gradual rollout %, kill-switch, success metric |
| `operational.md` | Your feature has observability, alerting, or runbook needs | "Operational" section: structured logs, metrics, dashboards, alerting conditions, runbook path |
| `external-deps.md` | Your feature calls third-party APIs, webhooks, or billing providers | "External dependencies" section: per-integration error handling, retries, costs |
| `public-api.md` | Your feature changes a public API contract (libraries, SDKs) | "API contract" section: semver impact, breaking change classification, deprecation policy |

## How to use

### Option A — Project-wide (recommended)

During `pragspec init`, select the extensions that apply to your project:

```bash
npx github:MigueMercedes/pragspec init --extensions multi-tenant,persistent-data
```

Or interactively (multi-select). The CLI appends the selected extension sections to `feature.spec.md` once, so every new spec inherits them.

### Option B — Per-spec

If only some specs need an extension (e.g. only DB-touching specs need `persistent-data`), copy the relevant extension content into individual specs as needed.

```bash
cat specs/templates/extensions/persistent-data.md >> specs/features/auth/password-reset.spec.md
```

### Option C — Add later

You enabled the project but realized you need an extension. Two options:

1. Re-run `pragspec init --skill-only --extensions <new-set>` (will re-prompt to overwrite `feature.spec.md`)
2. Manually paste the extension content into `feature.spec.md` and into specs that need it retroactively

## Adding your own extensions

If your project has recurring concerns not covered above (compliance, real-time, offline-first, accessibility audit, security review, etc.), create your own:

1. Create `specs/templates/extensions/<name>.md` with the section markdown
2. Document it in this README so others on your team know it exists
3. Consider PR-ing it back upstream if it's reusable for other projects

## What NOT to make an extension

If a section applies to >80% of typical projects, it should be in the **base template**, not an extension. Extensions are for things that are genuinely opt-in.

If a section applies to only ONE feature, don't make it an extension — just write it inline in that one spec.
