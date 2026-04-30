// @ts-check
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { installTemplates, appendGitignore, isExistingProject, EXTENSIONS, isValidExtensionId } from '../lib/install.js';

/** @type {string} */
let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-sdd-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const VARS = {
  PROJECT_NAME: 'test-app',
  PROJECT_DESCRIPTION: 'A test app',
  STACK: 'Node.js',
  REPO_LAYOUT: '<layout>',
  CONSTRAINTS: '<constraints>',
};

describe('installTemplates', () => {
  it('creates the expected file tree', async () => {
    await installTemplates({ cwd: tmpDir, vars: VARS });

    const expectedFiles = [
      'AGENTS.md', // canonical AI-assistant context
      'CLAUDE.md', // shim pointing to AGENTS.md (Claude Code)
      'SPEC_PIPELINE.md',
      'README.md', // renamed from .tmpl
      'TASKS.md',
      'specs/templates/feature.spec.md',
      'specs/prompts/spec-generator.md',
      'specs/prompts/spec-reviewer.md',
      'specs/prompts/test-generator.md',
      'specs/prompts/implementation.md',
      'specs/features/README.md',
      'specs/features/.gitkeep',
      'docs/adr/0000-template.md',
      'docs/runbooks/README.md',
      '.claude/skills/sdd/SKILL.md',
      '.claude/skills/sdd-init/SKILL.md',
    ];

    for (const f of expectedFiles) {
      const exists = await fs
        .access(path.join(tmpDir, f))
        .then(() => true)
        .catch(() => false);
      expect(exists, `expected ${f} to exist`).toBe(true);
    }
  });

  it('does NOT copy README.md.tmpl as-is (renames to README.md)', async () => {
    await installTemplates({ cwd: tmpDir, vars: VARS });
    const tmplExists = await fs
      .access(path.join(tmpDir, 'README.md.tmpl'))
      .then(() => true)
      .catch(() => false);
    expect(tmplExists).toBe(false);
    const readmeExists = await fs
      .access(path.join(tmpDir, 'README.md'))
      .then(() => true)
      .catch(() => false);
    expect(readmeExists).toBe(true);
  });

  it('replaces placeholders with provided vars in AGENTS.md', async () => {
    await installTemplates({ cwd: tmpDir, vars: VARS });
    const agentsMd = await fs.readFile(path.join(tmpDir, 'AGENTS.md'), 'utf8');
    expect(agentsMd).toContain('# test-app');
    expect(agentsMd).toContain('**Stack**: Node.js');
    expect(agentsMd).not.toContain('{{PROJECT_NAME}}');
    expect(agentsMd).not.toContain('{{STACK}}');
  });

  it('CLAUDE.md is a thin shim pointing to AGENTS.md', async () => {
    await installTemplates({ cwd: tmpDir, vars: VARS });
    const claudeMd = await fs.readFile(path.join(tmpDir, 'CLAUDE.md'), 'utf8');
    expect(claudeMd).toContain('AGENTS.md');
    // Shim should be small — under 20 lines is plenty
    expect(claudeMd.split('\n').length).toBeLessThan(20);
  });

  it('leaves free-form placeholders unresolved in AGENTS.md when not provided', async () => {
    // Mirrors what bin/cli.js passes: only the deterministic placeholders.
    // The sdd-init skill detects unresolved {{X}} as "first-time setup needed".
    await installTemplates({
      cwd: tmpDir,
      vars: { PROJECT_NAME: 'test-app', STACK: 'Node.js' },
    });
    const agentsMd = await fs.readFile(path.join(tmpDir, 'AGENTS.md'), 'utf8');
    expect(agentsMd).toContain('{{PROJECT_DESCRIPTION}}');
    expect(agentsMd).toContain('{{REPO_LAYOUT}}');
    expect(agentsMd).toContain('{{CONSTRAINTS}}');
  });

  it('skipOnly mode installs all .claude/skills/ entries and nothing else', async () => {
    await installTemplates({ cwd: tmpDir, vars: VARS, skillOnly: true });

    const sddExists = await fs
      .access(path.join(tmpDir, '.claude/skills/sdd/SKILL.md'))
      .then(() => true)
      .catch(() => false);
    expect(sddExists).toBe(true);

    const sddInitExists = await fs
      .access(path.join(tmpDir, '.claude/skills/sdd-init/SKILL.md'))
      .then(() => true)
      .catch(() => false);
    expect(sddInitExists).toBe(true);

    const claudeExists = await fs
      .access(path.join(tmpDir, 'CLAUDE.md'))
      .then(() => true)
      .catch(() => false);
    expect(claudeExists, 'CLAUDE.md should NOT exist in skill-only mode').toBe(false);

    const agentsExists = await fs
      .access(path.join(tmpDir, 'AGENTS.md'))
      .then(() => true)
      .catch(() => false);
    expect(agentsExists, 'AGENTS.md should NOT exist in skill-only mode').toBe(false);
  });

  it('skips existing files by default (onConflict=skip)', async () => {
    const userAgents = '# My existing AGENTS.md\nDo not overwrite me.';
    await fs.writeFile(path.join(tmpDir, 'AGENTS.md'), userAgents);

    await installTemplates({ cwd: tmpDir, vars: VARS, onConflict: 'skip' });

    const after = await fs.readFile(path.join(tmpDir, 'AGENTS.md'), 'utf8');
    expect(after).toBe(userAgents);
  });

  it('overwrites existing files when onConflict=overwrite', async () => {
    await fs.writeFile(path.join(tmpDir, 'AGENTS.md'), '# old');

    await installTemplates({ cwd: tmpDir, vars: VARS, onConflict: 'overwrite' });

    const after = await fs.readFile(path.join(tmpDir, 'AGENTS.md'), 'utf8');
    expect(after).toContain('# test-app');
  });

  it('writes a .bak before overwriting an existing file', async () => {
    const original = '# my custom AGENTS.md\nlots of important content';
    await fs.writeFile(path.join(tmpDir, 'AGENTS.md'), original);

    await installTemplates({ cwd: tmpDir, vars: VARS, onConflict: 'overwrite' });

    const bak = await fs.readFile(path.join(tmpDir, 'AGENTS.md.bak'), 'utf8');
    expect(bak).toBe(original);
  });

  it('does NOT write a .bak when onConflict=skip', async () => {
    await fs.writeFile(path.join(tmpDir, 'AGENTS.md'), '# kept');

    await installTemplates({ cwd: tmpDir, vars: VARS, onConflict: 'skip' });

    const bakExists = await fs
      .access(path.join(tmpDir, 'AGENTS.md.bak'))
      .then(() => true)
      .catch(() => false);
    expect(bakExists).toBe(false);
  });

  it('does NOT copy .gitignore.additions to destination (it is a source-only file)', async () => {
    await installTemplates({ cwd: tmpDir, vars: VARS });
    const additionsCopied = await fs
      .access(path.join(tmpDir, '.gitignore.additions'))
      .then(() => true)
      .catch(() => false);
    expect(additionsCopied, '.gitignore.additions should NOT be copied — it is a source-only file used by appendGitignore()').toBe(false);
  });

  it('reports created/skipped/overwritten via callback', async () => {
    /** @type {Array<[string, string]>} */
    const events = [];
    await installTemplates({
      cwd: tmpDir,
      vars: VARS,
      onFile: (rel, action) => events.push([rel, action]),
    });
    const created = events.filter(([, a]) => a === 'created');
    expect(created.length).toBeGreaterThan(10);
  });
});

