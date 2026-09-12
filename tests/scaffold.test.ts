import { describe, expect, it } from 'vitest'
import { name } from '../src/index.ts'

describe('plugin scaffold', () => {
  it('exports the skills-sh bundle name', () => {
    expect(name).toBe('skills-sh')
  })
})
