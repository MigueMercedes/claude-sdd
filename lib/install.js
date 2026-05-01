// @ts-check
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import kleur from 'kleur';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, '..', 'templates');

/** Catalog of available spec template extensions. */
export const EXTENSIONS = /** @type {const} */ ([
  { id: 'multi-tenant', label: 'Multi-tenant (per-customer/account/business data isolation)' },
  { id: 'persistent-data', label: 'Persistent data (DB schema changes, migrations, backwards-compat)' },
  { id: 'production-rollout', label: 'Production rollout (feature flags, gradual rollouts, kill-switch)' },
  { id: 'operational', label: 'Operational (observability, alerting, runbooks)' },
  { id: 'external-deps', label: 'External integrations (APIs, webhooks, billing providers)' },
  { id: 'public-api', label: 'Public API (semver, breaking changes — for libs/SDKs)' },
]);

const EXTENSION_IDS = new Set(EXTENSIONS.map((e) => e.id));

/**
 * @param {string} id
 * @returns {boolean}
 */
export function isValidExtensionId(id) {
  return EXTENSION_IDS.has(id);
}

const EXISTING_PROJECT_MARKERS = ['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', '.git'];

/**
 * Returns true if the directory looks like an existing project (has a manifest
 * or is a git repo). Used by the CLI to decide whether to skip interactive prompts.
 * @param {string} cwd
 * @returns {Promise<boolean>}
 */
export async function isExistingProject(cwd) {
  for (const marker of EXISTING_PROJECT_MARKERS) {
    try {
      await fs.access(path.join(cwd, marker));
      return true;
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  return false;
}

/**
 * Recursively walk a directory and return relative file paths.
 * @param {string} dir
 * @param {string} [base]
 * @returns {Promise<string[]>}
 */
async function walk(dir, base = dir) {
  /** @type {string[]} */
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await walk(full, base);
      out.push(...sub);
    } else {
      out.push(path.relative(base, full));
    }
  }
  return out;
}

/**
 * Resolve template placeholders.
 * @param {string} content
 * @param {Record<string,string>} vars
 * @returns {string}
 */
function applyPlaceholders(content, vars) {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key in vars) return vars[key];
    return `{{${key}}}`; // leave untouched if not provided — skill will fill later
  });
}

/**
 * @param {object} opts
 * @param {string} opts.cwd                     destination directory
 * @param {Record<string,string>} opts.vars     placeholder values
 * @param {boolean} [opts.skillOnly]            only copy .claude/skills/sdd/
 * @param {'overwrite'|'skip'|'ask'} [opts.onConflict]
 * @param {string[]} [opts.extensions]          IDs of extensions to merge into feature.spec.md
 * @param {(rel: string, action: 'created'|'skipped'|'overwritten') => void} [opts.onFile]
 */
