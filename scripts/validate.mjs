import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const required = [
  'package.json', 'cordis.patch.yml', 'README.md', 'LICENSE',
  'lib/index.js', 'lib/context-packager.js',
  'skills/folder-to-llm-context/SKILL.md',
  'assets/logo-light.svg', 'assets/logo-dark.svg', 'assets/icon.svg'
]
const errors = []
for (const relative of required) {
  try {
    const stat = await fs.lstat(path.join(root, relative))
    if (!stat.isFile() || stat.isSymbolicLink()) errors.push(relative + ' is not a regular file')
  } catch { errors.push(relative + ' is missing') }
}
const manifest = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))
if (manifest.name !== 'mulqi-folder-to-llm') errors.push('package name does not match registry id')
if (!manifest.dsh?.bundle?.patch) errors.push('dsh.bundle.patch is missing')
const patch = await fs.readFile(path.join(root, 'cordis.patch.yml'), 'utf8')
if (!patch.includes('id: mulqi-folder-to-llm')) errors.push('registry id does not match package')
const entry = await fs.readFile(path.join(root, 'lib/index.js'), 'utf8')
for (const tool of ['folder_to_llm_pack', 'folder_to_llm_defaults']) {
  if (!entry.includes(tool)) errors.push('missing tool registration: ' + tool)
}
const skill = await fs.readFile(path.join(root, 'skills/folder-to-llm-context/SKILL.md'), 'utf8')
if (!skill.startsWith('---\n') || !skill.includes('name: folder-to-llm-context') || !skill.includes('description:')) errors.push('Skill frontmatter missing required fields')
for (const relative of ['assets/logo-light.svg','assets/logo-dark.svg','assets/icon.svg']) {
  const svg = await fs.readFile(path.join(root, relative), 'utf8')
  if (!/<svg\b[^>]*\bviewBox="0 0 128 128"/.test(svg)) errors.push(relative + ' missing square viewBox')
}
if (errors.length) {
  console.error(JSON.stringify({ valid: false, errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({ valid: true, package: manifest.name, version: manifest.version, checkedFiles: required.length }, null, 2))
}
