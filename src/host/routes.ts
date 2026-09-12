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
      if (pathname === `${API_PREFIX}/local` && req.method === 'GET') {
        sendJson(res, 200, { skills: await steward.listLocal() })
        return
      }
      if (pathname === `${API_PREFIX}/install` && req.method === 'POST') {
        const body = await readIdentityBody(req)
        sendJson(res, 200, await steward.install(body.identity, { confirmed: body.confirmed }))
        return
      }
      if (pathname === `${API_PREFIX}/check-update` && req.method === 'POST') {
        const body = await readIdentityBody(req)
        sendJson(res, 200, await steward.checkUpdate(body.identity))
        return
      }
      if (pathname === `${API_PREFIX}/update` && req.method === 'POST') {
        const body = await readIdentityBody(req)
        sendJson(res, 200, await steward.update(body.identity, { confirmed: body.confirmed }))
        return
      }
      if (pathname === `${API_PREFIX}/uninstall` && req.method === 'POST') {
        const body = await readIdentityBody(req)
        sendJson(res, 200, await steward.uninstall(body.identity, { confirmed: body.confirmed }))
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

async function readIdentityBody(req: IncomingMessage): Promise<{ identity: string; confirmed?: boolean }> {
  const raw = await readBody(req)
  const parsed = JSON.parse(raw) as { identity?: unknown; confirmed?: unknown }
  if (typeof parsed.identity !== 'string' || parsed.identity === '') {
    throw new Error('identity is required')
  }
  return {
    identity: parsed.identity,
    ...(typeof parsed.confirmed === 'boolean' ? { confirmed: parsed.confirmed } : {}),
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 64 * 1024) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
