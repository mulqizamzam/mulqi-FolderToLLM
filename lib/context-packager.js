import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, relative, resolve, sep } from 'node:path'

const DEFAULT_EXCLUDED_DIRS = new Set([
  '.git', '.hg', '.svn', '.venv', 'venv', 'node_modules', 'dist', 'build',
  '.cache', '__pycache__', '.pytest_cache', '.next', '.svelte-kit', 'coverage',
])
const DEFAULT_EXCLUDED_EXTS = new Set([
  '.env', '.log', '.tmp', '.temp', '.bak', '.cache', '.pyc', '.pyo', '.class',
  '.jar', '.so', '.o', '.a', '.lib', '.obj', '.pdb', '.zip', '.gz', '.tar',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.pdf', '.doc', '.docx',
  '.xls', '.xlsx', '.ppt', '.pptx', '.mp3', '.mp4', '.mov', '.sqlite', '.db',
  '.woff', '.woff2', '.ttf', '.otf', '.exe', '.dll', '.bin', '.wasm',
])
const SENSITIVE_NAMES = new Set(['.env', '.env.local', '.env.production', 'id_rsa', 'id_ed25519', 'credentials.json'])
const DEFAULT_MAX_FILE_BYTES = 1024 * 1024
const DEFAULT_MAX_TOTAL_CHARS = 150_000
const MAX_GITIGNORE_BYTES = 256 * 1024
const MAX_TREE_ENTRIES = 100_000

