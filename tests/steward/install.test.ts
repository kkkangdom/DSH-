import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSkillSteward } from '../../src/steward/index.ts'
import {
  grillingHit,
  memoryArchives,
  memoryDirectory,
  mintlifyHit,
  packTarGz,
  skillMarkdown,
} from '../helpers.ts'

async function tempSkillsRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'dsh-skills-'))
}

async function fileTree(root: string): Promise<string[]> {
  const names: string[] = []
  async function walk(dir: string, prefix: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`
      if (entry.isDirectory()) {
        names.push(rel + '/')
        await walk(path.join(dir, entry.name), rel)
      } else {
        names.push(rel)
      }
    }
  }
  await walk(root, '')
  return names
}

describe('install', () => {
  it('writes only the matching skill bundle into the slug folder and lists it as a local skill', async () => {
    const skillsRoot = await tempSkillsRoot()
    const tarball = await packTarGz({
      'grilling/SKILL.md': skillMarkdown('grilling'),
      'grilling/scripts/run.sh': 'echo grill',
      'tdd/SKILL.md': skillMarkdown('tdd'),
      'tdd/README.md': 'not this one',
    })
    const steward = createSkillSteward({
      skillsRoot,
      directory: memoryDirectory({ hits: [grillingHit] }),
      archives: memoryArchives({ tarballs: { 'mattpocock/skills': tarball } }),
    })

    await expect(steward.install('mattpocock/skills/grilling')).resolves.toEqual({
      kind: 'installed',
      identity: 'mattpocock/skills/grilling',
      slug: 'grilling',
    })

    const listed = await steward.listLocal()
    expect(listed).toEqual([
      expect.objectContaining({
        identity: 'mattpocock/skills/grilling',
        slug: 'grilling',
        source: 'mattpocock/skills',
        sourceStatus: 'ok',
      }),
    ])
    expect(listed[0]?.contentHash).toMatch(/^[0-9a-f]{64}$/)

    const dest = path.join(skillsRoot, 'grilling')
    expect(await readFile(path.join(dest, 'SKILL.md'), 'utf8')).toContain('name: grilling')
    expect(await readFile(path.join(dest, 'scripts/run.sh'), 'utf8')).toBe('echo grill')
    const tree = await fileTree(skillsRoot)
    expect(tree.filter(name => name.startsWith('tdd'))).toEqual([])
    expect(tree.some(name => name.includes('tdd'))).toBe(false)
  })

  it('matches a repo-root SKILL.md by frontmatter name', async () => {
    const skillsRoot = await tempSkillsRoot()
    const tarball = await packTarGz({
      'SKILL.md': skillMarkdown('grilling'),
      'references/notes.md': 'notes',
    })
    const steward = createSkillSteward({
      skillsRoot,
      directory: memoryDirectory(),
      archives: memoryArchives({ tarballs: { 'mattpocock/skills': tarball } }),
    })

    await expect(steward.install('mattpocock/skills/grilling')).resolves.toEqual({
      kind: 'installed',
      identity: 'mattpocock/skills/grilling',
      slug: 'grilling',
    })
    expect(await readFile(path.join(skillsRoot, 'grilling', 'SKILL.md'), 'utf8')).toContain('name: grilling')
    expect(await readFile(path.join(skillsRoot, 'grilling', 'references/notes.md'), 'utf8')).toBe('notes')
  })

  it('fails without writing when no SKILL.md matches the slug', async () => {
    const skillsRoot = await tempSkillsRoot()
    const tarball = await packTarGz({
      'tdd/SKILL.md': skillMarkdown('tdd'),
    })
    const steward = createSkillSteward({
      skillsRoot,
      directory: memoryDirectory(),
      archives: memoryArchives({ tarballs: { 'mattpocock/skills': tarball } }),
    })

    await expect(steward.install('mattpocock/skills/grilling')).resolves.toEqual({ kind: 'no-match' })
    expect(await steward.listLocal()).toEqual([])
    expect(await fileTree(skillsRoot)).toEqual([])
  })

  it('fails without writing when more than one bundle matches the slug', async () => {
    const skillsRoot = await tempSkillsRoot()
    const tarball = await packTarGz({
      'grilling/SKILL.md': skillMarkdown('grilling'),
      'other/SKILL.md': skillMarkdown('grilling'),
    })
    const steward = createSkillSteward({
      skillsRoot,
      directory: memoryDirectory(),
      archives: memoryArchives({ tarballs: { 'mattpocock/skills': tarball } }),
    })

    await expect(steward.install('mattpocock/skills/grilling')).resolves.toEqual({ kind: 'not-unique' })
    expect(await steward.listLocal()).toEqual([])
    expect(await fileTree(skillsRoot)).toEqual([])
  })

  it('refuses unsupported sources without downloading an archive', async () => {
    let downloaded = false
    const steward = createSkillSteward({
      skillsRoot: await tempSkillsRoot(),
      directory: memoryDirectory({ hits: [mintlifyHit] }),
      archives: {
        async download() {
          downloaded = true
          return { ok: false, reason: 'source-gone' }
        },
      },
    })

    await expect(steward.install('mintlify.com/mintlify')).resolves.toEqual({ kind: 'unsupported-source' })
    expect(downloaded).toBe(false)
    expect(await steward.listLocal()).toEqual([])
  })

  it('asks for confirmation when the slug folder already exists, and cancel leaves disk and ledger unchanged', async () => {
    const skillsRoot = await tempSkillsRoot()
    const dest = path.join(skillsRoot, 'grilling')
    await mkdir(dest, { recursive: true })
    await writeFile(path.join(dest, 'SKILL.md'), skillMarkdown('local-copy'))
    const tarball = await packTarGz({
      'grilling/SKILL.md': skillMarkdown('grilling', 'from archive'),
    })
    const steward = createSkillSteward({
      skillsRoot,
      directory: memoryDirectory(),
      archives: memoryArchives({ tarballs: { 'mattpocock/skills': tarball } }),
    })

    await expect(steward.install('mattpocock/skills/grilling')).resolves.toEqual({
      kind: 'needs-confirmation',
      coveringForeign: true,
    })
    expect(await readFile(path.join(dest, 'SKILL.md'), 'utf8')).toContain('name: local-copy')
    expect(await steward.listLocal()).toEqual([])
  })

  it('covers a foreign skill after confirmation and then lists it as a local skill', async () => {
    const skillsRoot = await tempSkillsRoot()
    const dest = path.join(skillsRoot, 'grilling')
    await mkdir(dest, { recursive: true })
    await writeFile(path.join(dest, 'SKILL.md'), skillMarkdown('local-copy'))
    const tarball = await packTarGz({
      'grilling/SKILL.md': skillMarkdown('grilling', 'from archive'),
    })
    const steward = createSkillSteward({
      skillsRoot,
      directory: memoryDirectory(),
      archives: memoryArchives({ tarballs: { 'mattpocock/skills': tarball } }),
    })

    await expect(steward.install('mattpocock/skills/grilling', { confirmed: true })).resolves.toEqual({
      kind: 'installed',
      identity: 'mattpocock/skills/grilling',
      slug: 'grilling',
    })
    expect(await readFile(path.join(dest, 'SKILL.md'), 'utf8')).toContain('from archive')
    expect(await steward.listLocal()).toEqual([
      expect.objectContaining({
        identity: 'mattpocock/skills/grilling',
        slug: 'grilling',
      }),
    ])
  })

  it('asks for confirmation again when reinstalling a local skill, and cancel keeps the previous bundle', async () => {
    const skillsRoot = await tempSkillsRoot()
    const first = await packTarGz({
      'grilling/SKILL.md': skillMarkdown('grilling', 'first'),
    })
    const second = await packTarGz({
      'grilling/SKILL.md': skillMarkdown('grilling', 'second'),
    })
    const archives = memoryArchives({ tarballs: { 'mattpocock/skills': first } })
    const steward = createSkillSteward({
      skillsRoot,
      directory: memoryDirectory(),
      archives,
    })
    await steward.install('mattpocock/skills/grilling')

    archives.tarballs['mattpocock/skills'] = second
    await expect(steward.install('mattpocock/skills/grilling')).resolves.toEqual({
      kind: 'needs-confirmation',
      coveringForeign: false,
    })
    expect(await readFile(path.join(skillsRoot, 'grilling', 'SKILL.md'), 'utf8')).toContain('first')

    await expect(steward.install('mattpocock/skills/grilling', { confirmed: true })).resolves.toEqual({
      kind: 'installed',
      identity: 'mattpocock/skills/grilling',
      slug: 'grilling',
    })
    expect(await readFile(path.join(skillsRoot, 'grilling', 'SKILL.md'), 'utf8')).toContain('second')
  })

  it('returns source-gone when the archive is missing, without writing', async () => {
    const skillsRoot = await tempSkillsRoot()
    const steward = createSkillSteward({
      skillsRoot,
      directory: memoryDirectory(),
      archives: memoryArchives({ fail: { 'mattpocock/skills': 'source-gone' } }),
    })
    await expect(steward.install('mattpocock/skills/grilling')).resolves.toEqual({ kind: 'source-gone' })
    expect(await fileTree(skillsRoot)).toEqual([])
  })

  it('returns network-failure when the archive cannot be reached, without writing', async () => {
    const skillsRoot = await tempSkillsRoot()
    const steward = createSkillSteward({
      skillsRoot,
      directory: memoryDirectory(),
      archives: memoryArchives({ fail: { 'mattpocock/skills': 'network-failure' } }),
    })
    await expect(steward.install('mattpocock/skills/grilling')).resolves.toEqual({ kind: 'network-failure' })
    expect(await fileTree(skillsRoot)).toEqual([])
  })
})

describe('path safety', () => {
  it('rejects a slug that would write outside the skills directory', async () => {
    const skillsRoot = await tempSkillsRoot()
    const steward = createSkillSteward({
      skillsRoot,
      directory: memoryDirectory(),
      archives: memoryArchives({ tarballs: { 'evil/repo': await packTarGz({ 'SKILL.md': skillMarkdown('..') }) } }),
    })
    await expect(steward.install('evil/repo/..')).resolves.toEqual({ kind: 'path-unsafe' })
    expect(await fileTree(skillsRoot)).toEqual([])
  })

  it('rejects an archive whose files would escape the destination, without writing', async () => {
    const skillsRoot = await tempSkillsRoot()
    const tarball = await packTarGz(
      { 'grilling/SKILL.md': skillMarkdown('grilling') },
      { extra: [{ name: 'repo-HEAD/grilling/../../outside.txt', content: 'escaped' }] },
    )
    const steward = createSkillSteward({
      skillsRoot,
      directory: memoryDirectory(),
      archives: memoryArchives({ tarballs: { 'mattpocock/skills': tarball } }),
    })

    await expect(steward.install('mattpocock/skills/grilling')).resolves.toEqual({ kind: 'path-unsafe' })
    expect(await fileTree(skillsRoot)).toEqual([])
    const parent = await readdir(path.dirname(skillsRoot))
    expect(parent).not.toContain('outside.txt')
  })

  it('rejects a symlink that points outside the destination, without writing', async () => {
    const skillsRoot = await tempSkillsRoot()
    const tarball = await packTarGz(
      { 'grilling/SKILL.md': skillMarkdown('grilling') },
      { extra: [{ name: 'repo-HEAD/grilling/link', type: 'symlink', linkname: '../../outside' }] },
    )
    const steward = createSkillSteward({
      skillsRoot,
      directory: memoryDirectory(),
      archives: memoryArchives({ tarballs: { 'mattpocock/skills': tarball } }),
    })

    await expect(steward.install('mattpocock/skills/grilling')).resolves.toEqual({ kind: 'path-unsafe' })
    expect(await fileTree(skillsRoot)).toEqual([])
  })
})
