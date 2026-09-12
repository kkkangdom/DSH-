import { execFile } from 'node:child_process'
import { describe, expect, it } from 'vitest'

/**
 * DSH loads lib/index.js as native ESM. Bundling tar-stream into that file
 * made Node throw "Dynamic require of events is not supported".
 */
describe('host bundle', () => {
  it('loads as native ESM without dynamic-require of node builtins', async () => {
    const href = new URL('../lib/index.js', import.meta.url).href
    const { stdout, stderr, code } = await new Promise<{
      stdout: string
      stderr: string
      code: number
    }>((resolve) => {
      execFile(
        process.execPath,
        ['--input-type=module', '-e', `import(${JSON.stringify(href)}).then(m => console.log(m.name))`],
        (error, stdout, stderr) => {
          resolve({
            stdout,
            stderr,
            code: error && typeof error.code === 'number' ? error.code : 0,
          })
        },
      )
    })
    expect(stderr, stderr).not.toMatch(/Dynamic require/)
    expect(code).toBe(0)
    expect(stdout.trim()).toBe('skills-sh')
  })
})
