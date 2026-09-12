import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { SkillsShSection } from './SkillsShSection.tsx'
import type { SkillsShSectionInjected } from './SkillsShSection.tsx'
import { en, NS, zh, type SkillsShKey } from './locales.ts'
import type { InstallResult, LocalSkill, SearchResult } from '../steward/types.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.skillsSh': SkillsShKey
  }
}

export { NS }

export const inject = ['slots', 'locale']

const API = '/plugin/skills-sh'

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`request failed with status ${response.status}`)
  return await response.json() as T
}

function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  })
}

const api: SkillsShSectionInjected = {
  async search(query) {
    return readJson<SearchResult>(await fetch(`${API}/search?q=${encodeURIComponent(query)}`, {
      headers: { accept: 'application/json' },
    }))
  },
  async listLocal() {
    const body = await readJson<{ skills: LocalSkill[] }>(await fetch(`${API}/local`, {
      headers: { accept: 'application/json' },
    }))
    return body.skills
  },
  async install(identity, confirmed) {
    return readJson<InstallResult>(await post(`${API}/install`, { identity, confirmed }))
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