export async function installTemplates(opts) {
  const { cwd, vars, skillOnly = false, onConflict = 'skip', extensions = [], onFile } = opts;

  const allFiles = await walk(TEMPLATES_DIR);
  // Source-only files: never copied as-is. Used by other functions.
  const SOURCE_ONLY_FILES = new Set(['.gitignore.additions']);
  // Extension fragments live under specs/templates/extensions/. They are also
  // merged into feature.spec.md when opts.extensions is non-empty.
  const EXT_PREFIX = `specs${path.sep}templates${path.sep}extensions${path.sep}`;
  // Skill files (.claude/skills/**/SKILL.md) embed {{X}} literally as prose
  // when documenting the placeholder system to the model. Substituting them
  // would corrupt the instructions, so we copy these files raw.
  const SKILL_PREFIX = `.claude${path.sep}skills${path.sep}`;

  const filtered = skillOnly
    ? allFiles.filter((f) => f.startsWith(`.claude${path.sep}skills${path.sep}`))
    : allFiles.filter((f) => !SOURCE_ONLY_FILES.has(f));

  // Resolve which extension fragments to append to feature.spec.md
  const validExts = extensions.filter((e) => EXTENSION_IDS.has(e));

  for (const rel of filtered) {
    const src = path.join(TEMPLATES_DIR, rel);

    // Special: README.md.tmpl → README.md
    let destRel = rel;
    if (rel === 'README.md.tmpl') destRel = 'README.md';

    const dest = path.join(cwd, destRel);

    let exists = false;
    try {
      await fs.access(dest);
      exists = true;
    } catch {
      // doesn't exist — proceed
    }

    let action = /** @type {'created'|'skipped'|'overwritten'} */ ('created');
    if (exists) {
      if (onConflict === 'skip') {
        if (onFile) onFile(destRel, 'skipped');
        continue;
      }
      // Safety net: preserve the original next to the new file. The user opted
      // into overwrite, but if their CLAUDE.md was 200 lines of real content,
      // they should be able to recover it without `git reflog`.
      await fs.copyFile(dest, dest + '.bak');
      action = 'overwritten';
    }

    let content = await fs.readFile(src, 'utf8');
    if (!rel.startsWith(SKILL_PREFIX)) {
      content = applyPlaceholders(content, vars);
    }

    // Compose feature.spec.md: base + selected extensions appended at the end
    if (rel === path.join('specs', 'templates', 'feature.spec.md') && validExts.length > 0) {
      const extBlocks = [];
      for (const id of validExts) {
        const extPath = path.join(TEMPLATES_DIR, EXT_PREFIX + `${id}.md`);
        const extContent = await fs.readFile(extPath, 'utf8');
        extBlocks.push(extContent.trim());
      }
      // Replace the "## Optional sections (extensions)" block with rendered extensions
      const optMarker = '## Optional sections (extensions)';
      const optIdx = content.indexOf(optMarker);
      if (optIdx !== -1) {
        const reviewIdx = content.indexOf('## Review notes', optIdx);
        const before = content.slice(0, optIdx);
        const after = reviewIdx !== -1 ? content.slice(reviewIdx) : '';
        const extBlock =
          `<!-- Extensions enabled: ${validExts.join(', ')} (configured via claude-sdd init) -->\n\n` +
          extBlocks.join('\n\n') +
          '\n\n---\n\n';
        content = before + extBlock + after;
      } else {
        // No marker present (custom edited template) — just append at the end
        content =
          content.trimEnd() +
          '\n\n---\n\n' +
          `<!-- Extensions enabled: ${validExts.join(', ')} (configured via claude-sdd init) -->\n\n` +
          extBlocks.join('\n\n') +
          '\n';
      }
    }

    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, content);

    if (onFile) onFile(destRel, action);
  }
}

/**
 * Append SDD-specific lines to .gitignore (or create it).
 * Idempotent: skips if a marker line already exists.
 * @param {string} cwd
 * @returns {Promise<{added: boolean, path: string}>}
 */
export async function appendGitignore(cwd) {
  const gitignorePath = path.join(cwd, '.gitignore');
  const additionsPath = path.join(TEMPLATES_DIR, '.gitignore.additions');
  const additions = await fs.readFile(additionsPath, 'utf8');
  const marker = '# Added by claude-sdd';

  let existing = '';
  try {
    existing = await fs.readFile(gitignorePath, 'utf8');
  } catch {
    // doesn't exist
  }

  if (existing.includes(marker)) {
    return { added: false, path: gitignorePath };
  }

  const sep = existing && !existing.endsWith('\n') ? '\n\n' : existing ? '\n' : '';
  await fs.writeFile(gitignorePath, existing + sep + additions);
  return { added: true, path: gitignorePath };
}

/**
 * Print colored success line.
 * @param {string} relPath
 * @param {'created'|'skipped'|'overwritten'} action
 */
export function reportFile(relPath, action) {
  const icon = action === 'created' ? kleur.green('✓') : action === 'skipped' ? kleur.yellow('○') : kleur.cyan('↻');
  const tag = action === 'created' ? '' : kleur.dim(` (${action})`);
  console.log(`  ${icon} ${relPath}${tag}`);
}