describe('extensions', () => {
  it('exports a non-empty catalog', () => {
    expect(EXTENSIONS.length).toBeGreaterThan(0);
    for (const ext of EXTENSIONS) {
      expect(ext.id).toBeTypeOf('string');
      expect(ext.label).toBeTypeOf('string');
    }
  });

  it('isValidExtensionId works', () => {
    expect(isValidExtensionId('multi-tenant')).toBe(true);
    expect(isValidExtensionId('not-a-real-extension')).toBe(false);
  });

  it('DOES copy individual extension fragments to destination', async () => {
    await installTemplates({ cwd: tmpDir, vars: VARS });
    // README.md is the catalog — should be copied
    const catalogExists = await fs
      .access(path.join(tmpDir, 'specs/templates/extensions/README.md'))
      .then(() => true)
      .catch(() => false);
    expect(catalogExists, 'extensions/README.md (catalog) should exist').toBe(true);
    // Individual fragments SHOULD be copied so the sdd skill can merge them on-demand
    for (const ext of EXTENSIONS) {
      const fragExists = await fs
        .access(path.join(tmpDir, `specs/templates/extensions/${ext.id}.md`))
        .then(() => true)
        .catch(() => false);
      expect(fragExists, `extensions/${ext.id}.md fragment should exist at destination`).toBe(true);
    }
  });

  it('with NO extensions selected, feature.spec.md has no extension blocks', async () => {
    await installTemplates({ cwd: tmpDir, vars: VARS, extensions: [] });
    const spec = await fs.readFile(path.join(tmpDir, 'specs/templates/feature.spec.md'), 'utf8');
    expect(spec).not.toContain('## Multi-tenant boundary');
    expect(spec).not.toContain('## Migration impact');
    expect(spec).not.toContain('## Rollout plan');
    // The "Optional sections (extensions)" placeholder block should still be there as a hint
    expect(spec).toContain('Optional sections (extensions)');
  });

  it('with multi-tenant extension, feature.spec.md includes the multi-tenant block', async () => {
    await installTemplates({ cwd: tmpDir, vars: VARS, extensions: ['multi-tenant'] });
    const spec = await fs.readFile(path.join(tmpDir, 'specs/templates/feature.spec.md'), 'utf8');
    expect(spec).toContain('## Multi-tenant boundary');
    expect(spec).toContain('Extensions enabled: multi-tenant');
    // Other extensions should NOT be merged in
    expect(spec).not.toContain('## Migration impact');
    expect(spec).not.toContain('## Rollout plan');
  });

  it('with multiple extensions, all selected blocks are merged', async () => {
    await installTemplates({
      cwd: tmpDir,
      vars: VARS,
      extensions: ['multi-tenant', 'persistent-data', 'production-rollout'],
    });
    const spec = await fs.readFile(path.join(tmpDir, 'specs/templates/feature.spec.md'), 'utf8');
    expect(spec).toContain('## Multi-tenant boundary');
    expect(spec).toContain('## Migration impact');
    expect(spec).toContain('## Backwards compatibility');
    expect(spec).toContain('## Rollout plan');
    expect(spec).toContain('Extensions enabled: multi-tenant, persistent-data, production-rollout');
  });

  it('invalid extension IDs are silently filtered', async () => {
    await installTemplates({
      cwd: tmpDir,
      vars: VARS,
      extensions: ['multi-tenant', 'made-up-extension'],
    });
    const spec = await fs.readFile(path.join(tmpDir, 'specs/templates/feature.spec.md'), 'utf8');
    expect(spec).toContain('## Multi-tenant boundary');
    expect(spec).not.toContain('made-up-extension');
  });

  it('Review notes section stays at the bottom after extensions are merged', async () => {
    await installTemplates({ cwd: tmpDir, vars: VARS, extensions: ['multi-tenant'] });
    const spec = await fs.readFile(path.join(tmpDir, 'specs/templates/feature.spec.md'), 'utf8');
    const reviewIdx = spec.indexOf('## Review notes');
    const tenantIdx = spec.indexOf('## Multi-tenant boundary');
    expect(reviewIdx).toBeGreaterThan(-1);
    expect(tenantIdx).toBeGreaterThan(-1);
    expect(reviewIdx).toBeGreaterThan(tenantIdx);
  });
});

