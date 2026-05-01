// @ts-check
import path from 'node:path';
import promptsLib from 'prompts';
import { EXTENSIONS } from './install.js';

const STACK_CHOICES = [
  { title: 'Node.js / TypeScript', value: 'node' },
  { title: 'Python', value: 'python' },
  { title: 'Rust', value: 'rust' },
  { title: 'Go', value: 'go' },
  { title: 'Mixed (monorepo)', value: 'mixed' },
  { title: 'Other / Custom', value: 'other' },
];

const EXTENSION_CHOICES = EXTENSIONS.map((e) => ({ title: e.label, value: e.id }));

/**
 * Ask the user for project metadata. Returns null if user cancelled.
 * @param {object} defaults
 * @param {string} defaults.cwd
 * @returns {Promise<{projectName: string, stack: string, extensions: string[], addToGitignore: boolean, onConflict: 'overwrite'|'skip'} | null>}
 */
export async function askInteractive(defaults) {
  const cancelled = { cancelled: false };

  const answers = await promptsLib(
    [
      {
        type: 'text',
        name: 'projectName',
        message: 'Project name',
        initial: path.basename(defaults.cwd),
      },
      {
        type: 'select',
        name: 'stack',
        message: 'Primary stack',
        choices: STACK_CHOICES,
        initial: 0,
      },
      {
        type: 'multiselect',
        name: 'extensions',
        message: 'Which spec extensions apply to your project?',
        hint: 'Space to select, Enter to confirm. Leave empty for a lean base template.',
        instructions: false,
        choices: EXTENSION_CHOICES,
        min: 0,
      },
      {
        type: 'confirm',
        name: 'addToGitignore',
        message: 'Append SDD lines to .gitignore? (creates if missing)',
        initial: true,
      },
      {
        type: 'select',
        name: 'onConflict',
        message: 'When a file already exists',
        choices: [
          { title: 'Skip (keep existing)', value: 'skip' },
          { title: 'Overwrite', value: 'overwrite' },
        ],
        initial: 0,
      },
    ],
    {
      onCancel: () => {
        cancelled.cancelled = true;
        return false;
      },
    }
  );

  if (cancelled.cancelled) return null;
  return {
    projectName: answers.projectName,
    stack: answers.stack,
    extensions: answers.extensions || [],
    addToGitignore: answers.addToGitignore,
    onConflict: answers.onConflict,
  };
}

/**
 * Confirmation prompt for the `update` command after the plan is shown.
 * @param {{ message?: string }} [opts]
 * @returns {Promise<boolean>}
 */
export async function askConfirmUpdate(opts = {}) {
  const cancelled = { cancelled: false };
  const answer = await promptsLib(
    {
      type: 'confirm',
      name: 'proceed',
      message: opts.message ?? 'Apply these changes?',
      initial: true,
    },
    {
      onCancel: () => {
        cancelled.cancelled = true;
        return false;
      },
    }
  );
  if (cancelled.cancelled) return false;
  return Boolean(answer.proceed);
}

/**
 * Single-prompt confirmation for the auto-detected existing-project flow.
 * @param {{cwd: string, onConflict?: 'overwrite'|'skip'}} opts
 * @returns {Promise<boolean>}
 */
export async function askConfirmInstall(opts) {
  const cancelled = { cancelled: false };
  const conflictNote =
    opts.onConflict === 'overwrite' ? 'existing files may be overwritten' : 'existing files are kept';
  const answer = await promptsLib(
    {
      type: 'confirm',
      name: 'proceed',
      message: `Install claude-sdd into ${path.basename(opts.cwd)}? (${conflictNote})`,
      initial: true,
    },
    {
      onCancel: () => {
        cancelled.cancelled = true;
        return false;
      },
    }
  );
  if (cancelled.cancelled) return false;
  return Boolean(answer.proceed);
}
