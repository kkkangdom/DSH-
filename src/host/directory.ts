import type { DirectoryHit, DirectoryPort } from '../steward/types.ts'

const SEARCH_URL = 'https://skills.sh/api/search'
const SKILL_PAGE = 'https://www.skills.sh'

export function createSkillsShDirectory(fetcher: typeof fetch = fetch): DirectoryPort {
  return {
    async search(query) {
      try {
        const response = await fetcher(`${SEARCH_URL}?q=${encodeURIComponent(query)}`, {
          headers: {
            accept: 'application/json',
            'user-agent': 'dsh-skills-sh',
          },
          signal: abortAfter(15_000),
        })
        if (!response.ok) return { ok: false, reason: 'network-failure' }
        const body = await response.json() as { skills?: unknown }
        const hits = Array.isArray(body.skills) ? body.skills.flatMap(toHit) : []
        return { ok: true, hits }
      } catch {
        return { ok: false, reason: 'network-failure' }
      }
    },
    async readDescription(id) {
      try {
        const response = await fetcher(`${SKILL_PAGE}/${id}`, {
          headers: { accept: 'text/html' },
          signal: abortAfter(10_000),
        })
        if (!response.ok) return undefined
        const html = await response.text()
        return metaDescription(html)
      } catch {
        return undefined
      }
    },
  }
}

function toHit(value: unknown): DirectoryHit[] {
  if (typeof value !== 'object' || value === null) return []
  const row = value as Record<string, unknown>
  const id = asString(row.id)
  const source = asString(row.source)
  const name = asString(row.name)
  if (id === undefined || source === undefined || name === undefined) return []
  const slug = asString(row.skillId) ?? asString(row.slug) ?? id.slice(id.lastIndexOf('/') + 1)
  const installs = typeof row.installs === 'number' && Number.isFinite(row.installs) ? row.installs : 0
  return [{ id, name, slug, source, installs }]
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function metaDescription(html: string): string | undefined {
  const named = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)
    ?? html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i)
    ?? html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i)
    ?? html.match(/<meta\s+content=["']([^"']*)["']\s+property=["']og:description["']/i)
  const raw = named?.[1]
  if (raw === undefined || raw === '') return undefined
  return decodeHtml(raw)
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(Number(dec)))
}

function abortAfter(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal === 'undefined' || typeof AbortSignal.timeout !== 'function') return undefined
  return AbortSignal.timeout(ms)
}
