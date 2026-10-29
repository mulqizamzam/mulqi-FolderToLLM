import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULTS = {
  excludeFolders: ['.git', 'node_modules', 'dist', 'build', 'coverage', '.venv', 'venv', '__pycache__', '.next', '.cache'],
  excludeExtensions: ['.env', '.log', '.tmp', '.bak', '.zip', '.gz', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.docx', '.xlsx', '.mp4', '.mp3', '.pyc'],
  maxFileBytes: 1024 * 1024,
  maxFiles: 500,
  maxOutputChars: 200000,
  respectGitignore: true
}

export function getDefaults() {
  return JSON.parse(JSON.stringify(DEFAULTS))
}
function normalizeExt(value) {
  const v = String(value ?? '').trim().toLowerCase()
  if (!v) return ''
  return v.startsWith('.') ? v : '.' + v.replace(/^\*+/, '')
}
function within(parent, child) {
  const rel = path.relative(parent, child)
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel))
}
function globRegex(pattern) {
  const escaped = pattern.replace(/[.+^$()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '§§DOUBLESTAR§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§DOUBLESTAR§§/g, '.*')
    .replace(/\?/g, '[^/]')
  return new RegExp('^' + escaped + '$')
}
function parseGitignore(text) {
  return text.split(/\r?\n/).map(s => s.trim())
    .filter(s => s && !s.startsWith('#') && !s.startsWith('!'))
    .map(raw => {
      const dirOnly = raw.endsWith('/')
      const pattern = raw.replace(/^\//, '').replace(/\/$/, '')
      return { raw, pattern, dirOnly, regex: globRegex(pattern) }
    })
}
function ignored(rel, isDir, rules) {
  const posixRel = rel.split(path.sep).join('/')
  return rules.some(rule => {
    if (rule.dirOnly && !isDir && !posixRel.startsWith(rule.pattern + '/')) return false
    const parts = posixRel.split('/')
    return rule.regex.test(posixRel) || parts.some(part => rule.regex.test(part))
  })
}
function isSensitiveName(name) {
  return /(^|[._-])(secret|secrets|credential|credentials|token|private[_-]?key)([._-]|$)/i.test(name)
}
function isLikelyBinary(buffer) {
  return buffer.includes(0)
}
async function walk(root, rel, excludes, rules, respectGitignore, signal, out, limit) {
  if (signal?.aborted) throw new Error('Operation aborted')
  if (out.length >= limit) return
  const dir = path.join(root, rel)
  let entries
  try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
  entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))
  for (const entry of entries) {
    if (out.length >= limit || signal?.aborted) break
    const childRel = rel ? path.join(rel, entry.name) : entry.name
    const childAbs = path.join(root, childRel)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) {
      if (excludes.has(entry.name.toLowerCase()) || (respectGitignore && ignored(childRel, true, rules))) continue
      await walk(root, childRel, excludes, rules, respectGitignore, signal, out, limit)
    } else if (entry.isFile()) {
      if (!(respectGitignore && ignored(childRel, false, rules))) out.push({ rel: childRel, abs: childAbs, name: entry.name })
    }
  }
}
export async function packContext(options = {}, runtime = {}) {
  const rootInput = typeof options.root === 'string' ? options.root.trim() : ''
  if (!rootInput) return { ok: false, error: 'root is required' }
  let root
  try { root = await fs.realpath(rootInput) } catch { return { ok: false, error: 'root does not exist or is not accessible' } }
  const rootStat = await fs.stat(root)
  if (!rootStat.isDirectory()) return { ok: false, error: 'root must be a directory' }

  const maxFileBytes = Number.isSafeInteger(options.maxFileBytes) && options.maxFileBytes >= 0 ? Math.min(options.maxFileBytes, 10 * 1024 * 1024) : DEFAULTS.maxFileBytes
  const maxFiles = Number.isSafeInteger(options.maxFiles) && options.maxFiles > 0 ? Math.min(options.maxFiles, 5000) : DEFAULTS.maxFiles
  const maxOutputChars = Number.isSafeInteger(options.maxOutputChars) && options.maxOutputChars > 0 ? Math.min(options.maxOutputChars, 1000000) : DEFAULTS.maxOutputChars
  const excludes = new Set([...DEFAULTS.excludeFolders, ...(Array.isArray(options.excludeFolders) ? options.excludeFolders : [])].map(s => path.basename(String(s)).toLowerCase()))
  const excludeExts = new Set([...DEFAULTS.excludeExtensions, ...(Array.isArray(options.excludeExtensions) ? options.excludeExtensions : [])].map(normalizeExt))
  const includeExts = new Set((Array.isArray(options.includeExtensions) ? options.includeExtensions : []).map(normalizeExt).filter(Boolean))
  const includeFolders = (Array.isArray(options.includeFolders) ? options.includeFolders : []).map(s => path.resolve(root, String(s))).filter(Boolean)
  const respectGitignore = options.respectGitignore !== false
  let rules = []
  if (respectGitignore) {
    try { rules = parseGitignore(await fs.readFile(path.join(root, '.gitignore'), 'utf8')) } catch {}
  }
  const candidates = []
  await walk(root, '', excludes, rules, respectGitignore, runtime.signal, candidates, maxFiles * 10)
  const included = []
  const skipped = []
  for (const item of candidates) {
    const relNormalized = item.rel.split(path.sep).join('/')
    if (!within(root, item.abs)) { skipped.push({ path: relNormalized, reason: 'outside-root' }); continue }
    if (includeFolders.length && !includeFolders.some(folder => within(folder, item.abs) && within(root, folder))) {
      skipped.push({ path: relNormalized, reason: 'outside-include-folders' }); continue
    }
    const ext = normalizeExt(path.extname(item.name))
    if (excludeExts.has(ext) || isSensitiveName(item.name)) { skipped.push({ path: relNormalized, reason: 'excluded-extension-or-sensitive-name' }); continue }
    if (includeExts.size && !includeExts.has(ext)) { skipped.push({ path: relNormalized, reason: 'extension-not-in-allowlist' }); continue }
    let info
    try { info = await fs.lstat(item.abs) } catch { skipped.push({ path: relNormalized, reason: 'stat-failed' }); continue }
    if (!info.isFile() || info.isSymbolicLink()) { skipped.push({ path: relNormalized, reason: 'not-regular-file' }); continue }
    if (info.size > maxFileBytes) { skipped.push({ path: relNormalized, reason: 'file-too-large', bytes: info.size }); continue }
    included.push({ ...item, relNormalized, bytes: info.size })
    if (included.length >= maxFiles) break
  }
  const tree = candidates.slice(0, maxFiles).map(x => x.rel.split(path.sep).join('/')).join('\n')
  let text = ['# Project Context Snapshot', '', '## File tree', tree, '', '## File contents', ''].join('\n')
  const includedFiles = []
  for (const item of included) {
    if (runtime.signal?.aborted) throw new Error('Operation aborted')
    let buffer
    try { buffer = await fs.readFile(item.abs) } catch { skipped.push({ path: item.relNormalized, reason: 'read-failed' }); continue }
    if (isLikelyBinary(buffer)) { skipped.push({ path: item.relNormalized, reason: 'binary-content' }); continue }
    const content = buffer.toString('utf8')
    if (content.includes('\uFFFD')) { skipped.push({ path: item.relNormalized, reason: 'invalid-utf8-or-binary' }); continue }
    const section = '### ' + item.relNormalized + '\n\n\x60\x60\x60text\n' + content + '\n\x60\x60\x60\n\n'
    if (text.length + section.length > maxOutputChars) {
      skipped.push({ path: item.relNormalized, reason: 'output-limit' })
      continue
    }
    text += section
    includedFiles.push({ path: item.relNormalized, bytes: item.bytes })
  }
  if (text.length > maxOutputChars) text = text.slice(0, maxOutputChars)
  return {
    ok: true,
    root,
    filesDiscovered: candidates.length,
    filesIncluded: includedFiles.length,
    filesSkipped: skipped.length,
    truncatedByScanLimit: candidates.length >= maxFiles * 10,
    outputChars: text.length,
    snapshot: text,
    includedFiles,
    skippedFiles: skipped,
    warnings: ['Review the snapshot and skipped-file list before sharing it.', 'Secret detection is heuristic and cannot guarantee removal of all sensitive data.']
  }
}
