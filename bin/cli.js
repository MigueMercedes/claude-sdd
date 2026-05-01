#!/usr/bin/env node
// @ts-check
import { Command } from 'commander';
import kleur from 'kleur';
import { createRequire } from 'node:module';
import { askInteractive, askConfirmInstall, askConfirmUpdate } from '../lib/prompts.js';
import { installTemplates, appendGitignore, reportFile, EXTENSIONS, isExistingProject, isValidExtensionId } from '../lib/install.js';
import { updateProject, isClaudeSddProject } from '../lib/update.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const STACK_LABELS = {
  node: 'Node.js',
  python: 'Python',
  rust: 'Rust',
  go: 'Go',
  mixed: 'Mixed (monorepo)',
  other: 'Other',
};

function printBanner() {
  console.log('');
  console.log(kleur.bold().magenta('  pragspec ') + kleur.dim(`v${pkg.version}`));
  console.log(kleur.dim('  Pragmatic Spec-Driven Development — tool-agnostic via AGENTS.md'));
  console.log('');
}

function printNextSteps(repoUrl) {
  console.log('');
  console.log(kleur.bold('Next steps:'));
  console.log('  1. Open your AI coding tool in this directory (Claude Code, Codex, Cursor, Gemini CLI, ...)');
  console.log('  2. Invoke ' + kleur.cyan('/sdd-init') + ' once — customizes ' + kleur.bold('AGENTS.md') + ' by reading your codebase');
  console.log('  3. Use ' + kleur.cyan('/sdd') + ' from then on for any task that touches code');
  console.log('');
  console.log(kleur.dim('Tip: AGENTS.md is the single source of truth. CLAUDE.md is a shim that points to it.'));
  console.log(kleur.dim('Tip: re-invoke /sdd-init later if your stack drifts or AGENTS.md feels stale.'));
  console.log(kleur.dim('Docs: ' + repoUrl));
  console.log('');
}

const program = new Command();

program
  .name('pragspec')
  .description('Scaffold the Pragmatic SDD framework into a project — tool-agnostic via AGENTS.md.')
  .version(pkg.version);

