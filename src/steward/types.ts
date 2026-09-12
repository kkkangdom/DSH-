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

/** GitHub tarball download for a `owner/repo` source. Unused until install. */
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

/** The skill steward: search in this ticket; install/update/uninstall later. */
export type SkillSteward = {
  search(query: string): Promise<SearchResult>
}

export type SkillStewardOptions = {
  readonly skillsRoot: string
  readonly directory: DirectoryPort
  readonly archives: ArchivePort
}
