import type { ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './SkillsShSection.module.css'

export type SkillsShSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.skillsSh'>

export function SkillsShSection(props: SkillsShSectionProps): ReactNode {
  const { t } = props
  return (
    <section className={css.section}>
      <h2 className={css.heading}>{t('title')}</h2>
      <p className={css.intro}>{t('intro')}</p>
    </section>
  )
}
