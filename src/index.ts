import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolveSkillsRoot } from './home.ts'
import { createGitHubArchives } from './host/archives.ts'
import { createSkillsShDirectory } from './host/directory.ts'
import { API_PREFIX, connectionFetchRoutes, createHandler } from './host/routes.ts'
import { createSkillSteward } from './steward/index.ts'

export const name = 'skills-sh'

export const inject = ['webServer', 'connection']

export { API_PREFIX }

/** The host-side slice of Cordis this plugin uses. */
export type HostContext = {
  effect(callback: () => (() => void) | void, name?: string): void
  webServer: {
    register(route: {
      kind: 'prefix' | 'exact'
      path: string
      handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
    }): () => void
  }
  connection: {
    fetch: {
      register(route: {
        path: string
        methods: readonly ('GET' | 'HEAD' | 'POST')[]
        requestBody: 'buffered' | 'streaming'
        fetch: (request: Request) => Promise<Response>
      }): () => Promise<void>
    }
  }
}

/** Mount the Skills.sh steward behind the plugin HTTP routes. */
export function apply(ctx: HostContext): void {
  const steward = createSkillSteward({
    skillsRoot: resolveSkillsRoot(),
    directory: createSkillsShDirectory(),
    archives: createGitHubArchives(),
  })
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'prefix',
      path: API_PREFIX,
      handler: createHandler(steward),
    }),
    'skills-sh: routes',
  )
  for (const route of connectionFetchRoutes(steward)) {
    ctx.connection.fetch.register(route)
  }
}
