import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { hashBundle, matchBundle, parseFrontmatterName, readTarGz } from './archive.ts'
import { cleanupSystemIfNoLedger, pathExists, replaceBundle } from './files.ts'
import { isGitHubSource, parseIdentity, skillsShUrl } from './github.ts'
import { entryBySlug, readLedger, upsertSkill, writeLedger } from './ledger.ts'
import { destForSlug, ledgerPath } from './paths.ts'
import type {
  Confirmable,
  InstallResult,
  LocalSkill,
  SearchHit,
  SearchResult,
  SkillSteward,
  SkillStewardOptions,
} from './types.ts'

export type {
  ArchiveDownloadResponse,
  ArchivePort,
  Confirmable,
  DirectoryHit,
  DirectoryPort,
  DirectorySearchResponse,
  InstallResult,
  LocalSkill,
  SearchHit,
  SearchResult,
  SkillSteward,
  SkillStewardOptions,
} from './types.ts'

/**
 * Create a skill steward that searches Skills.sh and installs skill bundles
 * under a DSH skills directory. Callers inject the directory, archives, and
 * skills-root; the steward never talks to the network itself.
 */
export function createSkillSteward(options: SkillStewardOptions): SkillSteward {
  const { directory, archives, skillsRoot } = options

  return {
    async search(query) {
      return searchSkills(directory, query)
    },
    async listLocal() {
      return listLocalSkills(skillsRoot)
    },
    async install(identity, confirm) {
      return installSkill(skillsRoot, archives, identity, confirm)
    },
  }
}

async function searchSkills(
  directory: SkillStewardOptions['directory'],
  query: string,
): Promise<SearchResult> {
  const keyword = query.trim()
  if (keyword.length < 2) return { kind: 'need-keywords' }

  const response = await directory.search(keyword)
  if (!response.ok) return { kind: 'network-failure' }
  if (response.hits.length === 0) return { kind: 'empty' }

  const hits: SearchHit[] = await Promise.all(response.hits.map(async (hit) => {
    const description = await directory.readDescription(hit.id).catch(() => undefined)
    return {
      identity: hit.id,
      name: hit.name,
      slug: hit.slug,
      source: hit.source,
      installs: hit.installs,
      url: skillsShUrl(hit.id),
      ...(description !== undefined && description !== '' ? { description } : {}),
      installable: isGitHubSource(hit.source),
    }
  }))
  return { kind: 'ok', hits }
}

async function listLocalSkills(skillsRoot: string): Promise<readonly LocalSkill[]> {
  const ledger = await readLedger(skillsRoot)
  const listed: LocalSkill[] = []
  for (const entry of Object.values(ledger.skills)) {
    const dest = destForSlug(skillsRoot, entry.slug)
    if (dest === undefined) continue
    try {
      const markdown = await readFile(path.join(dest, 'SKILL.md'), 'utf8')
      listed.push({
        identity: entry.identity,
        name: parseFrontmatterName(markdown) ?? entry.slug,
        slug: entry.slug,
        source: entry.source,
        contentHash: entry.contentHash,
        sourceStatus: entry.sourceStatus,
      })
    } catch {
      // Folder gone: omit from the local-skill list.
    }
  }
  listed.sort((a, b) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)
  return listed
}

async function installSkill(
  skillsRoot: string,
  archives: SkillStewardOptions['archives'],
  identity: string,
  confirm?: Confirmable,
): Promise<InstallResult> {
  const parsed = parseIdentity(identity)
  if (parsed === undefined) return { kind: 'path-unsafe' }
  if (!isGitHubSource(parsed.source)) return { kind: 'unsupported-source' }
  const dest = destForSlug(skillsRoot, parsed.slug)
  if (dest === undefined) return { kind: 'path-unsafe' }

  const exists = await pathExists(dest)
  const ledger = await readLedger(skillsRoot)
  if (exists && confirm?.confirmed !== true) {
    return {
      kind: 'needs-confirmation',
      coveringForeign: entryBySlug(ledger, parsed.slug) === undefined,
    }
  }

  const downloaded = await archives.download(parsed.source)
  if (!downloaded.ok) return { kind: downloaded.reason }

  let matched
  try {
    matched = matchBundle(await readTarGz(downloaded.tarball), parsed.slug)
  } catch {
    return { kind: 'no-match' }
  }
  if (matched.kind !== 'ok') return { kind: matched.kind }

  const contentHash = hashBundle(matched.files)
  const origin = { identity, source: parsed.source, slug: parsed.slug }
  try {
    await replaceBundle(skillsRoot, dest, matched.files, origin, async () => {
      await writeLedger(skillsRoot, upsertSkill(ledger, {
        identity,
        source: parsed.source,
        slug: parsed.slug,
        contentHash,
        sourceStatus: 'ok',
      }))
    })
    return { kind: 'installed', identity, slug: parsed.slug }
  } catch {
    await cleanupSystemIfNoLedger(skillsRoot, ledgerPath(skillsRoot))
    return { kind: 'path-unsafe' }
  }
}