describe('appendGitignore', () => {
  it('creates .gitignore if missing', async () => {
    const result = await appendGitignore(tmpDir);
    expect(result.added).toBe(true);
    const content = await fs.readFile(result.path, 'utf8');
    expect(content).toContain('# Added by claude-sdd');
    expect(content).toContain('.claude/settings.local.json');
  });

  it('appends to existing .gitignore', async () => {
    const existing = 'node_modules/\n.env\n';
    await fs.writeFile(path.join(tmpDir, '.gitignore'), existing);

    const result = await appendGitignore(tmpDir);
    expect(result.added).toBe(true);
    const content = await fs.readFile(result.path, 'utf8');
    expect(content).toContain(existing);
    expect(content).toContain('# Added by claude-sdd');
  });

  it('is idempotent (skips if marker present)', async () => {
    await fs.writeFile(
      path.join(tmpDir, '.gitignore'),
      'node_modules/\n# Added by claude-sdd\n.scratch/\n'
    );
    const result = await appendGitignore(tmpDir);
    expect(result.added).toBe(false);
  });
});

describe('isExistingProject', () => {
  it('returns false for an empty directory', async () => {
    expect(await isExistingProject(tmpDir)).toBe(false);
  });

  it('returns true when package.json exists', async () => {
    await fs.writeFile(path.join(tmpDir, 'package.json'), '{}');
    expect(await isExistingProject(tmpDir)).toBe(true);
  });

  it('returns true when pyproject.toml exists', async () => {
    await fs.writeFile(path.join(tmpDir, 'pyproject.toml'), '');
    expect(await isExistingProject(tmpDir)).toBe(true);
  });

  it('returns true when Cargo.toml exists', async () => {
    await fs.writeFile(path.join(tmpDir, 'Cargo.toml'), '');
    expect(await isExistingProject(tmpDir)).toBe(true);
  });

  it('returns true when go.mod exists', async () => {
    await fs.writeFile(path.join(tmpDir, 'go.mod'), '');
    expect(await isExistingProject(tmpDir)).toBe(true);
  });

  it('returns true when .git directory exists', async () => {
    await fs.mkdir(path.join(tmpDir, '.git'));
    expect(await isExistingProject(tmpDir)).toBe(true);
  });
});
