# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`pragspec` is a tiny Node CLI (`npx github:MigueMercedes/pragspec init`) that scaffolds the **Pragmatic SDD** framework into another project. It writes a set of markdown templates plus two Claude Code skills under `.claude/skills/`: `sdd-init` (project context customization + refresh) and `sdd` (per-task pipeline). The CLI itself is inert glue — the active intelligence ships as those two skills, which are what get iterated on most.

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
TMP=$(mktemp -d) && cd "$TMP" && node /home/miguemercedes/projects/pragspec/bin/cli.js init --yes --project-name "smoke" --stack node
node /home/miguemercedes/projects/pragspec/bin/cli.js init --yes --extensions multi-tenant,persistent-data,operational
```

There is no lint or build step. The package ships as ESM source (`"type": "module"`, Node ≥18). No bundler. `bin/cli.js` is the executable entry.

## Architecture

### Install pipeline (`lib/install.js`)

`installTemplates()` is the heart. It:

1. Recursively walks `templates/` to enumerate files.
2. **Filters out** source-only files (`.gitignore.additions` — consumed by `appendGitignore()` instead). Everything else under `templates/` is copied to the destination, including individual extension fragments — the `sdd-init` skill reads them on first invocation to merge the relevant ones into `feature.spec.md`.
3. Reads each remaining file, runs `applyPlaceholders()` (`{{NAME}}` substitution; unknown placeholders are intentionally left untouched so `sdd-init` can resolve them on first invocation).
4. Special cases:
   - `README.md.tmpl` → renamed to `README.md` at destination.
   - `specs/templates/feature.spec.md` → if extensions are selected, the `## Optional sections (extensions)` placeholder block is replaced with the concatenated fragments, preserving the `## Review notes` section at the bottom (the merge logic locates the next `## Review notes` heading and slices around it).
5. Honors `onConflict: 'skip' | 'overwrite'` per-file. Default is `skip` — **existing files are never silently overwritten**.

`appendGitignore()` is idempotent via the `# Added by pragspec` marker — re-running `init` will not duplicate lines.

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

Single `init` command. Three branches in the answer-gathering logic:
- `--yes` / `--skill-only`: non-interactive; flags supply the answers.
- Auto-detected existing project (default when the cwd has a manifest or `.git/`): one confirmation prompt; stack and extensions deferred to `sdd-init` on first invocation.
- Interactive: 5 questions via `prompts` for empty directories, or whenever `--ask` is passed.

CLI flags (e.g. `--extensions`) override prompted answers when both are given.

`--skill-only` restricts the install to `.claude/skills/` (both `sdd` and `sdd-init`); in this mode the CLI does **not** write `.pragspec/metadata.json` (it only ever writes `.claude/skills/`). Every other `init` mode writes the metadata file after copying templates.

### `update` subcommand (`lib/update.js`)

The user-facing path for bringing existing installs up to date. It does **not** call `installTemplates`; it has its own plan/apply logic:
- **Content-diff** the framework-managed files — the two skill files and the `### Companion skills` sub-section of `AGENTS.md` (`AGENTS_MANAGED_SECTIONS`) — replacing only those that differ from upstream, always writing a `.bak`.
- **Version metadata** (`lib/metadata.js`): when the CLI passes `packageVersion`, `update` reads `.pragspec/metadata.json`, emits a `metadata` plan item, reports `fromVersion → toVersion`, and rewrites the version on apply. The recorded version is **provenance/reporting only — it never gates the content-diff** (so `update` works on legacy installs with no metadata, and on same-version template tweaks). Programmatic callers that omit `packageVersion` get byte-identical pre-metadata behaviour, which is why the original `updateProject` tests still pass unchanged.

### Provenance metadata (`lib/metadata.js`)

`.pragspec/metadata.json` records `{ name, version, installedAt, updatedAt, stack?, extensions? }`. `writeMetadata()` preserves `installedAt` (and any prior `stack`/`extensions`) across rewrites; `now` is injectable for deterministic tests. `compareSemver()` / `classifyVersionDelta()` drive the `update` version report. The file is meant to be committed (provenance for the whole team) — it is **not** added to `.gitignore`.

## Conventions specific to this repo

- **Keep deps minimal.** Three runtime deps only: `commander`, `kleur`, `prompts`. Adding a fourth needs justification — the README explicitly defends recognizability-over-purity here. Don't reach for utility libs casually.
- **JS + JSDoc, not TypeScript.** All source files have `// @ts-check` and JSDoc types. Don't introduce a TS toolchain — this is a deliberate simplicity choice (README "Why JavaScript (not TypeScript)").
- **ESM only.** `import`, not `require` (except via `createRequire` for `package.json`).
- **`templates/` files are user-facing.** Editing `templates/AGENTS.md` (canonical context), `templates/CLAUDE.md` (shim), `SPEC_PIPELINE.md`, or any prompt under `templates/specs/prompts/` changes what users get on `init`. Review those edits with the same care as a public API change.
- **Smoke tests are part of CI.** `.github/workflows/ci.yml` runs five end-to-end smoke checks (lean install, with-extensions, invalid-extension-rejection, update-preserves-customizations, update-fail-fast-outside-project) across Node 18/20/22. The lean/extensions smokes also assert `.pragspec/metadata.json` and the `## Output discipline` section. If you change install/update behavior, mirror the change in the workflow's grep assertions.
- **Pre-1.0, published to npm as `pragspec`**. Distributed via the registry (`npx pragspec`) with the git URL form (`npx github:MigueMercedes/pragspec`) as fallback for unpublished branches / forks. Bump `package.json` version per semver before each `npm publish`; while pre-1.0 we use minor bumps (0.x.0) for breaking changes and patch bumps (0.x.y) for everything else.

## What lives where

- The Pragmatic SDD philosophy (FULL/FAST/SHORT-CIRCUIT modes, Selective TDD, Spec-vs-ADR, extension catalog) is documented in **`README.md`** and reproduced in the templates that get installed (`templates/AGENTS.md`, `templates/SPEC_PIPELINE.md`, `templates/.claude/skills/sdd/SKILL.md`, `templates/.claude/skills/sdd-init/SKILL.md`). When the philosophy changes, those five places need to stay aligned. `templates/CLAUDE.md` is a thin shim and rarely needs updates beyond the pointer.
- **Output discipline** is canonical in `templates/AGENTS.md` (`## Output discipline`) and referenced — not duplicated — by the `sdd` skill (`templates/.claude/skills/sdd/SKILL.md`). It scopes terseness to *conversational* responses and explicitly exempts generated spec/ADR/test artifacts; keep that exemption if you edit it, and keep the canonical copy in `AGENTS.md`.
- **This** `CLAUDE.md` is for working *on* the scaffolder, not *with* it. The SDD pipeline (specs, ADRs, etc.) is **not** applied to changes inside this repo — there is no `specs/` directory here, and code changes are reviewed conventionally via PR.
