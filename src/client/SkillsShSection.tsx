import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { InstallResult, LocalSkill, SearchHit, SearchResult } from '../steward/types.ts'
import { type SkillsShKey } from './locales.ts'
import css from './SkillsShSection.module.css'

export type SkillsShSectionInjected = {
  search: (query: string) => Promise<SearchResult>
  listLocal: () => Promise<readonly LocalSkill[]>
  install: (identity: string, confirmed?: boolean) => Promise<InstallResult>
}

export type SkillsShSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.skillsSh'>
  & InjectFace<SkillsShSectionInjected>

type SearchState =
  | { readonly phase: 'need-keywords' }
  | { readonly phase: 'loading'; readonly query: string }
  | { readonly phase: 'empty' }
  | { readonly phase: 'network-failure'; readonly query: string }
  | { readonly phase: 'ok'; readonly hits: readonly SearchHit[] }

type Dialog =
  | {
    readonly kind: 'install'
    readonly identity: string
    readonly coveringForeign: boolean
  }
  | { readonly kind: 'message'; readonly title: string; readonly body: string }

export function SkillsShSection(props: SkillsShSectionProps): ReactNode {
  const { t, search, listLocal, install } = props
  const [query, setQuery] = useState('')
  const [searchNonce, setSearchNonce] = useState(0)
  const [searchState, setSearchState] = useState<SearchState>({ phase: 'need-keywords' })
  const [local, setLocal] = useState<readonly LocalSkill[]>([])
  const [busy, setBusy] = useState<string>()
  const [notices, setNotices] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [dialog, setDialog] = useState<Dialog | null>(null)

  const loadLocal = async (): Promise<void> => {
    try {
      setLocal(await listLocal())
    } catch {
      setLocal([])
    }
  }

  useEffect(() => {
    void loadLocal()
  }, [])

  useEffect(() => {
    const keyword = query.trim()
    if (keyword.length < 2) {
      setSearchState({ phase: 'need-keywords' })
      return
    }
    let cancelled = false
    const handle = setTimeout(() => {
      setSearchState({ phase: 'loading', query: keyword })
      void search(keyword).then((result) => {
        if (cancelled) return
        if (result.kind === 'need-keywords') setSearchState({ phase: 'need-keywords' })
        else if (result.kind === 'empty') setSearchState({ phase: 'empty' })
        else if (result.kind === 'network-failure') setSearchState({ phase: 'network-failure', query: keyword })
        else setSearchState({ phase: 'ok', hits: result.hits })
      }).catch(() => {
        if (!cancelled) setSearchState({ phase: 'network-failure', query: keyword })
      })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query, searchNonce, search])

  const runInstall = async (identity: string, confirmed: boolean): Promise<void> => {
    setBusy(identity)
    try {
      const result = await install(identity, confirmed)
      if (result.kind === 'needs-confirmation') {
        setDialog({ kind: 'install', identity, coveringForeign: result.coveringForeign })
        return
      }
      setDialog(null)
      if (result.kind === 'installed') {
        setNotices(current => new Map(current).set(identity, t('installed')))
        await loadLocal()
        return
      }
      setDialog({ kind: 'message', title: t('install'), body: installMessage(t, result.kind) })
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <section className={css.section}>
      <h2 className={css.heading}>{t('title')}</h2>
      <p className={css.intro}>{t('intro')}</p>
      <label className={css.search}>
        <span className={css.visuallyHidden}>{t('searchLabel')}</span>
        <input
          value={query}
          onChange={event => { setQuery(event.target.value) }}
          placeholder={t('searchPlaceholder')}
        />
      </label>
      <SearchResults
        t={t}
        state={searchState}
        busy={busy}
        notices={notices}
        onRetry={() => { setSearchNonce(value => value + 1) }}
        onInstall={identity => { void runInstall(identity, false) }}
      />
      <h3 className={css.subheading}>{t('localTitle')}</h3>
      {local.length === 0 ? (
        <p className={css.status}>{t('localEmpty')}</p>
      ) : (
        <ul className={css.list}>
          {local.map(skill => (
            <li key={skill.identity} className={css.card}>
              <div className={css.cardHead}>
                <span className={css.name}>{skill.name}</span>
              </div>
              <div className={css.meta}>
                <span>{t('localSource')}: {skill.source}</span>
              </div>
              {notices.get(skill.identity) !== undefined ? (
                <p className={css.status}>{notices.get(skill.identity)}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {dialog !== null ? (
        <div className={css.overlay} role="dialog" aria-modal="true">
          <div className={css.mask} onClick={() => { setDialog(null) }} />
          <div className={css.panel}>
            <h3 className={css.panelTitle}>
              {dialog.kind === 'install' ? t('confirmInstallTitle') : dialog.title}
            </h3>
            <p className={css.panelBody}>
              {dialog.kind === 'install'
                ? (dialog.coveringForeign ? t('confirmForeign') : t('confirmInstall'))
                : dialog.body}
            </p>
            <div className={css.panelActions}>
              {dialog.kind === 'message' ? (
                <button type="button" className={`${css.btn} ${css.btnPrimary}`} onClick={() => { setDialog(null) }}>{t('close')}</button>
              ) : (
                <>
                  <button type="button" className={css.btn} onClick={() => { setDialog(null) }}>{t('cancel')}</button>
                  <button
                    type="button"
                    className={`${css.btn} ${css.btnPrimary}`}
                    disabled={busy !== undefined}
                    onClick={() => { void runInstall(dialog.identity, true) }}
                  >
                    {t('confirm')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function SearchResults({
  t, state, busy, notices, onRetry, onInstall,
}: {
  t: (key: SkillsShKey) => string
  state: SearchState
  busy: string | undefined
  notices: ReadonlyMap<string, string>
  onRetry: () => void
  onInstall: (identity: string) => void
}): ReactNode {
  if (state.phase === 'need-keywords') return <p className={css.status}>{t('needKeywords')}</p>
  if (state.phase === 'loading') return <p className={css.status}>{t('searching')}</p>
  if (state.phase === 'empty') return <p className={css.status}>{t('empty')}</p>
  if (state.phase === 'network-failure') {
    return (
      <div>
        <p className={`${css.status} ${css.error}`}>{t('networkFailure')}</p>
        <button type="button" className={css.btn} onClick={onRetry}>{t('retry')}</button>
      </div>
    )
  }
  return (
    <ul className={css.list}>
      {state.hits.map(hit => (
        <li key={hit.identity} className={css.card}>
          <div className={css.cardHead}>
            <span className={css.name}>{hit.name}</span>
          </div>
          <p className={css.desc}>{hit.description ?? t('descriptionUnavailable')}</p>
          <div className={css.meta}>
            <span>{t('source')}: {hit.source}</span>
            <span>{t('installs')}: {hit.installs}</span>
          </div>
          {notices.get(hit.identity) !== undefined ? (
            <p className={css.status}>{notices.get(hit.identity)}</p>
          ) : null}
          <div className={css.actions}>
            <a className={css.link} href={hit.url} target="_blank" rel="noreferrer">{t('openPage')}</a>
            {hit.installable ? (
              <button
                type="button"
                className={`${css.btn} ${css.btnPrimary}`}
                disabled={busy === hit.identity}
                onClick={() => { onInstall(hit.identity) }}
              >
                {t('install')}
              </button>
            ) : (
              <span className={css.hint}>{t('unsupported')}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

function installMessage(t: (key: SkillsShKey) => string, kind: InstallResult['kind']): string {
  if (kind === 'unsupported-source') return t('unsupported')
  if (kind === 'no-match') return t('noMatch')
  if (kind === 'not-unique') return t('notUnique')
  if (kind === 'path-unsafe') return t('pathUnsafe')
  if (kind === 'network-failure') return t('networkFailure')
  if (kind === 'source-gone') return t('sourceGone')
  return t('install')
}
