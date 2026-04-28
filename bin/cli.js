#!/usr/bin/env node
// @ts-check
import { Command } from 'commander';
import kleur from 'kleur';
import { createRequire } from 'node:module';
import { askInteractive, askConfirmInstall } from '../lib/prompts.js';
import { installTemplates, appendGitignore, reportFile, EXTENSIONS, isExistingProject, isValidExtensionId } from '../lib/install.js';

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
  console.log(kleur.bold().magenta('  claude-sdd ') + kleur.dim(`v${pkg.version}`));
  console.log(kleur.dim('  Pragmatic Spec-Driven Development for Claude Code'));
  console.log('');
}

function printNextSteps(repoUrl) {
  console.log('');
  console.log(kleur.bold('Next steps:'));
  console.log('  1. Open Claude Code in this directory');
  console.log('  2. Invoke the skill: ' + kleur.cyan('/sdd'));
  console.log('  3. The skill will read your codebase and customize CLAUDE.md');
  console.log('');
  console.log(kleur.dim('Docs: ' + repoUrl));
  console.log('');
}

const program = new Command();

program
  .name('claude-sdd')
  .description('Scaffold the Pragmatic SDD framework into a project for Claude Code.')
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
  .option('--skill-only', 'Only install the .claude/skills/sdd/ skill (no templates)', false)
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

    const vars = {
      PROJECT_NAME: answers.projectName,
      PROJECT_DESCRIPTION: '<one-line description of your project — fill in via the `sdd` skill>',
      STACK: stackLabel,
      REPO_LAYOUT: '<repo layout — fill in via the `sdd` skill after first run>',
      CONSTRAINTS: '<project-specific constraints — fill in via the `sdd` skill>',
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

    printNextSteps(pkg.homepage || pkg.repository?.url || 'https://github.com/MigueMercedes/claude-sdd');
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(kleur.red('Error:'), err.message || err);
  process.exit(1);
});
