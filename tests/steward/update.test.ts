import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSkillSteward } from '../../src/steward/index.ts'
import { memoryArchives, memoryDirectory, packTarGz, skillMarkdown } from '../helpers.ts'

async function tempSkillsRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'dsh-skills-'))
}

describe('check and update', () => {
  it('reports up-to-date when the remote bundle hash matches the local skill', async () => {
    const skillsRoot = await tempSkillsRoot()
    const tarball = await packTarGz({
      'grilling/SKILL.md': skillMarkdown('grilling', 'same'),
    })
    const steward = createSkillSteward({
      skillsRoot,
      directory: memoryDirectory(),
      archives: memoryArchives({ tarballs: { 'mattpocock/skills': tarball } }),
    })
    await steward.install('mattpocock/skills/grilling')

    await expect(steward.checkUpdate('mattpocock/skills/grilling')).resolves.toEqual({ kind: 'up-to-date' })
  })

  it('reports update-available when the remote bundle hash differs', async () => {
    const skillsRoot = await tempSkillsRoot()
    const first = await packTarGz({
      'grilling/SKILL.md': skillMarkdown('grilling', 'first'),
    })
    const archives = memoryArchives({ tarballs: { 'mattpocock/skills': first } })
    const steward = createSkillSteward({
      skillsRoot,
      directory: memoryDirectory(),
      archives,
    })
    await steward.install('mattpocock/skills/grilling')
    const second = await packTarGz({
      'grilling/SKILL.md': skillMarkdown('grilling', 'second'),
    })
    archives.tarballs['mattpocock/skills'] = second

    const result = await steward.checkUpdate('mattpocock/skills/grilling')
    expect(result.kind).toBe('update-available')
    if (result.kind !== 'update-available') return
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('requires confirmation before updating, and cancel leaves the previous bundle', async () => {
    const skillsRoot = await tempSkillsRoot()
    const first = await packTarGz({
      'grilling/SKILL.md': skillMarkdown('grilling', 'first'),
    })
    const archives = memoryArchives({ tarballs: { 'mattpocock/skills': first } })
    const steward = createSkillSteward({
      skillsRoot,
      directory: memoryDirectory(),
      archives,
    })
    await steward.install('mattpocock/skills/grilling')
    archives.tarballs['mattpocock/skills'] = await packTarGz({
      'grilling/SKILL.md': skillMarkdown('grilling', 'second'),
    })

    await expect(steward.update('mattpocock/skills/grilling')).resolves.toEqual({ kind: 'needs-confirmation' })
    expect(await readFile(path.join(skillsRoot, 'grilling', 'SKILL.md'), 'utf8')).toContain('first')

    await expect(steward.update('mattpocock/skills/grilling', { confirmed: true })).resolves.toEqual({ kind: 'updated' })
    expect(await readFile(path.join(skillsRoot, 'grilling', 'SKILL.md'), 'utf8')).toContain('second')
    const listed = await steward.listLocal()
    expect(listed[0]?.sourceStatus).toBe('ok')
  })

  it('rolls the directory and ledger back when the update write fails', async () => {
    const skillsRoot = await tempSkillsRoot()
    const first = await packTarGz({
      'grilling/SKILL.md': skillMarkdown('grilling', 'first'),
    })
    const archives = memoryArchives({ tarballs: { 'mattpocock/skills': first } })
    const steward = createSkillSteward({
      skillsRoot,
      directory: memoryDirectory(),
      archives,
    })
    await steward.install('mattpocock/skills/grilling')
    const previous = await readFile(path.join(skillsRoot, 'grilling', 'SKILL.md'), 'utf8')
    const previousHash = (await steward.listLocal())[0]?.contentHash

    archives.tarballs['mattpocock/skills'] = await packTarGz({
      'grilling/SKILL.md': skillMarkdown('grilling', 'second'),
    })
    const { chmod } = await import('node:fs/promises')
    await chmod(skillsRoot, 0o555)
    try {
      await expect(steward.update('mattpocock/skills/grilling', { confirmed: true })).resolves.toEqual({
        kind: 'rolled-back',
      })
    } finally {
      await chmod(skillsRoot, 0o755)
    }

    expect(await readFile(path.join(skillsRoot, 'grilling', 'SKILL.md'), 'utf8')).toBe(previous)
    expect((await steward.listLocal())[0]?.contentHash).toBe(previousHash)
  })

  it('marks a 404 as source-gone: local files stay and update is unavailable', async () => {
    const skillsRoot = await tempSkillsRoot()
    const tarball = await packTarGz({
      'grilling/SKILL.md': skillMarkdown('grilling'),
    })
    const archives = memoryArchives({ tarballs: { 'mattpocock/skills': tarball } })
    const steward = createSkillSteward({
      skillsRoot,
      directory: memoryDirectory(),
      archives,
    })
    await steward.install('mattpocock/skills/grilling')
    archives.fail['mattpocock/skills'] = 'source-gone'

    await expect(steward.checkUpdate('mattpocock/skills/grilling')).resolves.toEqual({ kind: 'source-gone' })
    expect(await steward.listLocal()).toEqual([
      expect.objectContaining({
        identity: 'mattpocock/skills/grilling',
        sourceStatus: 'gone',
      }),
    ])
    expect(await readFile(path.join(skillsRoot, 'grilling', 'SKILL.md'), 'utf8')).toContain('name: grilling')

    await expect(steward.update('mattpocock/skills/grilling', { confirmed: true })).resolves.toEqual({
      kind: 'source-gone',
    })
    expect(await readFile(path.join(skillsRoot, 'grilling', 'SKILL.md'), 'utf8')).toContain('name: grilling')
  })

  it('treats a temporary network failure as retryable, not source-gone', async () => {
    const skillsRoot = await tempSkillsRoot()
    const tarball = await packTarGz({
      'grilling/SKILL.md': skillMarkdown('grilling'),
    })
    const archives = memoryArchives({ tarballs: { 'mattpocock/skills': tarball } })
    const steward = createSkillSteward({
      skillsRoot,
      directory: memoryDirectory(),
      archives,
    })
    await steward.install('mattpocock/skills/grilling')
    archives.fail['mattpocock/skills'] = 'network-failure'

    await expect(steward.checkUpdate('mattpocock/skills/grilling')).resolves.toEqual({ kind: 'network-failure' })
    expect((await steward.listLocal())[0]?.sourceStatus).toBe('ok')

    delete archives.fail['mattpocock/skills']
    await expect(steward.checkUpdate('mattpocock/skills/grilling')).resolves.toEqual({ kind: 'up-to-date' })
  })

  it('does not check updates for a skill that is not local', async () => {
    const steward = createSkillSteward({
      skillsRoot: await tempSkillsRoot(),
      directory: memoryDirectory(),
      archives: memoryArchives(),
    })
    await expect(steward.checkUpdate('mattpocock/skills/grilling')).resolves.toEqual({ kind: 'not-managed' })
  })
})
