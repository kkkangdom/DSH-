import type { IncomingMessage, ServerResponse } from 'node:http'
import type { SkillSteward } from '../steward/types.ts'

export const API_PREFIX = '/plugin/skills-sh'

export function createHandler(steward: SkillSteward): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://skills-sh')
      const pathname = url.pathname
      if (pathname === `${API_PREFIX}/search` && req.method === 'GET') {
        sendJson(res, 200, await steward.search(url.searchParams.get('q') ?? ''))
        return
      }
      sendJson(res, 404, { error: { code: 'not-found', message: pathname } })
    } catch (error) {
      sendJson(res, 400, { error: { code: 'bad-request', message: String(error) } })
    }
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(text)
}
