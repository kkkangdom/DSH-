import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  InstallResult,
  LocalSkill,
  SearchHit,
  SearchResult,
  UninstallResult,
  UpdateCheckResult,
  UpdateResult,
} from '../steward/types.ts'
import { type SkillsShKey } from './locales.ts'
import css from './SkillsShSection.module.css'

export type SkillsShSectionInjected = {
  search: (query: string) => Promise<SearchResult>
  listLocal: () => Promise<readonly LocalSkill[]>
  install: (identity: string, confirmed?: boolean) => Promise<InstallResult>
  checkUpdate: (identity: string) => Promise<UpdateCheckResult>
  update: (identity: string, confirmed?: boolean) => Promise<UpdateResult>
  uninstall: (identity: string, confirmed?: boolean) => Promise<UninstallResult>
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
  | { readonly kind: 'update'; readonly identity: string }
  | { readonly kind: 'uninstall'; readonly identity: string }
  | { readonly kind: 'message'; readonly title: string; readonly body: string }

type UpdateStatus =
  | { readonly kind: 'up-to-date' }
  | { readonly kind: 'update-available' }
  | { readonly kind: 'source-gone' }
  | { readonly kind: 'network-failure' }

export function SkillsShSection(props: SkillsShSectionProps): ReactNode {
  const { t, search, listLocal, install, checkUpdate, update, uninstall } = props
  const [query, setQuery] = useState('')
  const [searchNonce, setSearchNonce] = useState(0)
  const [searchState, setSearchState] = useState<SearchState>({ phase: 'need-keywords' })
  const [local, setLocal] = useState<readonly LocalSkill[]>([])
  const [busy, setBusy] = useState<string>()
  const [notices, setNotices] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [updateStatus, setUpdateStatus] = useState<ReadonlyMap<string, UpdateStatus>>(() => new Map())
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

  const setNotice = (identity: string, text: string): void => {
    setNotices(current => new Map(current).set(identity, text))
  }

  const setStatus = (identity: string, status: UpdateStatus): void => {
    setUpdateStatus(current => new Map(current).set(identity, status))
  }

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
        setNotice(identity, t('installed'))
        await loadLocal()
        return
      }
      setDialog({ kind: 'message', title: t('install'), body: installMessage(t, result.kind) })
    } finally {
      setBusy(undefined)
    }
  }

  const runUpdate = async (identity: string, confirmed: boolean): Promise<void> => {
    setBusy(identity)
    try {
      if (!confirmed) {
        const check = await checkUpdate(identity)
        if (check.kind === 'up-to-date') {
          setStatus(identity, { kind: 'up-to-date' })
          return
        }
        if (check.kind === 'update-available') {
          setStatus(identity, { kind: 'update-available' })
          return
        }
        if (check.kind === 'source-gone') {
          setStatus(identity, { kind: 'source-gone' })
          await loadLocal()
          return
        }
        if (check.kind === 'network-failure') {
          setStatus(identity, { kind: 'network-failure' })
          return
        }
        setDialog({ kind: 'message', title: t('checkUpdate'), body: updateCheckMessage(t, check.kind) })
        return
      }
      const result = await update(identity, true)
      setDialog(null)
      if (result.kind === 'updated') {
        setNotice(identity, t('updated'))
        setStatus(identity, { kind: 'up-to-date' })
        await loadLocal()
        return
      }
      if (result.kind === 'network-failure') {
        setStatus(identity, { kind: 'network-failure' })
        return
      }
      if (result.kind === 'source-gone') {
        setStatus(identity, { kind: 'source-gone' })
        await loadLocal()
        return
      }
      setDialog({ kind: 'message', title: t('checkUpdate'), body: updateMessage(t, result.kind) })
      await loadLocal()
    } finally {
      setBusy(undefined)
    }
  }

  const runUninstall = async (identity: string, confirmed: boolean): Promise<void> => {
    if (!confirmed) {
      setDialog({ kind: 'uninstall', identity })
      return
    }
    setBusy(identity)
    try {
      const result = await uninstall(identity, true)
      setDialog(null)
      if (result.kind === 'uninstalled') {
        await loadLocal()
        return
      }
      setDialog({ kind: 'message', title: t('uninstall'), body: t('notManaged') })
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
          {local.map(skill => {
            const status = updateStatus.get(skill.identity)
            const gone = skill.sourceStatus === 'gone' || status?.kind === 'source-gone'
            return (
              <li key={skill.identity} className={css.card}>
                <div className={css.cardHead}>
                  <span className={css.name}>{skill.name}</span>
                </div>
                <div className={css.meta}>
                  <span>{t('localSource')}: {skill.source}</span>
                </div>
                {gone ? <p className={`${css.status} ${css.error}`}>{t('sourceGone')}</p> : null}
                {status?.kind === 'up-to-date' ? <p className={css.status}>{t('upToDate')}</p> : null}
                {status?.kind === 'update-available' ? <p className={css.status}>{t('updateAvailable')}</p> : null}
                {status?.kind === 'network-failure' ? (
                  <p className={`${css.status} ${css.error}`}>{t('updateNetwork')}</p>
                ) : null}
                {notices.get(skill.identity) !== undefined ? (
                  <p className={css.status}>{notices.get(skill.identity)}</p>
                ) : null}
                <div className={css.actions}>
                  <button
                    type="button"
                    className={css.btn}
                    disabled={busy === skill.identity || gone}
                    onClick={() => { void runUpdate(skill.identity, false) }}
                  >
                    {status?.kind === 'network-failure' ? t('retry') : t('checkUpdate')}
                  </button>
                  {status?.kind === 'update-available' ? (
                    <button
                      type="button"
                      className={`${css.btn} ${css.btnPrimary}`}
                      disabled={busy === skill.identity}
                      onClick={() => { setDialog({ kind: 'update', identity: skill.identity }) }}
                    >
                      {t('applyUpdate')}
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {dialog !== null ? (
        <DialogView
          t={t}
          dialog={dialog}
          busy={busy}
          onCancel={() => { setDialog(null) }}
          onConfirm={() => {
            if (dialog.kind === 'install') void runInstall(dialog.identity, true)
            else if (dialog.kind === 'update') void runUpdate(dialog.identity, true)
            else if (dialog.kind === 'uninstall') void runUninstall(dialog.identity, true)
            else setDialog(null)
          }}
        />
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

function DialogView({
  t, dialog, busy, onCancel, onConfirm,
}: {
  t: (key: SkillsShKey) => string
  dialog: Dialog
  busy: string | undefined
  onCancel: () => void
  onConfirm: () => void
}): ReactNode {
  const title = dialog.kind === 'install' ? t('confirmInstallTitle')
    : dialog.kind === 'update' ? t('confirmUpdateTitle')
      : dialog.kind === 'uninstall' ? t('confirmUninstallTitle')
        : dialog.title
  const body = dialog.kind === 'install'
    ? (dialog.coveringForeign ? t('confirmForeign') : t('confirmInstall'))
    : dialog.kind === 'update' ? t('confirmUpdate')
      : dialog.kind === 'uninstall' ? t('confirmUninstall')
        : dialog.body
  const messageOnly = dialog.kind === 'message'
  return (
    <div className={css.overlay} role="dialog" aria-modal="true">
      <div className={css.mask} onClick={onCancel} />
      <div className={css.panel}>
        <h3 className={css.panelTitle}>{title}</h3>
        <p className={css.panelBody}>{body}</p>
        <div className={css.panelActions}>
          {messageOnly ? (
            <button type="button" className={`${css.btn} ${css.btnPrimary}`} onClick={onCancel}>{t('close')}</button>
          ) : (
            <>
              <button type="button" className={css.btn} onClick={onCancel}>{t('cancel')}</button>
              <button
                type="button"
                className={`${css.btn} ${css.btnPrimary}`}
                disabled={busy !== undefined}
                onClick={onConfirm}
              >
                {t('confirm')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
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

function updateCheckMessage(t: (key: SkillsShKey) => string, kind: UpdateCheckResult['kind']): string {
  if (kind === 'source-gone') return t('sourceGone')
  if (kind === 'network-failure') return t('updateNetwork')
  if (kind === 'not-managed') return t('notManaged')
  if (kind === 'path-unsafe') return t('pathUnsafe')
  if (kind === 'no-match') return t('noMatch')
  if (kind === 'not-unique') return t('notUnique')
  return t('checkUpdate')
}

function updateMessage(t: (key: SkillsShKey) => string, kind: UpdateResult['kind']): string {
  if (kind === 'rolled-back') return t('rolledBack')
  if (kind === 'source-gone') return t('sourceGone')
  if (kind === 'network-failure') return t('updateNetwork')
  if (kind === 'path-unsafe') return t('pathUnsafe')
  if (kind === 'not-managed') return t('notManaged')
  if (kind === 'no-match') return t('noMatch')
  if (kind === 'not-unique') return t('notUnique')
  return t('checkUpdate')
}
