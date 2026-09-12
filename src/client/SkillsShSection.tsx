import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SearchHit, SearchResult } from '../steward/types.ts'
import { type SkillsShKey } from './locales.ts'
import css from './SkillsShSection.module.css'

export type SkillsShSectionInjected = {
  search: (query: string) => Promise<SearchResult>
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

export function SkillsShSection(props: SkillsShSectionProps): ReactNode {
  const { t, search } = props
  const [query, setQuery] = useState('')
  const [searchNonce, setSearchNonce] = useState(0)
  const [searchState, setSearchState] = useState<SearchState>({ phase: 'need-keywords' })

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
        onRetry={() => { setSearchNonce(value => value + 1) }}
      />
    </section>
  )
}

function SearchResults({
  t, state, onRetry,
}: {
  t: (key: SkillsShKey) => string
  state: SearchState
  onRetry: () => void
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
          <div className={css.actions}>
            <a className={css.link} href={hit.url} target="_blank" rel="noreferrer">{t('openPage')}</a>
            {hit.installable
              ? <span className={css.hint}>{t('install')}</span>
              : <span className={css.hint}>{t('unsupported')}</span>}
          </div>
        </li>
      ))}
    </ul>
  )
}