program
  .command('init')
  .description('Install SDD templates + skill into the current directory')
  .option('-y, --yes', 'Non-interactive: use defaults for everything', false)
  .option('--project-name <name>', 'Project name (skip prompt)')
  .option('--stack <stack>', 'Stack: node | python | rust | go | mixed | other', 'other')
  .option(
    '--extensions <list>',
    `Comma-separated extensions to enable. Valid: ${EXTENSIONS.map((e) => e.id).join(', ')}`
  )
  .option('--skill-only', 'Only install the .claude/skills/ directory (sdd + sdd-init), no other templates', false)
  .option('--ask', 'Force the interactive prompts even when an existing project is detected', false)
  .option('--overwrite', 'Overwrite existing files instead of skipping', false)
  .option('--no-gitignore', 'Do not modify .gitignore')
  .action(async (opts) => {
    printBanner();
    const cwd = process.cwd();

    /** @type {string[]} */
    let parsedExtensions = [];
    if (opts.extensions) {
      const ids = opts.extensions
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const invalid = ids.filter((id) => !isValidExtensionId(id));
      if (invalid.length) {
        console.error(
          kleur.red(`Unknown extension(s): ${invalid.join(', ')}`) +
            '\nValid IDs: ' +
            EXTENSIONS.map((e) => e.id).join(', ')
        );
        process.exit(1);
      }
      parsedExtensions = ids;
    }

    let answers;

    if (opts.yes || opts.skillOnly) {
      const projectName = opts.projectName || cwd.split('/').pop() || 'my-project';
      answers = {
        projectName,
        stack: opts.stack,
        extensions: parsedExtensions,
        addToGitignore: opts.gitignore !== false,
        onConflict: /** @type {'overwrite'|'skip'} */ (opts.overwrite ? 'overwrite' : 'skip'),
      };
    } else if (!opts.ask && (await isExistingProject(cwd))) {
      console.log(kleur.dim('Detected existing project — deferring stack/extension detection to the `sdd` skill.'));
      const onConflict = /** @type {'overwrite'|'skip'} */ (opts.overwrite ? 'overwrite' : 'skip');
      const proceed = await askConfirmInstall({ cwd, onConflict });
      if (!proceed) {
        console.log(kleur.red('Cancelled.'));
        process.exit(1);
      }
      const projectName = opts.projectName || cwd.split('/').pop() || 'my-project';
      answers = {
        projectName,
        stack: opts.stack, // 'other' by default; skill will refine
        extensions: parsedExtensions,
        addToGitignore: opts.gitignore !== false,
        onConflict,
      };
    } else {
      const interactive = await askInteractive({ cwd });
      if (!interactive) {
        console.log(kleur.red('Cancelled.'));
        process.exit(1);
      }
      answers = interactive;
      if (parsedExtensions.length) answers.extensions = parsedExtensions;
    }

    const stackLabel = STACK_LABELS[answers.stack] || answers.stack;

    // Resolve only the placeholders the CLI knows for sure. Free-form ones
    // ({{PROJECT_DESCRIPTION}}, {{REPO_LAYOUT}}, {{CONSTRAINTS}}) are left as
    // literal {{X}} so the `sdd` skill can detect "first-time setup needed"
    // by grepping for unresolved placeholders, then fill them by reading the
    // codebase and asking the user.
    const vars = {
      PROJECT_NAME: answers.projectName,
      STACK: stackLabel,
    };

    if (answers.extensions.length) {
      console.log(kleur.dim('Extensions enabled: ' + answers.extensions.join(', ')));
    } else {
      console.log(kleur.dim('No extensions — lean base spec template'));
    }
    console.log(kleur.bold('\nInstalling files:'));
    await installTemplates({
      cwd,
      vars,
      skillOnly: opts.skillOnly,
      extensions: answers.extensions,
      onConflict: answers.onConflict,
      onFile: reportFile,
    });

    if (answers.addToGitignore && !opts.skillOnly) {
      const result = await appendGitignore(cwd);
      if (result.added) {
        console.log(`  ${kleur.green('✓')} .gitignore ${kleur.dim('(SDD lines appended)')}`);
      } else {
        console.log(`  ${kleur.yellow('○')} .gitignore ${kleur.dim('(already has SDD marker)')}`);
      }
    }

    printNextSteps(pkg.homepage || pkg.repository?.url || 'https://github.com/MigueMercedes/pragspec');
  });

