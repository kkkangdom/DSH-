export const NS = 'settings.skillsSh' as const

export const zh = {
  nav: 'Skills.sh',
  title: 'Skills.sh',
  intro: '按关键词搜索 Skills.sh，把 GitHub 来源的技能安装到 DSH 技能目录，并管理本插件装过的本机技能。',
} as const

export const en = {
  nav: 'Skills.sh',
  title: 'Skills.sh',
  intro: 'Search Skills.sh by keyword, install GitHub-sourced skills into the DSH skills directory, and manage local skills this plugin installed.',
} as const

export type SkillsShKey = keyof typeof zh
