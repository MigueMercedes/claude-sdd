// @ts-check
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMetadata, writeMetadata, METADATA_DISPLAY } from './metadata.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, '..', 'templates');

/**
 * Files that the `update` command keeps in sync with the upstream templates.
 * Anything outside this list is considered user-owned and never touched.
 */
const SKILL_FILES = /** @type {const} */ ([
  path.join('.claude', 'skills', 'sdd', 'SKILL.md'),
  path.join('.claude', 'skills', 'sdd-init', 'SKILL.md'),
]);

/**
 * Sub-sections of `templates/AGENTS.md` that the `update` command keeps in sync.
 * Each entry locates the section by its literal heading line in the user's
 * AGENTS.md and replaces it with the upstream version. The user's surrounding
 * content (Project Overview, Constraints, Project-specific skills, etc.) is
 * preserved untouched.
 */
const AGENTS_MANAGED_SECTIONS = /** @type {const} */ ([
  '### Companion skills (optional, recommended)',
]);

/**
 * @typedef {object} UpdateItem
 * @property {string} target  Human-readable, e.g. `.claude/skills/sdd/SKILL.md` or `AGENTS.md §Companion skills`.
 * @property {'skill' | 'agents-section' | 'metadata'} kind
 * @property {'updated' | 'unchanged' | 'inserted' | 'manual-required' | 'missing-target'} action
 * @property {string} [detail]
 */

/**
 * @typedef {object} UpdateResult
 * @property {UpdateItem[]} items
 * @property {boolean} dryRun
 * @property {string | null} fromVersion  recorded version before update (null = legacy / no metadata)
 * @property {string | null} toVersion    package version after update (null when packageVersion not provided)
 */

/**
 * @typedef {object} UpdateOptions
 * @property {string} cwd
 * @property {'all' | 'skills-only' | 'docs-only'} [scope]
 * @property {boolean} [dryRun]
 * @property {string} [packageVersion]  Version of the running pragspec package. When provided,
 *   `update` records/refreshes `.pragspec/metadata.json` and reports the version transition.
 *   The recorded version is provenance/reporting only — it never gates the content-diff update.
 * @property {string} [now]  ISO timestamp for the metadata write (injectable for tests).
 */

/**
 * Returns true if the `cwd` looks like a pragspec project (skills are installed).
 * Used by the CLI to fail early with a helpful message instead of doing partial work.
 * @param {string} cwd
 * @returns {Promise<boolean>}
 */
