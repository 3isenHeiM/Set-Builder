import { useId, useState, type ReactNode } from 'react'
import { UiIcon } from '../../app/UiIcon'
import { useI18n } from '../../app/i18n'

export function SetCard({ number, title, count, actions, children }: {
  number: number
  title: string
  count: number
  actions?: ReactNode
  children: ReactNode
}) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(true)
  const id = useId()
  const name = title.trim() || `${t('set')} ${number}`

  return <section className="set-card" aria-labelledby={`${id}-toggle`}>
    <div className="set-card-header set-fold-header">
      <h2 className="set-fold-heading">
        <button id={`${id}-toggle`} type="button" className="set-fold-toggle" aria-label={t(expanded ? 'collapseSet' : 'expandSet', { name })} aria-expanded={expanded} aria-controls={`${id}-content`} onClick={() => setExpanded((value) => !value)}>
          <span className="set-fold-copy"><span className="set-fold-label">{t('set')} {number} · {count} {t(count === 1 ? 'piece' : 'pieces')}</span><span className="set-fold-title">{name}</span></span>
          <UiIcon name="down" className="set-fold-chevron" />
        </button>
      </h2>
      {actions}
    </div>
    <div id={`${id}-content`} className="set-card-content" hidden={!expanded}>{children}</div>
  </section>
}
