# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`claude-sdd` is a tiny Node CLI (`npx github:MigueMercedes/claude-sdd init`) that scaffolds the **Pragmatic SDD** framework into another project. It writes ~15 markdown files plus a Claude Code skill at `.claude/skills/sdd/SKILL.md`. The CLI itself is inert glue — the active intelligence ships as the skill (`templates/.claude/skills/sdd/SKILL.md`), which is what gets iterated on most.

Distinguish two things when working here:

- **Source code** (`bin/`, `lib/`, `tests/`, `package.json`): the scaffolder itself. Standard Node/ESM/JS-with-JSDoc. Tested with vitest.
- **Templates** (`templates/`): the payload — markdown content delivered to user projects. Treat these as **data, not source**. Most edits to "the framework" are template edits, not code edits.

The `README.md` is the public docs and is authoritative on user-facing behavior, the philosophy, the roadmap, and rationale for design decisions (why JS not TS, why minimal deps, why git-URL distribution, etc.). Read it before changing public-facing behavior.

## Commands

```bash
npm install                                 # install dev deps (vitest) + runtime deps
npm test                                    # vitest run — full suite
npm run test:watch                          # vitest in watch mode
npx vitest run tests/install.test.js -t "with multi-tenant extension"   # run a single test by name pattern

# End-to-end smoke (mirrors what CI does)
TMP=$(mktemp -d) && cd "$TMP" && node /home/miguemercedes/projects/claude-sdd/bin/cli.js init --yes --project-name "smoke" --stack node
node /home/miguemercedes/projects/claude-sdd/bin/cli.js init --yes --extensions multi-tenant,persistent-data,operational
```

There is no lint or build step. The package ships as ESM source (`"type": "module"`, Node ≥18). No bundler. `bin/cli.js` is the executable entry.

## Architecture

### Install pipeline (`lib/install.js`)

`installTemplates()` is the heart. It:

1. Recursively walks `templates/` to enumerate files.
2. **Filters out** source-only files (`.gitignore.additions` — consumed by `appendGitignore()` instead). Everything else under `templates/` is copied to the destination, including individual extension fragments — the `sdd` skill reads them on first invocation to merge the relevant ones into `feature.spec.md`.
3. Reads each remaining file, runs `applyPlaceholders()` (`{{NAME}}` substitution; unknown placeholders are intentionally left untouched so the `sdd` skill can resolve them on first invocation).
4. Special cases:
   - `README.md.tmpl` → renamed to `README.md` at destination.
   - `specs/templates/feature.spec.md` → if extensions are selected, the `## Optional sections (extensions)` placeholder block is replaced with the concatenated fragments, preserving the `## Review notes` section at the bottom (the merge logic locates the next `## Review notes` heading and slices around it).
5. Honors `onConflict: 'skip' | 'overwrite'` per-file. Default is `skip` — **existing files are never silently overwritten**.

`appendGitignore()` is idempotent via the `# Added by claude-sdd` marker — re-running `init` will not duplicate lines.

### Extension catalog

`EXTENSIONS` in `lib/install.js` is the single source of truth for valid extension IDs. It is consumed by:
- `bin/cli.js` for `--extensions` CLI validation
- `lib/prompts.js` to build the multiselect choices
- `installTemplates()` to know which fragments to merge

When adding a new extension, **5 places must change** (also documented in README "Adding a new extension"):
1. New file: `templates/specs/templates/extensions/<id>.md` (one `## Section` block per fragment, by convention)
2. Add `{ id, label }` entry to `EXTENSIONS` in `lib/install.js`
3. Add a row to the catalog table in `templates/specs/templates/extensions/README.md`
4. Add a test in `tests/install.test.js` covering the merge
5. Add a reviewer-prompt checklist hook in `templates/specs/prompts/spec-reviewer.md`

### CLI surface (`bin/cli.js`)

Single `init` command. Three operation modes:
- Interactive (default): asks 5 questions via `prompts`.
- `--yes` / `--skill-only`: non-interactive; flags supply the answers.
- CLI flags (e.g. `--extensions`) override interactive answers when both are given.

`--skill-only` restricts the install to `.claude/skills/sdd/`. This is the documented update path while pre-1.0 (there is intentionally no `update` command — see README "Why we don't bundle a `update` command").

## Conventions specific to this repo

- **Keep deps minimal.** Three runtime deps only: `commander`, `kleur`, `prompts`. Adding a fourth needs justification — the README explicitly defends recognizability-over-purity here. Don't reach for utility libs casually.
- **JS + JSDoc, not TypeScript.** All source files have `// @ts-check` and JSDoc types. Don't introduce a TS toolchain — this is a deliberate simplicity choice (README "Why JavaScript (not TypeScript)").
- **ESM only.** `import`, not `require` (except via `createRequire` for `package.json`).
- **`templates/` files are user-facing.** Editing `templates/CLAUDE.md`, the `SPEC_PIPELINE.md`, or any prompt under `templates/specs/prompts/` changes what users get on `init`. Review those edits with the same care as a public API change.
- **Smoke tests are part of CI.** `.github/workflows/ci.yml` runs three end-to-end smoke checks (lean install, with-extensions, invalid-extension-rejection) across Node 18/20/22. If you change install behavior, mirror the change in the workflow's grep assertions.
- **Pre-1.0, distributed via git URL** (`npx github:MigueMercedes/claude-sdd`). The package is not on npm yet; do not bump for "release" purposes — version bumps in `package.json` are tracked but unpublished.

## What lives where

- The Pragmatic SDD philosophy (FULL/FAST/SHORT-CIRCUIT modes, Selective TDD, Spec-vs-ADR, extension catalog) is documented in **`README.md`** and reproduced in the templates that get installed (`templates/CLAUDE.md`, `templates/SPEC_PIPELINE.md`, `templates/.claude/skills/sdd/SKILL.md`). When the philosophy changes, those four places need to stay aligned.
- **This** `CLAUDE.md` is for working *on* the scaffolder, not *with* it. The SDD pipeline (specs, ADRs, etc.) is **not** applied to changes inside this repo — there is no `specs/` directory here, and code changes are reviewed conventionally via PR.
