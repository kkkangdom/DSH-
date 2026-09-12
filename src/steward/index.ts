import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { hashBundle, matchBundle, parseFrontmatterName, readTarGz } from './archive.ts'
import { cleanupSystemIfNoLedger, pathExists, removeBundle, replaceBundle } from './files.ts'
import { isGitHubSource, parseIdentity, skillsShUrl } from './github.ts'
import { entryBySlug, readLedger, removeSkill, removeSystemIfEmpty, upsertSkill, writeLedger } from './ledger.ts'
import { destForSlug, ledgerPath } from './paths.ts'
import type {
  Confirmable,
  InstallResult,
  LocalSkill,
  SearchHit,
  SearchResult,
  SkillSteward,
  SkillStewardOptions,
  UninstallResult,
  UpdateCheckResult,
  UpdateResult,
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
  UninstallResult,
  UpdateCheckResult,
  UpdateResult,
} from './types.ts'

/**
 * Create a skill steward that searches Skills.sh and manages skill bundles
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
    async checkUpdate(identity) {
      return checkSkillUpdate(skillsRoot, archives, identity)
    },
    async update(identity, confirm) {
      return updateSkill(skillsRoot, archives, identity, confirm)
    },
    async uninstall(identity, confirm) {
      return uninstallSkill(skillsRoot, identity, confirm)
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

  const hits: SearchHit[] = response.hits.map((hit) => ({
    identity: hit.id,
    name: hit.name,
    slug: hit.slug,
    source: hit.source,
    installs: hit.installs,
    url: skillsShUrl(hit.id),
    installable: isGitHubSource(hit.source),
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

async function checkSkillUpdate(
  skillsRoot: string,
  archives: SkillStewardOptions['archives'],
  identity: string,
): Promise<UpdateCheckResult> {
  const loaded = await loadManagedRemote(skillsRoot, archives, identity)
  if (loaded.kind !== 'ready') return loaded
  if (loaded.hash === loaded.entry.contentHash) return { kind: 'up-to-date' }
  return { kind: 'update-available', contentHash: loaded.hash }
}

async function updateSkill(
  skillsRoot: string,
  archives: SkillStewardOptions['archives'],
  identity: string,
  confirm?: Confirmable,
): Promise<UpdateResult> {
  if (confirm?.confirmed !== true) {
    const ledger = await readLedger(skillsRoot)
    if (ledger.skills[identity] === undefined) return { kind: 'not-managed' }
    return { kind: 'needs-confirmation' }
  }
  const loaded = await loadManagedRemote(skillsRoot, archives, identity)
  if (loaded.kind !== 'ready') return loaded
  const origin = { identity, source: loaded.parsed.source, slug: loaded.parsed.slug }
  try {
    await replaceBundle(skillsRoot, loaded.dest, loaded.files, origin, async () => {
      await writeLedger(skillsRoot, upsertSkill(loaded.ledger, {
        identity,
        source: loaded.parsed.source,
        slug: loaded.parsed.slug,
        contentHash: loaded.hash,
        sourceStatus: 'ok',
      }))
    })
    return { kind: 'updated' }
  } catch {
    return { kind: 'rolled-back' }
  }
}

async function uninstallSkill(
  skillsRoot: string,
  identity: string,
  confirm?: Confirmable,
): Promise<UninstallResult> {
  const ledger = await readLedger(skillsRoot)
  const entry = ledger.skills[identity]
  if (entry === undefined) return { kind: 'not-managed' }
  if (confirm?.confirmed !== true) return { kind: 'needs-confirmation' }
  const dest = destForSlug(skillsRoot, entry.slug)
  if (dest !== undefined) await removeBundle(dest)
  const next = removeSkill(ledger, identity)
  if (Object.keys(next.skills).length === 0) {
    await removeSystemIfEmpty(skillsRoot)
  } else {
    await writeLedger(skillsRoot, next)
  }
  return { kind: 'uninstalled' }
}

type RemoteLoad =
  | {
    readonly kind: 'ready'
    readonly parsed: { source: string; slug: string }
    readonly dest: string
    readonly files: readonly import('./archive.ts').ArchiveFile[]
    readonly hash: string
    readonly ledger: import('./ledger.ts').Ledger
    readonly entry: import('./ledger.ts').LedgerEntry
  }
  | { readonly kind: 'not-managed' }
  | { readonly kind: 'source-gone' }
  | { readonly kind: 'network-failure' }
  | { readonly kind: 'no-match' }
  | { readonly kind: 'not-unique' }
  | { readonly kind: 'path-unsafe' }

async function loadManagedRemote(
  skillsRoot: string,
  archives: SkillStewardOptions['archives'],
  identity: string,
): Promise<RemoteLoad> {
  const parsed = parseIdentity(identity)
  if (parsed === undefined) return { kind: 'path-unsafe' }
  const ledger = await readLedger(skillsRoot)
  const entry = ledger.skills[identity]
  if (entry === undefined) return { kind: 'not-managed' }
  const dest = destForSlug(skillsRoot, parsed.slug)
  if (dest === undefined) return { kind: 'path-unsafe' }

  const downloaded = await archives.download(parsed.source)
  if (!downloaded.ok) {
    if (downloaded.reason === 'source-gone') {
      await writeLedger(skillsRoot, upsertSkill(ledger, { ...entry, sourceStatus: 'gone' }))
    }
    return { kind: downloaded.reason }
  }

  let matched
  try {
    matched = matchBundle(await readTarGz(downloaded.tarball), parsed.slug)
  } catch {
    return { kind: 'no-match' }
  }
  if (matched.kind !== 'ok') return { kind: matched.kind }

  if (entry.sourceStatus === 'gone') {
    await writeLedger(skillsRoot, upsertSkill(ledger, { ...entry, sourceStatus: 'ok' }))
  }
  return {
    kind: 'ready',
    parsed,
    dest,
    files: matched.files,
    hash: hashBundle(matched.files),
    ledger,
    entry,
  }
}
