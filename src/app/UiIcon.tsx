type UiIconName = 'library' | 'sparkles' | 'sets' | 'info' | 'music' | 'back' | 'close'

export function UiIcon({ name, className = '' }: { name: UiIconName; className?: string }) {
  const paths = name === 'library' ? <><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h8M8 16h5" /></>
    : name === 'sparkles' ? <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" /><path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z" /></>
      : name === 'sets' ? <><path d="M7 6h13M7 12h13M7 18h13" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>
        : name === 'info' ? <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>
          : name === 'music' ? <><path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></>
            : name === 'back' ? <path d="m15 18-6-6 6-6" />
              : <path d="m7 7 10 10M17 7 7 17" />

  return <svg className={`ui-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths}</svg>
}
