import { isGitHubSource, skillsShUrl } from './github.ts'
import type {
  SearchHit,
  SearchResult,
  SkillSteward,
  SkillStewardOptions,
} from './types.ts'

export type {
  ArchiveDownloadResponse,
  ArchivePort,
  DirectoryHit,
  DirectoryPort,
  DirectorySearchResponse,
  SearchHit,
  SearchResult,
  SkillSteward,
  SkillStewardOptions,
} from './types.ts'

/**
 * Create a skill steward that searches Skills.sh.
 * Callers inject the directory; the steward never talks to the network itself.
 */
export function createSkillSteward(options: SkillStewardOptions): SkillSteward {
  const { directory } = options

  return {
    async search(query) {
      return searchSkills(directory, query)
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
