import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { SkillsShSection } from './SkillsShSection.tsx'
import type { SkillsShSectionInjected } from './SkillsShSection.tsx'
import { en, NS, zh, type SkillsShKey } from './locales.ts'
import type {
  InstallResult,
  LocalSkill,
  SearchResult,
  UninstallResult,
  UpdateCheckResult,
  UpdateResult,
} from '../steward/types.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.skillsSh': SkillsShKey
  }
}

export { NS }

export const inject = ['slots', 'locale']

const API = '/api/skills-sh'

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!response.ok) throw new Error(`request failed with status ${response.status}`)
  return JSON.parse(text) as T
}

function get(path: string): Promise<Response> {
  return fetch(path, {
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  })
}

function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  })
}

const api: SkillsShSectionInjected = {
  async search(query) {
    return readJson<SearchResult>(await get(`${API}/search?q=${encodeURIComponent(query)}`))
  },
  async listLocal() {
    const body = await readJson<{ skills: LocalSkill[] }>(await get(`${API}/local`))
    return body.skills
  },
  async install(identity, confirmed) {
    return readJson<InstallResult>(await post(`${API}/install`, { identity, confirmed }))
  },
  async checkUpdate(identity) {
    return readJson<UpdateCheckResult>(await post(`${API}/check-update`, { identity }))
  },
  async update(identity, confirmed) {
    return readJson<UpdateResult>(await post(`${API}/update`, { identity, confirmed }))
  },
  async uninstall(identity, confirmed) {
    return readJson<UninstallResult>(await post(`${API}/uninstall`, { identity, confirmed }))
  },
}

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'skills-sh: dictionaries')
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'skills-sh',
    order: 22,
    label: () => ctx.locale.bind(NS)('nav'),
    locale: NS,
    inject: () => api,
  }, SkillsShSection))
}
