// @ts-check
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { installTemplates } from '../lib/install.js';
import { updateProject, isClaudeSddProject } from '../lib/update.js';

/** @type {string} */
let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pragspec-update-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const VARS = {
  PROJECT_NAME: 'test-app',
  STACK: 'Node.js',
};

describe('isClaudeSddProject', () => {
  it('returns false for an empty directory', async () => {
    expect(await isClaudeSddProject(tmpDir)).toBe(false);
  });

  it('returns true after a normal install', async () => {
    await installTemplates({ cwd: tmpDir, vars: VARS });
    expect(await isClaudeSddProject(tmpDir)).toBe(true);
  });

  it('returns true after a skill-only install', async () => {
    await installTemplates({ cwd: tmpDir, vars: VARS, skillOnly: true });
    expect(await isClaudeSddProject(tmpDir)).toBe(true);
  });
});

describe('updateProject', () => {
  it('reports all-unchanged on a fresh install', async () => {
    await installTemplates({ cwd: tmpDir, vars: VARS });
    const result = await updateProject({ cwd: tmpDir, dryRun: true });
    for (const item of result.items) {
      expect(item.action, `${item.target} should be unchanged`).toBe('unchanged');
    }
  });

  it('detects stale skill files and applies update with .bak', async () => {
    await installTemplates({ cwd: tmpDir, vars: VARS });
    const skillPath = path.join(tmpDir, '.claude/skills/sdd/SKILL.md');
    const originalContent = await fs.readFile(skillPath, 'utf8');
    await fs.writeFile(skillPath, '# stale skill content');

    const planResult = await updateProject({ cwd: tmpDir, dryRun: true });
    const skillItem = planResult.items.find((i) => i.target.endsWith('sdd/SKILL.md'));
    expect(skillItem?.action).toBe('updated');

    // Dry-run must not actually write
    const stillStale = await fs.readFile(skillPath, 'utf8');
    expect(stillStale).toBe('# stale skill content');

    const applyResult = await updateProject({ cwd: tmpDir, dryRun: false });
    const appliedSkill = applyResult.items.find((i) => i.target.endsWith('sdd/SKILL.md'));
    expect(appliedSkill?.action).toBe('updated');

    // Skill restored
    const restored = await fs.readFile(skillPath, 'utf8');
    expect(restored).toBe(originalContent);

    // .bak preserves the user's stale version
    const bak = await fs.readFile(skillPath + '.bak', 'utf8');
    expect(bak).toBe('# stale skill content');
  });

  it('preserves user customizations in AGENTS.md outside the managed section', async () => {
    await installTemplates({ cwd: tmpDir, vars: VARS });
    const agentsPath = path.join(tmpDir, 'AGENTS.md');
    let agents = await fs.readFile(agentsPath, 'utf8');

    // Customize OUTSIDE the managed section (Project Overview, Constraints, Project-specific skills)
    agents = agents.replace(
      '{{PROJECT_DESCRIPTION}}',
      'My very specific project description that must survive updates'
    );
    agents = agents.replace(
      'Add your own under `.claude/skills/<name>/SKILL.md` and document them above.',
      'Add your own under `.claude/skills/<name>/SKILL.md` and document them above.\n\n- `myproject:billing-helper` — runs in the IMPLEMENT step for billing changes'
    );

    // Also corrupt the managed section so we can verify it gets restored
    agents = agents.replace(
      '### Companion skills (optional, recommended)',
      '### Companion skills (optional, recommended)\n\nALL THIS CONTENT IS WRONG AND SHOULD BE REPLACED'
    );

    await fs.writeFile(agentsPath, agents);

    await updateProject({ cwd: tmpDir, dryRun: false });

    const updated = await fs.readFile(agentsPath, 'utf8');
    // Customizations preserved
    expect(updated).toContain('My very specific project description that must survive updates');
    expect(updated).toContain('myproject:billing-helper');
    // Managed section restored to canonical content
    expect(updated).not.toContain('ALL THIS CONTENT IS WRONG');
    expect(updated).toContain('superpowers:executing-plans');
    expect(updated).toContain('superpowers:requesting-code-review');
    expect(updated).toContain('superpowers:using-git-worktrees');
    // .bak created with the corrupted version
    const bak = await fs.readFile(agentsPath + '.bak', 'utf8');
    expect(bak).toContain('ALL THIS CONTENT IS WRONG');
  });

  it('reports manual-required when the managed heading is missing', async () => {
    await installTemplates({ cwd: tmpDir, vars: VARS });
    const agentsPath = path.join(tmpDir, 'AGENTS.md');
    let agents = await fs.readFile(agentsPath, 'utf8');
    // Simulate an older AGENTS.md that predates the §Companion skills sub-heading
    agents = agents.replace(
      '### Companion skills (optional, recommended)',
      '### Renamed by user'
    );
    await fs.writeFile(agentsPath, agents);

    const result = await updateProject({ cwd: tmpDir, dryRun: false });
    const docsItem = result.items.find((i) => i.kind === 'agents-section');
    expect(docsItem?.action).toBe('manual-required');
    expect(docsItem?.detail).toContain('heading');

    // No .bak should be written when nothing was applied to the file
    const bakExists = await fs
      .access(agentsPath + '.bak')
      .then(() => true)
      .catch(() => false);
    expect(bakExists).toBe(false);
  });

  it('scope=skills-only does not touch AGENTS.md even if it differs', async () => {
    await installTemplates({ cwd: tmpDir, vars: VARS });
    const agentsPath = path.join(tmpDir, 'AGENTS.md');
    const before = await fs.readFile(agentsPath, 'utf8');
    // Corrupt the managed section
    await fs.writeFile(
      agentsPath,
      before.replace(
        '### Companion skills (optional, recommended)',
        '### Companion skills (optional, recommended)\n\nWRONG CONTENT'
      )
    );

    const result = await updateProject({ cwd: tmpDir, scope: 'skills-only', dryRun: false });
    const docsItem = result.items.find((i) => i.kind === 'agents-section');
    expect(docsItem).toBeUndefined();

    // AGENTS.md still has the wrong content (we didn't touch it)
    const after = await fs.readFile(agentsPath, 'utf8');
    expect(after).toContain('WRONG CONTENT');
  });

  it('scope=docs-only does not touch skill files even if they differ', async () => {
    await installTemplates({ cwd: tmpDir, vars: VARS });
    const skillPath = path.join(tmpDir, '.claude/skills/sdd/SKILL.md');
    await fs.writeFile(skillPath, '# stale');

    const result = await updateProject({ cwd: tmpDir, scope: 'docs-only', dryRun: false });
    const skillItems = result.items.filter((i) => i.kind === 'skill');
    expect(skillItems).toHaveLength(0);

    const after = await fs.readFile(skillPath, 'utf8');
    expect(after).toBe('# stale');
  });

  it('reports missing-target when skills are not installed', async () => {
    // No install — empty directory
    const result = await updateProject({ cwd: tmpDir, scope: 'skills-only', dryRun: true });
    for (const item of result.items) {
      expect(item.action).toBe('missing-target');
    }
  });

  it('is idempotent — running update twice yields all-unchanged on second run', async () => {
    await installTemplates({ cwd: tmpDir, vars: VARS });
    // Force a real update first
    const skillPath = path.join(tmpDir, '.claude/skills/sdd/SKILL.md');
    await fs.writeFile(skillPath, '# stale');

    await updateProject({ cwd: tmpDir, dryRun: false });

    const second = await updateProject({ cwd: tmpDir, dryRun: false });
    for (const item of second.items) {
      expect(item.action, `${item.target} on second run`).toBe('unchanged');
    }
  });
});
