import { mkdir, rename, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type { ArchiveFile } from './archive.ts'
import { ORIGIN_FILE, resolveInside, systemDir } from './paths.ts'

export type OriginInfo = {
  readonly identity: string
  readonly source: string
  readonly slug: string
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

export async function replaceBundle(
  skillsRoot: string,
  dest: string,
  files: readonly ArchiveFile[],
  origin: OriginInfo,
  afterReplace?: () => Promise<void>,
): Promise<void> {
  const staging = path.join(systemDir(skillsRoot), 'staging', `${path.basename(dest)}-${randomUUID()}`)
  await mkdir(staging, { recursive: true })
  let backup: string | undefined
  let moved = false
  try {
    await writeTree(staging, files)
    await writeFile(path.join(staging, ORIGIN_FILE), JSON.stringify(origin, null, 2) + '\n', 'utf8')
    if (await pathExists(dest)) {
      backup = path.join(systemDir(skillsRoot), 'backup', `${path.basename(dest)}-${randomUUID()}`)
      await mkdir(path.dirname(backup), { recursive: true })
      await rename(dest, backup)
    }
    await mkdir(path.dirname(dest), { recursive: true })
    await rename(staging, dest)
    moved = true
    if (afterReplace !== undefined) await afterReplace()
    if (backup !== undefined) await rm(backup, { recursive: true, force: true })
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    if (backup !== undefined && moved) {
      await rm(dest, { recursive: true, force: true })
      await rename(backup, dest)
    } else if (backup !== undefined && !moved) {
      if (!(await pathExists(dest))) await rename(backup, dest)
    }
    throw error
  }
}

export async function removeBundle(dest: string): Promise<void> {
  await rm(dest, { recursive: true, force: true })
}

export async function cleanupSystemIfNoLedger(skillsRoot: string, ledgerFile: string): Promise<void> {
  if (await pathExists(ledgerFile)) return
  await rm(systemDir(skillsRoot), { recursive: true, force: true })
}

async function writeTree(root: string, files: readonly ArchiveFile[]): Promise<void> {
  for (const file of files) {
    const abs = resolveInside(root, file.path)
    if (abs === undefined) throw new Error('path-unsafe')
    if (file.type === 'symlink') {
      if (file.linkpath === undefined) throw new Error('path-unsafe')
      await mkdir(path.dirname(abs), { recursive: true })
      await symlink(file.linkpath, abs)
      continue
    }
    await mkdir(path.dirname(abs), { recursive: true })
    await writeFile(abs, file.content)
  }
}