program
  .command('update')
  .description('Sync skill files and managed AGENTS.md sections with the upstream template')
  .option('-y, --yes', 'Non-interactive: skip the confirmation prompt', false)
  .option('--dry-run', 'Show the plan without writing any files', false)
  .option('--skills-only', 'Only update .claude/skills/ files', false)
  .option('--docs-only', 'Only update managed sections in AGENTS.md', false)
  .action(async (opts) => {
    printBanner();
    const cwd = process.cwd();

    if (opts.skillsOnly && opts.docsOnly) {
      console.error(kleur.red('Error:') + ' --skills-only and --docs-only are mutually exclusive');
      process.exit(1);
    }

    if (!(await isClaudeSddProject(cwd))) {
      console.error(
        kleur.red('Error:') +
          ' this directory does not look like a pragspec project (no `.claude/skills/sdd/SKILL.md`).'
      );
      console.error(kleur.dim('  Run `npx pragspec init` first.'));
      process.exit(1);
    }

    /** @type {'all' | 'skills-only' | 'docs-only'} */
    const scope = opts.skillsOnly ? 'skills-only' : opts.docsOnly ? 'docs-only' : 'all';

    // First pass: dry-run to compute the plan without touching disk.
    const plan = await updateProject({ cwd, scope, dryRun: true });

    console.log(kleur.bold('Plan:'));
    let willChange = 0;
    let manualRequired = 0;
    for (const item of plan.items) {
      const line = formatPlanLine(item);
      console.log('  ' + line);
      if (item.action === 'updated') willChange += 1;
      if (item.action === 'manual-required') manualRequired += 1;
    }
    console.log('');

    if (willChange === 0 && manualRequired === 0) {
      console.log(kleur.green('Nothing to do. ✓') + kleur.dim(' Everything is already up-to-date.'));
      return;
    }

    if (opts.dryRun) {
      console.log(kleur.dim('--dry-run: no files modified.'));
      return;
    }

    if (willChange === 0 && manualRequired > 0) {
      console.log(
        kleur.yellow('All pending changes require manual action.') +
          ' See the messages above. No automatic update applied.'
      );
      process.exit(1);
    }

    if (!opts.yes) {
      const proceed = await askConfirmUpdate({
        message: `Apply ${willChange} update${willChange === 1 ? '' : 's'}? (.bak files will be created)`,
      });
      if (!proceed) {
        console.log(kleur.red('Cancelled.'));
        process.exit(1);
      }
    }

    // Second pass: actually apply.
    const applied = await updateProject({ cwd, scope, dryRun: false });

    console.log('');
    console.log(kleur.bold('Result:'));
    let updatedCount = 0;
    let unchangedCount = 0;
    let skippedCount = 0;
    for (const item of applied.items) {
      const line = formatResultLine(item);
      console.log('  ' + line);
      if (item.action === 'updated') updatedCount += 1;
      else if (item.action === 'unchanged') unchangedCount += 1;
      else skippedCount += 1;
    }

    console.log('');
    console.log(
      kleur.dim(
        `Summary: ${updatedCount} updated, ${unchangedCount} unchanged${skippedCount ? `, ${skippedCount} skipped (manual action needed)` : ''}.`
      )
    );
    console.log(kleur.dim('Tip: review changes with `git diff` and commit when ready.'));
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(kleur.red('Error:'), err.message || err);
  process.exit(1);
});

/**
 * @param {{ target: string, action: string, detail?: string }} item
 */
function formatPlanLine(item) {
  switch (item.action) {
    case 'updated':
      return `${kleur.cyan('↻')} ${item.target} ${kleur.dim('(will overwrite, .bak preserved)')}`;
    case 'unchanged':
      return `${kleur.yellow('○')} ${item.target} ${kleur.dim('(already up-to-date)')}`;
    case 'inserted':
      return `${kleur.green('+')} ${item.target} ${kleur.dim('(will insert)')}`;
    case 'manual-required':
      return `${kleur.yellow('⚠')} ${item.target} ${kleur.dim('— ' + (item.detail ?? 'manual action needed'))}`;
    case 'missing-target':
      return `${kleur.red('×')} ${item.target} ${kleur.dim('— ' + (item.detail ?? 'missing'))}`;
    default:
      return `${item.target} (${item.action})`;
  }
}

/**
 * @param {{ target: string, action: string, detail?: string }} item
 */
function formatResultLine(item) {
  switch (item.action) {
    case 'updated':
      return `${kleur.green('✓')} ${item.target} ${kleur.dim('(updated, .bak created)')}`;
    case 'unchanged':
      return `${kleur.yellow('○')} ${item.target} ${kleur.dim('(unchanged)')}`;
    case 'inserted':
      return `${kleur.green('✓')} ${item.target} ${kleur.dim('(inserted)')}`;
    case 'manual-required':
      return `${kleur.yellow('⚠')} ${item.target} ${kleur.dim('— ' + (item.detail ?? 'manual action needed'))}`;
    case 'missing-target':
      return `${kleur.red('×')} ${item.target} ${kleur.dim('— ' + (item.detail ?? 'missing'))}`;
    default:
      return `${item.target} (${item.action})`;
  }
}
