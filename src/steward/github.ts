/**
 * GitHub sources on Skills.sh look like `owner/repo` (exactly one slash).
 * Well-known sites use a hostname (`mintlify.com`) and are not installable.
 */
export function isGitHubSource(source: string): boolean {
  const parts = source.split('/')
  return parts.length === 2 && parts[0] !== '' && parts[1] !== ''
}

/** Split `{source}/{slug}` into source and slug. */
export function parseIdentity(identity: string): { source: string; slug: string } | undefined {
  const trimmed = identity.trim()
  const slash = trimmed.lastIndexOf('/')
  if (slash <= 0 || slash === trimmed.length - 1) return undefined
  return {
    source: trimmed.slice(0, slash),
    slug: trimmed.slice(slash + 1),
  }
}

export function skillsShUrl(identity: string): string {
  return `https://skills.sh/${identity}`
}
