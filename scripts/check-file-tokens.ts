import { execFileSync } from 'node:child_process'

const MAX_TOKENS = 5000
const BYTES_PER_TOKEN = 4

const GENERATED = [
  /^package-lock\.json$/,
  /^data\/raw\//,
  /^src\/data\/(foods|unsalted-foods|equivalents)\.json$/,
]

function git(args: string[], input?: string): string {
  return execFileSync('git', args, {
    input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
}

const stagedText = git(['diff', '--cached', '--numstat', '--no-renames', '--diff-filter=d', '-z'])
  .split('\0')
  .filter(Boolean)
  .map((record) => record.split('\t'))
  .filter(([added]) => added !== '-')
  .map((fields) => fields.slice(2).join('\t'))
  .filter((file) => !GENERATED.some((pattern) => pattern.test(file)))

const sizes = stagedText.length
  ? git(
      ['cat-file', '--batch-check=%(objectsize)'],
      stagedText.map((file) => `:${file}\n`).join(''),
    )
      .trim()
      .split('\n')
      .map(Number)
  : []

const oversized = stagedText
  .map((file, index) => ({
    file,
    tokens: Math.ceil(sizes[index] / BYTES_PER_TOKEN),
  }))
  .filter(({ tokens }) => tokens > MAX_TOKENS)

if (oversized.length > 0) {
  const list = oversized.map(({ file, tokens }) => `  ${file}  ~${tokens} tokens`).join('\n')

  console.error(`These staged files are over ${MAX_TOKENS} tokens (bytes / 4):

${list}

A file this size is too big for an agent to read and edit in one pass.
Split each file before you commit. This applies even when you only touched it.

1. Find the seams. Group the code by reason to change: types and constants,
   pure logic, side effects and framework glue, components, styles.
2. Move each group into its own file next to the original, named for what it
   does (workouts.ts becomes one file per concern it holds).
3. Update every import to the new files in the same commit. Do not leave a
   barrel file that only re-exports names.
4. Split a test file the same way, one file per behaviour group, mirroring
   the source split. Split a long Markdown doc by heading into linked pages.
5. Stage the new files and commit again. This check reads what is staged.

Do not delete code, minify it, or join lines to get under the limit. Only a
generated file belongs in the GENERATED list in scripts/check-file-tokens.ts.`)
  process.exit(1)
}
