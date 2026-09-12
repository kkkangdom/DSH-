import { describe, expect, it } from 'vitest'
import { readTarGz } from '../../src/steward/archive.ts'
import { packTarGz, skillMarkdown } from '../helpers.ts'

describe('readTarGz', () => {
  it('reads a GitHub tar.gz passed as a plain Uint8Array, the shape fetch().arrayBuffer() yields', async () => {
    const packed = await packTarGz({ 'grilling/SKILL.md': skillMarkdown('grilling') })
    const fromFetch = new Uint8Array(packed.byteLength)
    fromFetch.set(packed)
    const entries = await readTarGz(fromFetch)
    expect(entries.some(entry => entry.name.endsWith('grilling/SKILL.md'))).toBe(true)
  })
})
