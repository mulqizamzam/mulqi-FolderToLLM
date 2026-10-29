import { createContextPack } from './context-packager.js'

export const name = 'mulqi-folder-to-llm'
export const inject = ['tools']

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {},
  additionalProperties: true,
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}
function neutralizeDeep(value, seen = new WeakSet()) {
  if (value === undefined) return null
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return typeof value === 'string' ? value.replace(/\{\{/g, '{').replace(/\}\}/g, '}') : value
  }
  if (typeof value === 'number') return Number.isFinite(value) && !Object.is(value, -0) ? value : null
  if (typeof value !== 'object') return String(value)
  if (seen.has(value)) return '[Circular]'
  seen.add(value)
  let out
  if (Array.isArray(value)) out = value.map((entry) => neutralizeDeep(entry, seen))
  else {
    out = {}
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue
      out[key.replace(/\{\{/g, '{').replace(/\}\}/g, '}')] = neutralizeDeep(item, seen)
    }
  }
  seen.delete(value)
  return out
}

function register(ctx, tool) {
  if (!ctx?.tools || typeof ctx.tools.register !== 'function') throw new Error('DSH host must provide ctx.tools.register')
  ctx.tools.register({ ...tool, output: tool.output ?? { schema: OUTPUT_SCHEMA, render: (_args, value) => JSON.stringify(value, null, 2) } })
}

export async function apply(ctx) {
  register(ctx, {
    name: 'folder_to_llm_pack',
    description: 'Create a filtered text snapshot of a local project directory for LLM analysis. Supports .gitignore, include/exclude filters, file-size and total-context budgets. Skips symlinks, common build/dependency directories, known secret filenames, binary files, and common binary extensions. Review output before sharing.',
    parameters: {
      type: 'object',
      properties: {
        rootPath: { type: 'string', description: 'Absolute or working-directory-relative path to the directory. Defaults to the current process working directory.' },
        includeFolders: { type: 'array', items: { type: 'string' }, description: 'Optional relative folder paths to limit included file content.' },
        excludePaths: { type: 'array', items: { type: 'string' }, description: 'Optional relative paths under rootPath to exclude.' },
        includeExtensions: { type: 'array', items: { type: 'string' }, description: 'Optional extension allowlist, e.g. [".ts", ".md"].' },
        excludeExtensions: { type: 'array', items: { type: 'string' }, description: 'Additional excluded extensions, e.g. [".csv", ".pem"].' },
        excludeFolders: { type: 'array', items: { type: 'string' }, description: 'Additional excluded directory names or relative paths.' },
        maxFileSizeBytes: { type: 'integer', minimum: 0, description: 'Maximum bytes per candidate file; default 1048576.' },
        maxTotalChars: { type: 'integer', minimum: 0, description: 'Maximum approximate character budget for emitted tree plus file content; default 150000.' },
        maxEntries: { type: 'integer', minimum: 1, description: 'Maximum directory tree entries, capped at 100000.' },
        useGitignore: { type: 'boolean', description: 'Whether to apply best-effort .gitignore exclusions. Defaults to true.' }
      },
      required: [],
    },
    execute: async (rawArgs, { signal } = {}) => {
      if (signal?.aborted) return neutralizeDeep({ ok: false, error: 'Operation cancelled before starting.' })
      try {
        const result = await createContextPack(asObject(rawArgs))
        return neutralizeDeep(result)
      } catch (error) {
        return neutralizeDeep({ ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  })
  register(ctx, {
    name: 'folder_to_llm_defaults',
    description: 'Describe FolderToLLM Context Packager capabilities, safety defaults, limitations, and suggested use without scanning files.',
    parameters: { type: 'object', properties: {} },
    execute: async () => neutralizeDeep({
      name,
      version: '0.2.1-rc.2',
      runtime: 'DeepSeek Harness (DSH)',
      tool: 'folder_to_llm_pack',
      defaults: {
        maxFileSizeBytes: 1048576,
        maxTotalChars: 150000,
        useGitignore: true,
        excludedDirectoryNames: ['node_modules', '.git', 'dist', 'build', '.venv', 'venv', '__pycache__', '.cache'],
        skipsSymlinks: true,
        skipsKnownSensitiveNames: true,
        skipsBinaryContent: true,
      },
      limitations: [
        'DSH must have host-level filesystem access to the requested rootPath; this plugin does not grant new OS permissions.',
        '.gitignore parsing is best-effort and not a full implementation of Git ignore semantics.',
        'Secret detection is filename-based plus binary detection; review snapshots manually before sharing.',
        'The default excludes sensitive filenames and many common binary/build artifacts; add project-specific exclusions when needed.',
      ],
      suggestedPrompt: 'Create a context snapshot of ./src, include only .ts and .md files, exclude tests/fixtures, and keep it under 80000 characters.',
    }),
  })
}

export { createContextPack, neutralizeDeep }
