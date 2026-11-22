import { readFileSync } from 'node:fs'
import { relative } from 'node:path'

const BASELINE = new URL('./comment-baseline.json', import.meta.url)
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
const DIRECTIVE = /^\s*(?:(?:eslint|oxlint)-(?:disable|enable)|@ts-(?:expect-error|ignore|nocheck)|\/ <reference )/

const noComments = {
  meta: { type: 'suggestion', docs: { description: 'Bans comments, except lint and TypeScript directives; files in lint/comment-baseline.json may keep at most their count.' } },
  create(context) {
    return {
      Program(node) {
        const comments = context.sourceCode.getAllComments().filter((c) => !DIRECTIVE.test(c.value))
        const file = relative(process.cwd(), context.filename).split('\\').join('/')
        const allowed = baseline[file] ?? 0
        if (comments.length > allowed) {
          const loc = (comments[allowed] ?? comments[0]).loc
          context.report({ node, loc, message: `comments=${comments.length} allowed=${allowed}: delete comments instead of adding them (run /delete-comment).` })
        } else if (comments.length < allowed) {
          context.report({ node, message: `comments=${comments.length} allowed=${allowed}: the baseline is loose, run \`npm run comments:ratchet\`.` })
        }
      },
    }
  },
}

export default { meta: { name: 'treino' }, rules: { 'no-comments': noComments } }
