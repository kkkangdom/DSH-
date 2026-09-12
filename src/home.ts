import os from 'node:os'
import path from 'node:path'

/** `$DSH_HOME/skills`, defaulting `$DSH_HOME` to `~/.dsh`. */
export function resolveSkillsRoot(
  env: NodeJS.ProcessEnv = process.env,
  homedir: string = os.homedir(),
): string {
  const configured = env.DSH_HOME?.trim()
  const home = configured !== undefined && configured !== '' ? configured : path.join(homedir, '.dsh')
  return path.join(home, 'skills')
}
