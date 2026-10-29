import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { packContext, getDefaults } from '../lib/context-packager.js'

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'folder-to-llm-'))
  await fs.mkdir(path.join(root, 'src'))
  await fs.mkdir(path.join(root, 'node_modules'))
  await fs.writeFile(path.join(root, 'src', 'hello.js'), 'export const hello = "world"\n')
  await fs.writeFile(path.join(root, 'src', 'notes.md'), '# Notes\n')
  await fs.writeFile(path.join(root, 'secrets.env'), 'TOKEN=not-for-output')
  await fs.writeFile(path.join(root, 'node_modules', 'dependency.js'), 'should not appear')
  await fs.writeFile(path.join(root, '.gitignore'), 'ignored.txt\n')
  await fs.writeFile(path.join(root, 'ignored.txt'), 'ignored by rule')
  return root
}

test('defaults keep bounded and conservative filters', () => {
  const defaults = getDefaults()
  assert.ok(defaults.maxFiles > 0)
  assert.ok(defaults.maxOutputChars > 0)
  assert.ok(defaults.excludeFolders.includes('node_modules'))
})

test('packs text files and excludes common sensitive and generated paths', async () => {
  const root = await fixture()
  try {
    const result = await packContext({ root })
    assert.equal(result.ok, true)
    assert.match(result.snapshot, /hello = "world"/)
    assert.doesNotMatch(result.snapshot, /not-for-output/)
    assert.doesNotMatch(result.snapshot, /should not appear/)
    assert.ok(result.skippedFiles.some(x => x.path === 'secrets.env'))
    assert.ok(result.includedFiles.some(x => x.path === 'src/hello.js'))
  } finally { await fs.rm(root, { recursive: true, force: true }) }
})

test('supports an extension allowlist and output budget', async () => {
  const root = await fixture()
  try {
    const result = await packContext({ root, includeExtensions: ['.md'], maxOutputChars: 150 })
    assert.equal(result.ok, true)
    assert.doesNotMatch(result.snapshot, /hello = "world"/)
    assert.ok(result.outputChars <= 150)
  } finally { await fs.rm(root, { recursive: true, force: true }) }
})

test('fails closed for missing root', async () => {
  const result = await packContext({ root: '/this/path/should/not/exist/folder-to-llm' })
  assert.equal(result.ok, false)
})

test('does not follow symbolic links', async () => {
  const root = await fixture()
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'folder-to-llm-outside-'))
  try {
    await fs.writeFile(path.join(outside, 'outside.js'), 'outside content')
    await fs.symlink(outside, path.join(root, 'linked-outside'), 'dir')
    const result = await packContext({ root })
    assert.equal(result.ok, true)
    assert.doesNotMatch(result.snapshot, /outside content/)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
    await fs.rm(outside, { recursive: true, force: true })
  }
})
