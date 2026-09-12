import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSkillSteward } from '../../src/steward/index.ts'
import { grillingHit, memoryArchives, memoryDirectory, mintlifyHit } from '../helpers.ts'

async function tempSkillsRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'dsh-skills-'))
}

describe('search', () => {
  it('does not request the directory when the keyword is shorter than 2 characters', async () => {
    const searchCalls: string[] = []
    const steward = createSkillSteward({
      skillsRoot: await tempSkillsRoot(),
      directory: memoryDirectory({ hits: [grillingHit], searchCalls }),
      archives: memoryArchives(),
    })

    await expect(steward.search('')).resolves.toEqual({ kind: 'need-keywords' })
    await expect(steward.search('g')).resolves.toEqual({ kind: 'need-keywords' })
    await expect(steward.search(' g ')).resolves.toEqual({ kind: 'need-keywords' })
    expect(searchCalls).toEqual([])
  })

  it('returns empty when the directory has no hits', async () => {
    const steward = createSkillSteward({
      skillsRoot: await tempSkillsRoot(),
      directory: memoryDirectory({ hits: [] }),
      archives: memoryArchives(),
    })

    await expect(steward.search('zz')).resolves.toEqual({ kind: 'empty' })
  })

  it('returns network-failure when the directory cannot be reached', async () => {
    const steward = createSkillSteward({
      skillsRoot: await tempSkillsRoot(),
      directory: memoryDirectory({ fail: 'network-failure' }),
      archives: memoryArchives(),
    })

    await expect(steward.search('grill')).resolves.toEqual({ kind: 'network-failure' })
  })

  it('returns hits with name, source, installs, Skills.sh url, without blocking on descriptions', async () => {
    const steward = createSkillSteward({
      skillsRoot: await tempSkillsRoot(),
      directory: memoryDirectory({
        hits: [grillingHit],
        descriptions: {
          'mattpocock/skills/grilling': 'Grill the user relentlessly about a plan, decision, or idea.',
        },
      }),
      archives: memoryArchives(),
    })

    await expect(steward.search('grill')).resolves.toEqual({
      kind: 'ok',
      hits: [{
        identity: 'mattpocock/skills/grilling',
        name: 'grilling',
        slug: 'grilling',
        source: 'mattpocock/skills',
        installs: 681270,
        url: 'https://skills.sh/mattpocock/skills/grilling',
        installable: true,
      }],
    })
  })

  it('still returns the list when a description cannot be read', async () => {
    const steward = createSkillSteward({
      skillsRoot: await tempSkillsRoot(),
      directory: memoryDirectory({ hits: [grillingHit] }),
      archives: memoryArchives(),
    })

    const result = await steward.search('grill')
    expect(result).toEqual({
      kind: 'ok',
      hits: [{
        identity: 'mattpocock/skills/grilling',
        name: 'grilling',
        slug: 'grilling',
        source: 'mattpocock/skills',
        installs: 681270,
        url: 'https://skills.sh/mattpocock/skills/grilling',
        installable: true,
      }],
    })
  })

  it('keeps unsupported sources in the results but marks them not installable', async () => {
    const steward = createSkillSteward({
      skillsRoot: await tempSkillsRoot(),
      directory: memoryDirectory({ hits: [mintlifyHit, grillingHit] }),
      archives: memoryArchives(),
    })

    const result = await steward.search('mint')
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.hits).toEqual([
      {
        identity: 'mintlify.com/mintlify',
        name: 'mintlify',
        slug: 'mintlify',
        source: 'mintlify.com',
        installs: 3004,
        url: 'https://skills.sh/mintlify.com/mintlify',
        installable: false,
      },
      {
        identity: 'mattpocock/skills/grilling',
        name: 'grilling',
        slug: 'grilling',
        source: 'mattpocock/skills',
        installs: 681270,
        url: 'https://skills.sh/mattpocock/skills/grilling',
        installable: true,
      },
    ])
  })
})
