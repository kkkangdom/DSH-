import { gzipSync } from 'node:zlib'
import { pack as tarPack } from 'tar-stream'
import { Readable } from 'node:stream'
import type { ArchivePort, DirectoryHit, DirectoryPort } from '../src/steward/types.ts'

const SKILL_MD = (name: string, extra = ''): string => `---
name: ${name}
description: A fixture skill named ${name}
---

# ${name}
${extra}
`

export function skillMarkdown(name: string, extra = ''): string {
  return SKILL_MD(name, extra)
}

/** Pack a GitHub-style tar.gz (`prefix/path` entries). */
export async function packTarGz(
  files: Record<string, string>,
  options?: { readonly prefix?: string; readonly extra?: readonly TarExtra[] },
): Promise<Uint8Array> {
  const prefix = options?.prefix ?? 'repo-HEAD'
  const packing = tarPack()
  const chunks: Buffer[] = []
  packing.on('data', (chunk) => { chunks.push(chunk as Buffer) })
  const done = new Promise<Uint8Array>((resolve, reject) => {
    packing.on('end', () => resolve(gzipSync(Buffer.concat(chunks))))
    packing.on('error', reject)
  })
  for (const [rel, content] of Object.entries(files)) {
    const name = `${prefix}/${rel}`.replace(/\\/g, '/')
    packing.entry({ name, type: 'file' }, content)
  }
  for (const extra of options?.extra ?? []) {
    packing.entry({
      name: extra.name,
      type: extra.type ?? 'file',
      linkname: extra.linkname,
    }, extra.content ?? '')
  }
  packing.finalize()
  return done
}

export type TarExtra = {
  readonly name: string
  readonly content?: string
  readonly type?: 'file' | 'directory' | 'symlink'
  readonly linkname?: string
}

export function memoryDirectory(init?: {
  readonly hits?: readonly DirectoryHit[]
  readonly descriptions?: Readonly<Record<string, string>>
  readonly fail?: 'network-failure'
  readonly searchCalls?: string[]
}): DirectoryPort & { readonly searchCalls: string[] } {
  const searchCalls = init?.searchCalls ?? []
  return {
    searchCalls,
    async search(query) {
      searchCalls.push(query)
      if (init?.fail === 'network-failure') return { ok: false, reason: 'network-failure' }
      return { ok: true, hits: init?.hits ?? [] }
    },
    async readDescription(id) {
      return init?.descriptions?.[id]
    },
  }
}

export function memoryArchives(init?: {
  readonly tarballs?: Record<string, Uint8Array>
  readonly fail?: Record<string, 'network-failure' | 'source-gone'>
}): ArchivePort & { tarballs: Record<string, Uint8Array>; fail: Record<string, 'network-failure' | 'source-gone'> } {
  const tarballs = init?.tarballs ?? {}
  const fail = init?.fail ?? {}
  return {
    tarballs,
    fail,
    async download(source) {
      const reason = fail[source]
      if (reason !== undefined) return { ok: false, reason }
      const tarball = tarballs[source]
      if (tarball === undefined) return { ok: false, reason: 'source-gone' }
      return { ok: true, tarball }
    },
  }
}

export const grillingHit: DirectoryHit = {
  id: 'mattpocock/skills/grilling',
  name: 'grilling',
  slug: 'grilling',
  source: 'mattpocock/skills',
  installs: 681270,
}

export const mintlifyHit: DirectoryHit = {
  id: 'mintlify.com/mintlify',
  name: 'mintlify',
  slug: 'mintlify',
  source: 'mintlify.com',
  installs: 3004,
}
