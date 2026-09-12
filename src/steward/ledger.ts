import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ledgerPath, systemDir } from './paths.ts'

export type LedgerEntry = {
  readonly identity: string
  readonly source: string
  readonly slug: string
  readonly contentHash: string
  readonly sourceStatus: 'ok' | 'gone'
}

export type Ledger = {
  readonly version: 1
  readonly skills: Record<string, LedgerEntry>
}

export async function readLedger(skillsRoot: string): Promise<Ledger> {
  try {
    const raw = await readFile(ledgerPath(skillsRoot), 'utf8')
    const parsed = JSON.parse(raw) as Partial<Ledger>
    if (parsed.version !== 1 || typeof parsed.skills !== 'object' || parsed.skills === null) {
      return emptyLedger()
    }
    return { version: 1, skills: parsed.skills }
  } catch {
    return emptyLedger()
  }
}

export async function writeLedger(skillsRoot: string, ledger: Ledger): Promise<void> {
  const file = ledgerPath(skillsRoot)
  await mkdir(path.dirname(file), { recursive: true })
  const tmp = file + '.tmp'
  await writeFile(tmp, JSON.stringify(ledger, null, 2) + '\n', 'utf8')
  await rename(tmp, file)
}

export function emptyLedger(): Ledger {
  return { version: 1, skills: {} }
}

export function upsertSkill(ledger: Ledger, entry: LedgerEntry): Ledger {
  const skills = { ...ledger.skills }
  for (const [identity, existing] of Object.entries(skills)) {
    if (existing.slug === entry.slug && identity !== entry.identity) delete skills[identity]
  }
  skills[entry.identity] = entry
  return { version: 1, skills }
}

export function removeSkill(ledger: Ledger, identity: string): Ledger {
  const skills = { ...ledger.skills }
  delete skills[identity]
  return { version: 1, skills }
}

export function entryBySlug(ledger: Ledger, slug: string): LedgerEntry | undefined {
  return Object.values(ledger.skills).find(entry => entry.slug === slug)
}

export async function removeSystemIfEmpty(skillsRoot: string): Promise<void> {
  const dir = systemDir(skillsRoot)
  try {
    await rm(dir, { recursive: true, force: true })
  } catch {
    // ignore
  }
}
