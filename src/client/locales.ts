export const NS = 'settings.skillsSh' as const

export const zh = {
  nav: 'Skills.sh',
  title: 'Skills.sh',
  intro: '按关键词搜索 Skills.sh，把 GitHub 来源的技能安装到 DSH 技能目录，并管理本插件装过的本机技能。',
  searchLabel: '搜索技能',
  searchPlaceholder: '输入至少 2 个字符',
  needKeywords: '请输入至少 2 个字符的关键词。不会拉取排行榜。',
  searching: '正在搜索…',
  empty: '没有找到匹配的技能，请换个关键词。',
  networkFailure: '网络失败，请稍后重试。这不是来源失效。',
  retry: '重试',
  installs: '安装量',
  source: '来源',
  openPage: '在 Skills.sh 打开',
  install: '安装',
  unsupported: '仅支持 GitHub 来源',
  descriptionUnavailable: '简介暂不可用',
} as const

export const en = {
  nav: 'Skills.sh',
  title: 'Skills.sh',
  intro: 'Search Skills.sh by keyword, install GitHub-sourced skills into the DSH skills directory, and manage local skills this plugin installed.',
  searchLabel: 'Search skills',
  searchPlaceholder: 'Type at least 2 characters',
  needKeywords: 'Enter at least 2 characters. The trending list is not loaded.',
  searching: 'Searching…',
  empty: 'No matching skills. Try another keyword.',
  networkFailure: 'Network failure. Retry later. This is not a gone source.',
  retry: 'Retry',
  installs: 'Installs',
  source: 'Source',
  openPage: 'Open on Skills.sh',
  install: 'Install',
  unsupported: 'GitHub sources only',
  descriptionUnavailable: 'Description unavailable',
} as const

export type SkillsShKey = keyof typeof zh
