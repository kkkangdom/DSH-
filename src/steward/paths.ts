import path from 'node:path'

/** Ledger and staging live here; DSH skips `.system` when scanning skills. */
export const SYSTEM_DIR = '.system'
export const LEDGER_FILE = 'ledger.json'
export const ORIGIN_FILE = '.skills-sh.json'

export function ledgerPath(skillsRoot: string): string {
  return path.join(skillsRoot, SYSTEM_DIR, LEDGER_FILE)
}

export function systemDir(skillsRoot: string): string {
  return path.join(skillsRoot, SYSTEM_DIR)
}

/**
 * Resolve `target` under `root`. Returns undefined when the result would
 * leave `root` (including `..`, absolute segments, and extra roots).
 */
export function resolveInside(root: string, ...segments: string[]): string | undefined {
  const base = path.resolve(root)
  const resolved = path.resolve(base, ...segments)
  const relative = path.relative(base, resolved)
  if (relative === '') return resolved
  if (relative.startsWith('..') || path.isAbsolute(relative)) return undefined
  return resolved
}

/** Slugs that would collide with the ledger or escape the skills directory. */
export function destForSlug(skillsRoot: string, slug: string): string | undefined {
  if (slug === '' || slug === '.' || slug === '..' || slug === SYSTEM_DIR) return undefined
  if (slug.includes('/') || slug.includes('\\') || slug.includes('\0')) return undefined
  return resolveInside(skillsRoot, slug)
}
