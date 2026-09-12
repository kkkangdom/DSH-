/** A Skills.sh search hit as the directory returns it. */
export type DirectoryHit = {
  readonly id: string
  readonly name: string
  readonly slug: string
  readonly source: string
  readonly installs: number
}

/** Skills.sh directory: search and optional skill-page description. */
export type DirectoryPort = {
  search(query: string): Promise<DirectorySearchResponse>
  readDescription(id: string): Promise<string | undefined>
}

export type DirectorySearchResponse =
  | { readonly ok: true; readonly hits: readonly DirectoryHit[] }
  | { readonly ok: false; readonly reason: 'network-failure' }

/** GitHub tarball download for a `owner/repo` source. */
export type ArchivePort = {
  download(source: string): Promise<ArchiveDownloadResponse>
}

export type ArchiveDownloadResponse =
  | { readonly ok: true; readonly tarball: Uint8Array }
  | { readonly ok: false; readonly reason: 'network-failure' | 'source-gone' }

export type SearchHit = {
  readonly identity: string
  readonly name: string
  readonly slug: string
  readonly source: string
  readonly installs: number
  readonly url: string
  readonly description?: string
  readonly installable: boolean
}

export type SearchResult =
  | { readonly kind: 'need-keywords' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'network-failure' }
  | { readonly kind: 'ok'; readonly hits: readonly SearchHit[] }

export type LocalSkill = {
  readonly identity: string
  readonly name: string
  readonly slug: string
  readonly source: string
  readonly contentHash: string
  readonly sourceStatus: 'ok' | 'gone'
}

export type Confirmable = {
  readonly confirmed?: boolean
}

export type InstallResult =
  | { readonly kind: 'installed'; readonly identity: string; readonly slug: string }
  | { readonly kind: 'needs-confirmation'; readonly coveringForeign: boolean }
  | { readonly kind: 'unsupported-source' }
  | { readonly kind: 'no-match' }
  | { readonly kind: 'not-unique' }
  | { readonly kind: 'path-unsafe' }
  | { readonly kind: 'network-failure' }
  | { readonly kind: 'source-gone' }

export type UpdateCheckResult =
  | { readonly kind: 'up-to-date' }
  | { readonly kind: 'update-available'; readonly contentHash: string }
  | { readonly kind: 'source-gone' }
  | { readonly kind: 'network-failure' }
  | { readonly kind: 'not-managed' }
  | { readonly kind: 'no-match' }
  | { readonly kind: 'not-unique' }
  | { readonly kind: 'path-unsafe' }

export type UpdateResult =
  | { readonly kind: 'updated' }
  | { readonly kind: 'needs-confirmation' }
  | { readonly kind: 'rolled-back' }
  | { readonly kind: 'source-gone' }
  | { readonly kind: 'network-failure' }
  | { readonly kind: 'path-unsafe' }
  | { readonly kind: 'no-match' }
  | { readonly kind: 'not-unique' }
  | { readonly kind: 'not-managed' }

export type UninstallResult =
  | { readonly kind: 'uninstalled' }
  | { readonly kind: 'needs-confirmation' }
  | { readonly kind: 'not-managed' }

/** The skill steward: search, list, and install in this ticket. */
export type SkillSteward = {
  search(query: string): Promise<SearchResult>
  listLocal(): Promise<readonly LocalSkill[]>
  install(identity: string, options?: Confirmable): Promise<InstallResult>
}

export type SkillStewardOptions = {
  readonly skillsRoot: string
  readonly directory: DirectoryPort
  readonly archives: ArchivePort
}
