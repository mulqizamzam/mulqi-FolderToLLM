import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createContextPack } from '../lib/context-packager.js'

async function fixture(fn) {
  const root = await mkdtemp(join(tmpdir(), 'folder-to-llm-'))
  try { await fn(root) } finally { await rm(root, { recursive: true, force: true }) }
}

test('collects useful text and emits tree, stats, and stable content', async () => fixture(async (root) => {
  await mkdir(join(root, 'src'))
  await writeFile(join(root, 'README.md'), '# Demo\nhello')
  await writeFile(join(root, 'src', 'index.js'), 'export const x = 1\n')
  const first = await createContextPack({ rootPath: root })
  const second = await createContextPack({ rootPath: root })
  assert.equal(first.ok, true)
  assert.match(first.content, /DIRECTORY TREE/)
  assert.match(first.content, /FILE: README.md/)
  assert.equal(first.content, second.content)
  assert.equal(first.summary.includedFiles, 2)
}))

test('skips sensitive names, binary files, ignored files, and large files', async () => fixture(async (root) => {
  await writeFile(join(root, '.gitignore'), 'ignored.txt\n')
  await writeFile(join(root, '.env'), 'API_KEY=secret')
  await writeFile(join(root, 'ignored.txt'), 'ignore me')
  await writeFile(join(root, 'app.js'), 'x'.repeat(100))
  await writeFile(join(root, 'huge.txt'), 'x'.repeat(300))
  await writeFile(join(root, 'blob.dat'), Buffer.from([0, 1, 2, 3]))
  const result = await createContextPack({ rootPath: root, maxFileSizeBytes: 200 })
  assert.ok(result.skipped.sensitive >= 1)
  assert.ok(result.skipped.gitignored >= 1)
  assert.ok(result.skipped.tooLarge >= 1)
  assert.ok(!result.content.includes('API_KEY=secret'))
  assert.ok(!result.content.includes('ignore me'))
}))

test('supports extension/folder filters and total output budget', async () => fixture(async (root) => {
  await mkdir(join(root, 'src'))
  await mkdir(join(root, 'docs'))
  await writeFile(join(root, 'src', 'main.ts'), 't'.repeat(800))
  await writeFile(join(root, 'src', 'note.md'), 'markdown')
  await writeFile(join(root, 'docs', 'guide.md'), 'document')
  const result = await createContextPack({ rootPath: root, includeFolders: ['src'], includeExtensions: ['.ts'], maxTotalChars: 200 })
  assert.ok(result.summary.outputChars <= 200)
  assert.ok(result.content.includes('main.ts'))
  assert.ok(!result.content.includes('guide.md'))
}))

test('rejects include paths that escape the root', async () => fixture(async (root) => {
  await assert.rejects(createContextPack({ rootPath: root, includeFolders: ['../outside'] }), /must stay inside rootPath/)
}))

test('skips symlinks rather than following them', async () => fixture(async (root) => {
  const elsewhere = join(root, '..', 'not-in-root-secret.txt')
  await writeFile(elsewhere, 'secret')
  try {
    await symlink(elsewhere, join(root, 'leak.txt'))
    const result = await createContextPack({ rootPath: root })
    assert.ok(!result.content.includes('secret'))
  } finally { await rm(elsewhere, { force: true }) }
}))

test('respects the exact total character budget including the directory tree', async () => fixture(async (root) => {
  await mkdir(join(root, 'a', 'b'), { recursive: true })
  await writeFile(join(root, 'a', 'b', 'deep.md'), 'x'.repeat(500))
  const result = await createContextPack({ rootPath: root, maxTotalChars: 80, useGitignore: false })
  assert.ok(result.summary.outputChars <= 80)
  assert.equal(result.summary.outputChars, result.content.length)
  assert.equal(result.summary.truncated, true)
}))

test('packaged lib entry point can execute without source files', async () => {
  const module = await import('../lib/index.js')
  assert.equal(module.name, 'mulqi-folder-to-llm')
  assert.equal(typeof module.apply, 'function')
  assert.equal(typeof module.createContextPack, 'function')
})