export async function isClaudeSddProject(cwd) {
  for (const rel of SKILL_FILES) {
    try {
      await fs.access(path.join(cwd, rel));
      return true;
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  return false;
}

/**
 * Compute the line range `[startIdx, endIdx)` of a markdown section, given the
 * literal heading line. The end is the first subsequent line whose heading level
 * is the same or higher (e.g. `### X` ends at the next `###`, `##`, or `#`).
 * @param {string[]} lines
 * @param {string} headingLine
 * @returns {{ startIdx: number, endIdx: number } | null}
 */
function findSectionRange(lines, headingLine) {
  const startIdx = lines.findIndex((l) => l === headingLine);
  if (startIdx === -1) return null;
  const headingMatch = headingLine.match(/^(#+)/);
  const level = headingMatch ? headingMatch[1].length : 0;
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s/);
    if (m && m[1].length <= level) {
      endIdx = i;
      break;
    }
  }
  return { startIdx, endIdx };
}

/**
 * Extract the content of a section (heading + body) from a markdown string.
 * Returns null if the heading is not found.
 * @param {string} content
 * @param {string} headingLine
 * @returns {string | null}
 */
function extractSection(content, headingLine) {
  const lines = content.split('\n');
  const range = findSectionRange(lines, headingLine);
  if (!range) return null;
  return lines.slice(range.startIdx, range.endIdx).join('\n');
}

/**
 * Replace a section (heading + body) in a markdown string. Returns null if the
 * heading is not found in the input.
 * @param {string} content
 * @param {string} headingLine
 * @param {string} replacement  Should start with the same heading line.
 * @returns {string | null}
 */
function replaceSection(content, headingLine, replacement) {
  const lines = content.split('\n');
  const range = findSectionRange(lines, headingLine);
  if (!range) return null;
  const before = lines.slice(0, range.startIdx);
  const after = lines.slice(range.endIdx);
  const newLines = replacement.split('\n');
  return [...before, ...newLines, ...after].join('\n');
}

/**
 * Plan + (optionally) apply an update of skill files and managed AGENTS.md
 * sections in the user's project. Never touches files outside the explicit
 * managed list. Always writes a `.bak` next to any file it modifies.
 *
 * @param {UpdateOptions} opts
 * @returns {Promise<UpdateResult>}
 */
export async function updateProject(opts) {
  const { cwd, scope = 'all', dryRun = false, packageVersion, now } = opts;
  /** @type {UpdateItem[]} */
  const items = [];

  if (scope !== 'docs-only') {
    for (const rel of SKILL_FILES) {
      items.push(await planSkillFile(cwd, rel, dryRun));
    }
  }

  if (scope !== 'skills-only') {
    for (const heading of AGENTS_MANAGED_SECTIONS) {
      items.push(await planAgentsSection(cwd, heading, dryRun));
    }
  }

  // Version metadata is reporting/provenance only — it never decides whether
  // the content-diff above runs. Skipped entirely when the caller does not
  // supply a packageVersion (keeps programmatic/legacy callers byte-identical).
  let fromVersion = null;
  let toVersion = null;
  if (packageVersion) {
    const meta = await readMetadata(cwd);
    fromVersion = meta?.version ?? null;
    toVersion = packageVersion;
    items.push(await planMetadata(cwd, { meta, fromVersion, toVersion, dryRun, now }));
  }

  return { items, dryRun, fromVersion, toVersion };
}

/**
 * Plan + (optionally) write the `.pragspec/metadata.json` version stamp.
 * 'unchanged' iff metadata exists and already records the current version;
 * 'updated' iff it records a different version; 'inserted' iff absent (legacy).
 * @param {string} cwd
 * @param {object} args
 * @param {import('./metadata.js').PragspecMetadata | null} args.meta
 * @param {string | null} args.fromVersion
 * @param {string} args.toVersion
 * @param {boolean} args.dryRun
 * @param {string} [args.now]
 * @returns {Promise<UpdateItem>}
 */
async function planMetadata(cwd, { meta, fromVersion, toVersion, dryRun, now }) {
  const target = METADATA_DISPLAY;
  if (meta && fromVersion === toVersion) {
    return { target, kind: 'metadata', action: 'unchanged' };
  }
  const action = meta ? 'updated' : 'inserted';
  const detail = meta
    ? `version ${fromVersion ?? 'unknown'} → ${toVersion}`
    : `recording version ${toVersion}`;
  if (!dryRun) {
    await writeMetadata(cwd, {
      version: toVersion,
      stack: meta?.stack,
      extensions: meta?.extensions,
      now,
    });
  }
  return { target, kind: 'metadata', action, detail };
}

/**
 * @param {string} cwd
 * @param {string} rel
 * @param {boolean} dryRun
 * @returns {Promise<UpdateItem>}
 */
async function planSkillFile(cwd, rel, dryRun) {
  const target = rel.split(path.sep).join('/');
  const src = path.join(TEMPLATES_DIR, rel);
  const dest = path.join(cwd, rel);

  let upstream;
  try {
    upstream = await fs.readFile(src, 'utf8');
  } catch {
    return { target, kind: 'skill', action: 'missing-target', detail: 'upstream template missing' };
  }

  let current = '';
  try {
    current = await fs.readFile(dest, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { target, kind: 'skill', action: 'missing-target', detail: 'not installed (run `pragspec init` first)' };
    }
    throw err;
  }

  if (current === upstream) {
    return { target, kind: 'skill', action: 'unchanged' };
  }

  if (!dryRun) {
    await fs.copyFile(dest, dest + '.bak');
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, upstream);
  }
  return { target, kind: 'skill', action: 'updated' };
}

/**
 * @param {string} cwd
 * @param {string} headingLine
 * @param {boolean} dryRun
 * @returns {Promise<UpdateItem>}
 */
async function planAgentsSection(cwd, headingLine, dryRun) {
  const friendlyName = headingLine.replace(/^#+\s/, '').replace(/\s\(.+\)$/, '');
  const target = `AGENTS.md §${friendlyName}`;
  const src = path.join(TEMPLATES_DIR, 'AGENTS.md');
  const dest = path.join(cwd, 'AGENTS.md');

  let upstream;
  try {
    upstream = await fs.readFile(src, 'utf8');
  } catch {
    return { target, kind: 'agents-section', action: 'missing-target', detail: 'upstream template missing' };
  }

  let current;
  try {
    current = await fs.readFile(dest, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { target, kind: 'agents-section', action: 'missing-target', detail: 'AGENTS.md not found (run `pragspec init` first)' };
    }
    throw err;
  }

  const upstreamSection = extractSection(upstream, headingLine);
  if (!upstreamSection) {
    return { target, kind: 'agents-section', action: 'missing-target', detail: 'upstream is missing the managed heading (bug — please report)' };
  }

  const currentSection = extractSection(current, headingLine);
  if (!currentSection) {
    return {
      target,
      kind: 'agents-section',
      action: 'manual-required',
      detail: `heading "${headingLine}" not found in AGENTS.md — your file may predate this section. Re-run \`pragspec init --overwrite\` (with a backup) or copy the section manually from the upstream template.`,
    };
  }

  if (currentSection === upstreamSection) {
    return { target, kind: 'agents-section', action: 'unchanged' };
  }

  if (!dryRun) {
    const next = replaceSection(current, headingLine, upstreamSection);
    if (next === null) {
      // Defensive — already verified the heading exists above. Treat as no-op.
      return { target, kind: 'agents-section', action: 'manual-required', detail: 'unexpected section-replace failure' };
    }
    await fs.copyFile(dest, dest + '.bak');
    await fs.writeFile(dest, next);
  }
  return { target, kind: 'agents-section', action: 'updated' };
}
