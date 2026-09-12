import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { createGunzip } from 'node:zlib'
import path from 'node:path'
import { extract as tarExtract } from 'tar-stream'
import { ORIGIN_FILE, resolveInside } from './paths.ts'

export type ArchiveFile = {
  readonly path: string
  readonly type: 'file' | 'symlink'
  readonly content: Buffer
  readonly linkpath?: string
}

export type MatchedBundle =
  | { readonly kind: 'ok'; readonly files: readonly ArchiveFile[] }
  | { readonly kind: 'no-match' }
  | { readonly kind: 'not-unique' }
  | { readonly kind: 'path-unsafe' }

type TarEntry = {
  readonly name: string
  readonly type: 'file' | 'directory' | 'symlink' | 'other'
  readonly linkpath?: string
  readonly content: Buffer
}

export async function readTarGz(tarball: Uint8Array): Promise<readonly TarEntry[]> {
  const entries: TarEntry[] = []
  const extractor = tarExtract()
  const gunzip = createGunzip()
  const done = new Promise<void>((resolve, reject) => {
    extractor.on('finish', () => { resolve() })
    extractor.on('end', () => { resolve() })
    extractor.on('error', reject)
    gunzip.on('error', reject)
    extractor.on('entry', (header, stream, next) => {
      const chunks: Buffer[] = []
      stream.on('data', (chunk) => { chunks.push(chunk as Buffer) })
      stream.on('error', reject)
      stream.on('end', () => {
        const headerType = header.type
        const type: TarEntry['type'] =
          headerType === 'symlink' ? 'symlink'
            : headerType === 'directory' ? 'directory'
              : headerType === 'file' || headerType === undefined ? 'file'
                : 'other'
        entries.push({
          name: normalizeTarName(header.name),
          type,
          linkpath: header.linkname,
          content: Buffer.concat(chunks),
        })
        next()
      })
    })
  })
  // fetch().arrayBuffer() yields a plain Uint8Array. Readable.from() iterates
  // that as numbers (gzip magic 0x1f === 31), which crashes Gunzip.
  Readable.from([Buffer.from(tarball)]).pipe(gunzip).pipe(extractor)
  await done
  return entries
}

export function matchBundle(entries: readonly TarEntry[], slug: string): MatchedBundle {
  const skillEntries = entries.filter(entry => isSkillMd(entry.name) && entry.type === 'file')
  const bundles = new Map<string, { dirName: string; frontmatterName?: string }>()
  for (const entry of skillEntries) {
    const root = bundleRoot(entry.name)
    if (root === undefined) continue
    const existing = bundles.get(root.key)
    const frontmatterName = parseFrontmatterName(entry.content.toString('utf8'))
    if (existing === undefined) {
      bundles.set(root.key, { dirName: root.dirName, frontmatterName })
    }
  }

  const matched: string[] = []
  for (const [key, bundle] of bundles) {
    if (bundle.dirName === slug || bundle.frontmatterName === slug) matched.push(key)
  }
  if (matched.length === 0) return { kind: 'no-match' }
  if (matched.length > 1) return { kind: 'not-unique' }

  const key = matched[0]
  if (key === undefined) return { kind: 'no-match' }
  return collectBundle(entries, key, slug)
}

function collectBundle(entries: readonly TarEntry[], bundleKey: string, slug: string): MatchedBundle {
  const prefix = bundleKey === '' ? '' : bundleKey + '/'
  const files: ArchiveFile[] = []
  for (const entry of entries) {
    if (entry.type === 'directory' || entry.type === 'other') continue
    if (!inBundle(entry.name, bundleKey)) continue
    const relative = prefix === '' ? entry.name : entry.name.slice(prefix.length)
    if (relative === '' || relative === '.') continue
    if (isUnsafeRelative(relative)) return { kind: 'path-unsafe' }
    if (entry.type === 'symlink') {
      if (entry.linkpath === undefined || isUnsafeLink(relative, entry.linkpath, slug)) {
        return { kind: 'path-unsafe' }
      }
      files.push({ path: relative, type: 'symlink', content: Buffer.alloc(0), linkpath: entry.linkpath })
      continue
    }
    files.push({ path: relative, type: 'file', content: entry.content })
  }
  if (!files.some(file => file.path === 'SKILL.md' || file.path.endsWith('/SKILL.md'))) {
    return { kind: 'no-match' }
  }
  return { kind: 'ok', files }
}

/** Hash of regular files in the bundle, excluding the origin sidecar. */
export function hashBundle(files: readonly ArchiveFile[]): string {
  const hash = createHash('sha256')
  const regular = files
    .filter(file => file.type === 'file' && file.path !== ORIGIN_FILE)
    .slice()
    .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  for (const file of regular) {
    hash.update(file.path)
    hash.update('\0')
    hash.update(file.content)
  }
  return hash.digest('hex')
}

export function parseFrontmatterName(markdown: string): string | undefined {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (match === null) return undefined
  const nameLine = match[1]?.match(/^name:\s*(.+)$/m)
  const name = nameLine?.[1]
  if (name === undefined) return undefined
  return name.trim().replace(/^['"]|['"]$/g, '')
}

function normalizeTarName(name: string): string {
  return name.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '')
}

function isSkillMd(name: string): boolean {
  return name === 'SKILL.md' || name.endsWith('/SKILL.md')
}

function bundleRoot(skillMdPath: string): { key: string; dirName: string } | undefined {
  const parts = skillMdPath.split('/')
  if (parts.length === 0) return undefined
  // GitHub tarballs wrap the repo in one top-level folder.
  if (parts.length === 1) {
    return { key: '', dirName: '' }
  }
  const inside = parts.slice(1, -1)
  const key = [parts[0], ...inside].join('/')
  const dirName = inside.length === 0 ? (parts[0] ?? '') : (inside[inside.length - 1] ?? '')
  return { key, dirName }
}

function inBundle(name: string, bundleKey: string): boolean {
  if (bundleKey === '') return true
  return name === bundleKey || name.startsWith(bundleKey + '/')
}

function isUnsafeRelative(relative: string): boolean {
  if (path.posix.isAbsolute(relative) || path.win32.isAbsolute(relative)) return true
  const normalized = path.posix.normalize(relative)
  return normalized === '..' || normalized.startsWith('../') || normalized.includes('\0')
}

function isUnsafeLink(relative: string, linkpath: string, slug: string): boolean {
  if (path.posix.isAbsolute(linkpath) || path.win32.isAbsolute(linkpath)) return true
  const fakeRoot = path.resolve('/skills-root-check', slug)
  const fromDir = path.dirname(path.join(fakeRoot, relative))
  return resolveInside(fakeRoot, path.relative(fakeRoot, path.resolve(fromDir, linkpath))) === undefined
}