function normalizedList(values, fallback = []) {
  const list = Array.isArray(values) ? values : fallback
  return list.map((x) => String(x).trim()).filter(Boolean)
}
function cleanGlobExt(value) {
  const ext = String(value).trim().toLowerCase().replace(/^\*/, '')
  return ext.startsWith('.') ? ext : `.${ext}`
}
function isWithin(root, target) {
  const rel = relative(root, target)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(rel))
}
function globToRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0000/g, '.*')
  return new RegExp(`^${escaped}$`)
}
function parseGitignore(raw) {
  const lines = raw.split(/\r?\n/)
  const rules = []
  for (const original of lines) {
    let pattern = original.trim()
    if (!pattern || pattern.startsWith('#')) continue
    const negated = pattern.startsWith('!')
    if (negated) pattern = pattern.slice(1)
    pattern = pattern.replace(/\\([ #!])/g, '$1')
    if (!pattern) continue
    const directoryOnly = pattern.endsWith('/')
    pattern = pattern.replace(/^\//, '').replace(/\/$/, '')
    const hasSlash = pattern.includes('/')
    rules.push({ pattern, negated, directoryOnly, hasSlash, regex: globToRegex(pattern) })
  }
  return rules
}
function matchesGitignore(relPath, isDirectory, rules) {
  const normalized = relPath.split(sep).join('/')
  let ignored = false
  for (const rule of rules) {
    if (rule.directoryOnly && !isDirectory) {
      const segments = normalized.split('/')
      if (segments.slice(0, -1).some((_, i) => rule.regex.test(segments.slice(0, i + 1).join('/')))) ignored = !rule.negated
      continue
    }
    const candidates = rule.hasSlash ? [normalized, ...normalized.split('/').map((_, i, arr) => arr.slice(0, i + 1).join('/'))] : normalized.split('/')
    if (candidates.some((candidate) => rule.regex.test(candidate))) ignored = !rule.negated
  }
  return ignored
}
function looksBinary(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192))
  if (sample.includes(0)) return true
  let suspicious = 0
  for (const b of sample) if ((b < 7 || (b > 13 && b < 32)) && b !== 9) suspicious++
  return sample.length > 0 && suspicious / sample.length > 0.02
}
function safeJson(value) {
  return JSON.parse(JSON.stringify(value, (_key, v) => {
    if (typeof v === 'number' && !Number.isFinite(v)) return null
    if (typeof v === 'string') return v.replace(/\{\{/g, '{').replace(/\}\}/g, '}')
    return v
  }))
}

export async function createContextPack(options = {}) {
  const rootInput = typeof options.rootPath === 'string' && options.rootPath.trim() ? options.rootPath : '.'
  const root = resolve(rootInput)
  const rootStat = await stat(root)
  if (!rootStat.isDirectory()) throw new Error(`rootPath must be a directory: ${root}`)

  const maxFileBytes = Number.isFinite(options.maxFileSizeBytes) && options.maxFileSizeBytes >= 0
    ? Math.floor(options.maxFileSizeBytes) : DEFAULT_MAX_FILE_BYTES
  const maxTotalChars = Number.isFinite(options.maxTotalChars) && options.maxTotalChars >= 0
    ? Math.floor(options.maxTotalChars) : DEFAULT_MAX_TOTAL_CHARS
  const maxTreeEntries = Number.isFinite(options.maxEntries) && options.maxEntries > 0
    ? Math.min(Math.floor(options.maxEntries), MAX_TREE_ENTRIES) : MAX_TREE_ENTRIES
  const excludeDirs = new Set([...DEFAULT_EXCLUDED_DIRS, ...normalizedList(options.excludeFolders).map((x) => x.replace(/[\\/]$/, ''))])
  const excludeExts = new Set([...DEFAULT_EXCLUDED_EXTS, ...normalizedList(options.excludeExtensions).map(cleanGlobExt)])
  const includeExts = new Set(normalizedList(options.includeExtensions).map(cleanGlobExt))
  const includeFolders = normalizedList(options.includeFolders).map((p) => resolve(root, p))
  const excludePaths = normalizedList(options.excludePaths).map((p) => resolve(root, p))
  if ([...includeFolders, ...excludePaths].some((p) => !isWithin(root, p))) throw new Error('includeFolders/excludePaths must stay inside rootPath')

  let gitignoreRules = []
  if (options.useGitignore !== false) {
    try {
      const gitignorePath = resolve(root, '.gitignore')
      const size = (await stat(gitignorePath)).size
      if (size <= MAX_GITIGNORE_BYTES) gitignoreRules = parseGitignore(await readFile(gitignorePath, 'utf8'))
    } catch { /* .gitignore is optional */ }
  }

  const treeLines = ['.']
  const files = []
  const skipped = { excludedDirectory: 0, excludedFile: 0, tooLarge: 0, binary: 0, unreadable: 0, sensitive: 0, outsideInclude: 0, gitignored: 0 }
  let visited = 0

  async function walk(directory, prefix = '') {
    let entries
    try { entries = await readdir(directory, { withFileTypes: true }) }
    catch { skipped.unreadable++; return }
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))
    const visible = []
    for (const entry of entries) {
      const absolute = resolve(directory, entry.name)
      const rel = relative(root, absolute)
      if (!isWithin(root, absolute)) continue
      if (entry.isSymbolicLink()) { skipped.excludedFile++; continue }
      const isDir = entry.isDirectory()
      if (isDir && excludeDirs.has(entry.name)) { skipped.excludedDirectory++; continue }
      if (excludePaths.some((p) => absolute === p || absolute.startsWith(`${p}${sep}`))) { skipped.excludedFile++; continue }
      if (matchesGitignore(rel, isDir, gitignoreRules)) { skipped.gitignored++; continue }
      if (!isDir) {
        const baseName = entry.name.toLowerCase()
        const ext = extname(entry.name).toLowerCase()
        if (SENSITIVE_NAMES.has(baseName) || baseName.startsWith('.env.')) { skipped.sensitive++; continue }
        if (excludeExts.has(ext) || excludeExts.has(baseName)) { skipped.excludedFile++; continue }
        if (includeExts.size && !includeExts.has(ext)) { skipped.excludedFile++; continue }
        if (includeFolders.length && !includeFolders.some((folder) => absolute === folder || absolute.startsWith(`${folder}${sep}`))) { skipped.outsideInclude++; continue }
        try {
          const itemStat = await stat(absolute)
          if (!itemStat.isFile()) { skipped.excludedFile++; continue }
          if (itemStat.size > maxFileBytes) { skipped.tooLarge++; continue }
          visible.push({ entry, absolute, rel, isDir: false, size: itemStat.size })
        } catch { skipped.unreadable++; continue }
      } else {
        if (includeFolders.length && !includeFolders.some((folder) => folder === absolute || folder.startsWith(`${absolute}${sep}`) || absolute.startsWith(`${folder}${sep}`))) continue
        visible.push({ entry, absolute, rel, isDir: true })
      }
    }
    for (let i = 0; i < visible.length; i++) {
      if (++visited > maxTreeEntries) throw new Error(`Directory tree entry limit exceeded (${maxTreeEntries}); narrow the scope`)
      const item = visible[i]
      const last = i === visible.length - 1
      treeLines.push(`${prefix}${last ? '└── ' : '├── '}${item.entry.name}${item.isDir ? '/' : ''}`)
      if (item.isDir) {
        await walk(item.absolute, prefix + (last ? '    ' : '│   '))
      } else files.push(item)
    }
  }
  await walk(root)

  const tree = `DIRECTORY TREE\n${treeLines.join('\n')}`
  const fileHeader = '\n\nFILE CONTENTS'
  const treeBudget = Math.min(tree.length, maxTotalChars)
  const treeWithinBudget = tree.slice(0, treeBudget)
  const headerWithinBudget = tree.length + fileHeader.length <= maxTotalChars ? fileHeader : ''
  let remaining = Math.max(0, maxTotalChars - treeWithinBudget.length - headerWithinBudget.length)
  const blocks = []
  let included = 0
  let truncatedForBudget = tree.length > treeBudget
  for (const file of files) {
    if (remaining <= 0) { skipped.tooLarge++; continue }
    try {
      const buffer = await readFile(file.absolute)
      if (looksBinary(buffer)) { skipped.binary++; continue }
      const text = buffer.toString('utf8').replace(/^\uFEFF/, '')
      const normalized = text.replace(/\r\n/g, '\n')
      const prefix = `\n\n===== FILE: ${file.rel.split(sep).join('/')} (${file.size} bytes) =====\n`
      if (remaining <= prefix.length) { skipped.tooLarge++; continue }
      const available = remaining - prefix.length
      const truncated = normalized.length > available
      const truncationMarker = '\n[TRUNCATED]'
      const body = truncated
        ? (available > truncationMarker.length ? normalized.slice(0, available - truncationMarker.length) + truncationMarker : normalized.slice(0, available))
        : normalized
      const block = prefix + body
      if (block.length > remaining) throw new Error('internal budget accounting error')
      blocks.push(block)
      remaining -= block.length
      included++
      if (truncated) {
        truncatedForBudget = true
        remaining = 0
      }
    } catch (error) {
      if (error?.message === 'internal budget accounting error') throw error
      skipped.unreadable++
    }
  }
  const content = `${treeWithinBudget}${headerWithinBudget}${blocks.join('')}`

  return safeJson({
    ok: true,
    rootPath: root,
    summary: { entriesVisited: visited, candidateFiles: files.length, includedFiles: included, outputChars: content.length, maxFileSizeBytes: maxFileBytes, maxTotalChars, truncated: truncatedForBudget || Object.values(skipped).some((v) => v > 0) },
    skipped,
    content,
    files: files.map((f) => ({ path: f.rel.split(sep).join('/'), sizeBytes: f.size })),
    warnings: [
      'Review the generated snapshot before sharing it. Exclusions reduce accidental disclosure but do not guarantee secrets are absent.',
      'Symlinks are skipped; .gitignore support is intentionally best-effort and is not a full Git implementation.',
    ],
  })
}
