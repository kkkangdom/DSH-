import type { ArchivePort } from '../steward/types.ts'

const MAX_BYTES = 50 * 1024 * 1024

export function createGitHubArchives(fetcher: typeof fetch = fetch): ArchivePort {
  return {
    async download(source) {
      const slash = source.indexOf('/')
      if (slash <= 0 || slash === source.length - 1) return { ok: false, reason: 'source-gone' }
      const owner = source.slice(0, slash)
      const repo = source.slice(slash + 1)
      const url = `https://codeload.github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tar.gz/HEAD`
      try {
        const response = await fetcher(url, { signal: abortAfter(30_000) })
        if (response.status === 404) return { ok: false, reason: 'source-gone' }
        if (!response.ok) return { ok: false, reason: 'network-failure' }
        const buffer = new Uint8Array(await response.arrayBuffer())
        if (buffer.byteLength > MAX_BYTES) return { ok: false, reason: 'network-failure' }
        return { ok: true, tarball: buffer }
      } catch {
        return { ok: false, reason: 'network-failure' }
      }
    },
  }
}

function abortAfter(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal === 'undefined' || typeof AbortSignal.timeout !== 'function') return undefined
  return AbortSignal.timeout(ms)
}
