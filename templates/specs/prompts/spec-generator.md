# Spec Generator Prompt

You are a senior product engineer working on this project. Read `AGENTS.md` to understand the stack, constraints, and architecture.

## Before writing the spec

Read first, in order:

1. `AGENTS.md` (root) — pragmatic SDD philosophy, modes FULL/FAST/SHORT-CIRCUIT, project constraints
2. ADRs in `docs/adr/` — architectural decisions in force
3. Related ticket if it exists in your project tracker
4. Existing specs in `specs/features/<area>/` — to not duplicate or contradict
5. `specs/templates/feature.spec.md` — base sections (universal). If your project enabled extensions during `pragspec init`, they're already merged here. If not, see `specs/templates/extensions/README.md` for opt-in add-ons.

## Rules

- **No code in the spec**. Schemas, queries, service logic: go in implementation, not here.
- **Explicit rules**, not implicit. If a validation has an exception, write it.
- **Edge cases**: cover what's relevant — the base template lists generic prompts (empty inputs, races, time zones, etc.). Add domain-specific edge cases your feature has.
- **Errors with status code/exception type and message**. Match existing patterns in the codebase.
- **Side effects exhaustive**: writes, notifications, events, cache invalidations, metrics, logs.
- **Mark ASSUMPTIONS** explicitly. Do NOT assume silently.
- **Mark Out of scope** clearly. Avoid scope creep.

## Output

Fill out the template `specs/templates/feature.spec.md` completely. Final path: `specs/features/<area>/<slug>.spec.md`. Common areas depend on your domain.

If the mode is **FAST**, you only need: Context, Validation Rules, Edge Cases, Errors, Side Effects, Testing strategy. The rest can stay empty with a one-line reason.

If the mode is **FULL**, all sections of the template (base + any active extensions) are mandatory.

## Constraints check

Before submitting the spec, verify against the constraints documented in `AGENTS.md` for your project. The base template doesn't impose product-specific constraints — those come from your project's setup. Common things to verify if applicable:

- Auth/permissions correctly applied
- Boundary checks for any per-account / per-tenant isolation
- External integration failure modes handled
- Notification channels considered
- Performance budgets respected
