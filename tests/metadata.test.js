// @ts-check
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  readMetadata,
  writeMetadata,
  metadataPath,
  compareSemver,
  classifyVersionDelta,
  METADATA_DISPLAY,
} from '../lib/metadata.js';

/** @type {string} */
let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pragspec-metadata-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('readMetadata', () => {
  it('returns null when no metadata file exists (legacy install)', async () => {
    expect(await readMetadata(tmpDir)).toBeNull();
  });

  it('returns null for a corrupt metadata file (degrades gracefully)', async () => {
    await fs.mkdir(path.join(tmpDir, '.pragspec'), { recursive: true });
    await fs.writeFile(metadataPath(tmpDir), '{ not valid json');
    expect(await readMetadata(tmpDir)).toBeNull();
  });

  it('returns null when the JSON is not an object', async () => {
    await fs.mkdir(path.join(tmpDir, '.pragspec'), { recursive: true });
    await fs.writeFile(metadataPath(tmpDir), '["array","not","object"]');
    expect(await readMetadata(tmpDir)).toBeNull();
  });

  it('parses a valid metadata file', async () => {
    await writeMetadata(tmpDir, { version: '0.2.1', stack: 'node', now: '2026-01-01T00:00:00.000Z' });
    const meta = await readMetadata(tmpDir);
    expect(meta?.name).toBe('pragspec');
    expect(meta?.version).toBe('0.2.1');
    expect(meta?.stack).toBe('node');
  });
});

describe('writeMetadata', () => {
  it('creates .pragspec/metadata.json with name, version, timestamps', async () => {
    const meta = await writeMetadata(tmpDir, {
      version: '0.2.1',
      stack: 'node',
      extensions: ['multi-tenant'],
      now: '2026-06-04T10:00:00.000Z',
    });
    expect(meta.name).toBe('pragspec');
    expect(meta.version).toBe('0.2.1');
    expect(meta.installedAt).toBe('2026-06-04T10:00:00.000Z');
    expect(meta.updatedAt).toBe('2026-06-04T10:00:00.000Z');
    expect(meta.stack).toBe('node');
    expect(meta.extensions).toEqual(['multi-tenant']);

    // Round-trips through disk
    const onDisk = await readMetadata(tmpDir);
    expect(onDisk).toEqual(meta);
    // Pretty-printed with trailing newline
    const raw = await fs.readFile(metadataPath(tmpDir), 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(raw).toContain('\n  "version": "0.2.1"');
  });

  it('preserves installedAt across rewrites but bumps updatedAt and version', async () => {
    await writeMetadata(tmpDir, { version: '0.2.0', now: '2026-01-01T00:00:00.000Z' });
    const after = await writeMetadata(tmpDir, { version: '0.3.0', now: '2026-06-04T00:00:00.000Z' });
    expect(after.installedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(after.updatedAt).toBe('2026-06-04T00:00:00.000Z');
    expect(after.version).toBe('0.3.0');
  });

  it('preserves prior stack/extensions when not overridden', async () => {
    await writeMetadata(tmpDir, {
      version: '0.2.0',
      stack: 'python',
      extensions: ['persistent-data'],
      now: '2026-01-01T00:00:00.000Z',
    });
    const after = await writeMetadata(tmpDir, { version: '0.3.0', now: '2026-06-04T00:00:00.000Z' });
    expect(after.stack).toBe('python');
    expect(after.extensions).toEqual(['persistent-data']);
  });

  it('exposes a forward-slashed display path', () => {
    expect(METADATA_DISPLAY).toBe('.pragspec/metadata.json');
  });
});

describe('compareSemver', () => {
  it('orders by major, minor, patch', () => {
    expect(compareSemver('0.2.0', '0.3.0')).toBe(-1);
    expect(compareSemver('0.3.0', '0.2.0')).toBe(1);
    expect(compareSemver('1.0.0', '0.9.9')).toBe(1);
    expect(compareSemver('0.2.1', '0.2.1')).toBe(0);
    expect(compareSemver('0.2.10', '0.2.9')).toBe(1);
  });

  it('ignores pre-release / build suffixes and a leading v', () => {
    expect(compareSemver('v0.3.0', '0.3.0')).toBe(0);
    expect(compareSemver('0.3.0-beta.1', '0.3.0')).toBe(0);
    expect(compareSemver('0.3.0+build', '0.3.0')).toBe(0);
  });

  it('treats null/undefined as the oldest possible version', () => {
    expect(compareSemver(null, '0.1.0')).toBe(-1);
    expect(compareSemver('0.1.0', null)).toBe(1);
    expect(compareSemver(null, null)).toBe(0);
    expect(compareSemver(undefined, undefined)).toBe(0);
  });
});

describe('classifyVersionDelta', () => {
  it('reports fresh when there is no recorded version', () => {
    expect(classifyVersionDelta(null, '0.3.0')).toBe('fresh');
    expect(classifyVersionDelta(undefined, '0.3.0')).toBe('fresh');
  });

  it('reports upgrade / same / downgrade', () => {
    expect(classifyVersionDelta('0.2.0', '0.3.0')).toBe('upgrade');
    expect(classifyVersionDelta('0.3.0', '0.3.0')).toBe('same');
    expect(classifyVersionDelta('0.4.0', '0.3.0')).toBe('downgrade');
  });
});
