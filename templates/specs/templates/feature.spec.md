# Feature: [NAME]

> **Mode**: FULL | FAST · **Ticket**: [optional link] · **Status**: draft | review | implemented | deprecated

## Context

Why this feature exists. What problem it solves, for whom, and why now. 2-5 lines. If responding to an incident or real user feedback, mention it.

## Affected actors

Who is touched by this change. Examples: end user, admin, API consumer, background job, other systems via webhook, public visitors. For each, one line: what changes for them.

## Inputs

Endpoints, events, triggers, CLI commands, file watchers — whatever starts the flow. For each: shape of the input (reference existing schema if applicable).

## Validation Rules

Input/state rules the system accepts or rejects. Be explicit — the reviewer will check each one against the code.

## Flows

Step-by-step of the happy path. Show the sequence between layers (what calls what), what gets persisted, what gets emitted. Mermaid diagrams welcome.

## Edge Cases

Rare but possible cases. At minimum cover what's relevant to your feature:
- Empty / null / very-large inputs
- Concurrent / race conditions
- Time zones, DST, day-change-of-hour (if time-sensitive)
- Failure of any external dependency (if applicable)
- Legacy / heterogeneous data (if applicable)

## Errors

Error conditions + messages users see. For each: what triggers it and how it surfaces (HTTP code, exception type, UI state).

## Side Effects

Anything that changes outside the immediate return value: persisted writes, notifications, events emitted, cache invalidation, metrics, structured logs, file system, external API calls. Be exhaustive — this is what confuses support when something goes wrong.

## Testing strategy

Aligned with Selective TDD from AGENTS.md:
- **Unit tests**: which pure functions / services get tested (test-first)
- **Integration tests**: which boundaries get tested (test-first)
- **E2E tests**: which user flow gets browser/CLI automation (if applicable)
- **Manual smoke**: what to verify by hand before claiming done

## Assumptions

Decisions taken without explicit evidence right now. Any ambiguity goes here, NOT silently in code.

Examples:
- "We assume the input is already validated by the caller — we don't re-validate"
- "We assume the rate limit is enforced upstream — no internal throttling here"

## Out of scope

What is NOT in this feature but could be confused with it. Avoids scope creep in review.

---

## Optional sections (extensions)

Some projects need additional sections beyond the universal ones above. If your project enabled extensions during `claude-sdd init` (or you want to add them now), append the corresponding sections from `specs/templates/extensions/` when they apply to this feature.

Common extensions:
- `multi-tenant.md` — if your product isolates data per customer/account
- `persistent-data.md` — if your feature touches database schema or existing user data
- `production-rollout.md` — if your feature is risky and needs flags / gradual rollout
- `operational.md` — if your feature has observability, alerting, or runbook needs
- `external-deps.md` — if your feature relies on third-party APIs / webhooks / billing
- `public-api.md` — if your feature changes a public API contract (libraries, SDKs)

Catalog and details: `specs/templates/extensions/README.md`.

---

## Review notes

Section filled in Step 2 (REVIEW). Issues found and resolutions taken. If any issue requires ADR, link it here.
