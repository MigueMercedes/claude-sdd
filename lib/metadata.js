// @ts-check
import { promises as fs } from 'node:fs';
import path from 'node:path';

/** Directory (relative to project root) where pragspec stores its provenance. */
export const METADATA_DIR = '.pragspec';
/** File (relative to project root) holding install/update provenance. */
export const METADATA_FILE = path.join(METADATA_DIR, 'metadata.json');
/** Display form of the metadata path, always forward-slashed for logs/reports. */
export const METADATA_DISPLAY = '.pragspec/metadata.json';

/**
 * @typedef {object} PragspecMetadata
 * @property {string} name           Always 'pragspec'.
 * @property {string} version        Package version that last wrote this file.
 * @property {string} installedAt    ISO timestamp of the first install.
 * @property {string} updatedAt      ISO timestamp of the last write (init or update).
 * @property {string} [stack]        Stack id chosen at init (informational).
 * @property {string[]} [extensions] Extension ids enabled at init (informational).
 */

/**
 * Absolute path to the metadata file for a given project root.
 * @param {string} cwd
 * @returns {string}
 */
export function metadataPath(cwd) {
  return path.join(cwd, METADATA_FILE);
}

/**
 * Read and parse `.pragspec/metadata.json`. Returns null when the file is
 * absent (legacy install scaffolded before metadata existed) or unparseable —
 * callers treat null as "unknown provenance" and degrade gracefully.
 * @param {string} cwd
 * @returns {Promise<PragspecMetadata | null>}
 */
export async function readMetadata(cwd) {
  let raw;
  try {
    raw = await fs.readFile(metadataPath(cwd), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return /** @type {PragspecMetadata} */ (parsed);
    }
    return null;
  } catch {
    return null; // corrupt JSON — treat as legacy/unknown rather than crash
  }
}

/**
 * Write `.pragspec/metadata.json`, creating `.pragspec/` if needed. Preserves
 * `installedAt` (and any `stack`/`extensions` not overridden) from existing
 * metadata. `now` is injectable so tests stay deterministic.
 * @param {string} cwd
 * @param {object} opts
 * @param {string} opts.version
 * @param {string} [opts.stack]
 * @param {string[]} [opts.extensions]
 * @param {string} [opts.now]   ISO timestamp; defaults to current time.
 * @returns {Promise<PragspecMetadata>}
 */
export async function writeMetadata(cwd, opts) {
  const now = opts.now ?? new Date().toISOString();
  const existing = await readMetadata(cwd);

  /** @type {PragspecMetadata} */
  const next = {
    name: 'pragspec',
    version: opts.version,
    installedAt: existing?.installedAt ?? now,
    updatedAt: now,
  };
  const stack = opts.stack ?? existing?.stack;
  if (stack !== undefined) next.stack = stack;
  const extensions = opts.extensions ?? existing?.extensions;
  if (extensions !== undefined) next.extensions = extensions;

  await fs.mkdir(path.join(cwd, METADATA_DIR), { recursive: true });
  await fs.writeFile(metadataPath(cwd), JSON.stringify(next, null, 2) + '\n');
  return next;
}

/**
 * Parse a semver-ish string into [major, minor, patch], ignoring any
 * pre-release / build suffix and a leading `v`.
 * @param {string} v
 * @returns {[number, number, number]}
 */
function parseVersion(v) {
  const core = String(v).trim().replace(/^v/, '').split('-')[0].split('+')[0];
  const parts = core.split('.').map((n) => Number.parseInt(n, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/**
 * Compare two semver-ish versions (MAJOR.MINOR.PATCH; suffixes ignored).
 * A null/undefined version sorts as the oldest possible (legacy installs with
 * no recorded version).
 * @param {string | null | undefined} a
 * @param {string | null | undefined} b
 * @returns {-1 | 0 | 1}
 */
export function compareSemver(a, b) {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

/**
 * Classify a version transition for human-readable reporting in `update`.
 * @param {string | null | undefined} from  recorded version (null = legacy)
 * @param {string | null | undefined} to    current package version
 * @returns {'fresh' | 'upgrade' | 'downgrade' | 'same'}
 */
export function classifyVersionDelta(from, to) {
  if (from == null) return 'fresh';
  const cmp = compareSemver(from, to);
  if (cmp < 0) return 'upgrade';
  if (cmp > 0) return 'downgrade';
  return 'same';
}
