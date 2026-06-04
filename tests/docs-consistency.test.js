// @ts-check
import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

/** @type {string} */
let cli;
/** @type {string} */
let readme;
/** @type {{ version: string, bin: Record<string,string> }} */
let pkg;

beforeAll(async () => {
  cli = await fs.readFile(path.join(repoRoot, 'bin', 'cli.js'), 'utf8');
  readme = await fs.readFile(path.join(repoRoot, 'README.md'), 'utf8');
  pkg = require(path.join(repoRoot, 'package.json'));
});

describe('README ↔ CLI command sync (drift guard)', () => {
  it('documents every registered subcommand as `pragspec <name>`', () => {
    const commands = [...cli.matchAll(/\.command\(['"]([a-z][\w-]*)['"]\)/g)].map((m) => m[1]);
    expect(commands.length, 'expected at least the init + update commands').toBeGreaterThanOrEqual(2);
    for (const cmd of commands) {
      expect(readme, `README should document \`pragspec ${cmd}\``).toContain(`pragspec ${cmd}`);
    }
  });

  it('does not contradict itself by claiming the update command is not bundled', () => {
    // The `update` command IS shipped (lib/update.js + bin/cli.js). A leftover
    // "we don't bundle an update command" rationale section would be stale drift.
    expect(/don'?t bundle an? .{0,4}update/i.test(readme), 'stale "do not bundle update" claim found').toBe(false);
  });

  it('keeps the README stability note on the same MAJOR.MINOR as package.json', () => {
    const [major, minor] = pkg.version.split('.');
    expect(readme, `README should mention current version line ${major}.${minor}.x`).toContain(`${major}.${minor}.x`);
  });
});

describe('metadata provenance is documented', () => {
  it('mentions .pragspec/metadata.json in the README', () => {
    expect(readme).toContain('.pragspec/metadata.json');
  });
});
