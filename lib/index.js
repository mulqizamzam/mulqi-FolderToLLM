import { packContext, getDefaults } from './context-packager.js'

export const name = 'mulqi-folder-to-llm'
export const inject = ['tools']

function objectSchema(properties, required = []) {
  return { type: 'object', properties, required, additionalProperties: false }
}
const outputSchema = { type: 'object', properties: {}, additionalProperties: true }

export async function apply(ctx) {
  ctx.tools.register({
    name: 'folder_to_llm_defaults',
    description: 'Show safe defaults and supported filters for building a local project context snapshot.',
    parameters: objectSchema({}),
    output: { schema: outputSchema, render: (_args, value) => JSON.stringify(value, null, 2) },
    execute: async () => ({ ok: true, defaults: getDefaults(), note: 'Review the selected files before sharing the generated snapshot.' })
  })
  ctx.tools.register({
    name: 'folder_to_llm_pack',
    description: 'Build a bounded text snapshot of a project directory for LLM context. Uses host-accessible paths only, does not modify source files, and returns a reviewable file list plus the snapshot.',
    parameters: objectSchema({
      root: { type: 'string', description: 'Absolute or host-resolvable path to the project root.' },
      includeExtensions: { type: 'array', items: { type: 'string' }, description: 'Optional extension allowlist such as .ts, .js, .md.' },
      excludeExtensions: { type: 'array', items: { type: 'string' }, description: 'Additional extensions to skip.' },
      includeFolders: { type: 'array', items: { type: 'string' }, description: 'Optional relative folders to include.' },
      excludeFolders: { type: 'array', items: { type: 'string' }, description: 'Additional folder names or relative paths to skip.' },
      maxFileBytes: { type: 'integer', description: 'Maximum size for an individual file.' },
      maxFiles: { type: 'integer', description: 'Maximum files to examine.' },
      maxOutputChars: { type: 'integer', description: 'Maximum snapshot character count.' },
      respectGitignore: { type: 'boolean', description: 'Respect supported .gitignore patterns where available.' }
    }, ['root']),
    output: { schema: outputSchema, render: (_args, value) => JSON.stringify(value, null, 2) },
    execute: async (args, { signal } = {}) => await packContext(args, { signal })
  })
}
