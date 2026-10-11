import { useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from 'react'
import { Icon, type IconName } from './Icon'

type Variant = 'primary' | 'soft' | 'ghost' | 'outline' | 'danger'

export function Button({
  variant = 'soft',
  icon,
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: IconName; size?: 'sm' | 'md' | 'lg' }) {
  const v: Record<Variant, string> = {
    primary: 'bg-accent text-accent-ink hover:brightness-105 shadow-sm',
    soft: 'bg-surface-2 text-ink hover:brightness-[0.97] dark:hover:brightness-110',
    ghost: 'text-ink hover:bg-surface-2',
    outline: 'border border-line text-ink hover:bg-surface-2',
    danger: 'bg-peach-soft text-peach hover:brightness-[0.97]',
  }
  const s = { sm: 'min-h-9 px-3 text-sm gap-1.5', md: 'min-h-11 px-4 gap-2', lg: 'min-h-14 px-6 text-lg gap-2.5' }[size]
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-2xl font-medium transition active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none ${v[variant]} ${s} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 22 : size === 'sm' ? 16 : 18} />}
      {children}
    </button>
  )
}

export function IconButton({
  icon,
  label,
  className = '',
  size = 20,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; size?: number }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-full min-w-11 min-h-11 text-muted hover:text-ink hover:bg-surface-2 transition active:scale-95 ${className}`}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  )
}

export function Chip({
  active,
  children,
  onClick,
  className = '',
  tone = 'accent',
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
  className?: string
  tone?: 'accent' | 'lav' | 'sun' | 'peach'
}) {
  const on = {
    accent: 'bg-accent text-accent-ink border-accent',
    lav: 'bg-lav-soft text-ink border-lav ring-1 ring-lav',
    sun: 'bg-sun-soft text-ink border-sun ring-1 ring-sun',
    peach: 'bg-peach-soft text-ink border-peach ring-1 ring-peach',
  }[tone]
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-10 px-3.5 rounded-full border text-sm font-medium transition active:scale-95 ${
        active ? on : 'border-line bg-surface text-ink hover:bg-surface-2'
      } ${className}`}
    >
      {children}
    </button>
  )
}

export function Badge({ children, tone = 'muted', className = '' }: { children: ReactNode; tone?: 'muted' | 'accent' | 'lav' | 'sun' | 'peach' | 'sky'; className?: string }) {
  const t = {
    muted: 'bg-surface-2 text-muted',
    accent: 'bg-accent-soft text-accent',
    lav: 'bg-lav-soft text-lav',
    sun: 'bg-sun-soft text-sun',
    peach: 'bg-peach-soft text-peach',
    sky: 'bg-sky-soft text-ink',
  }[tone]
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${t} ${className}`}>{children}</span>
}

/** Arkusz: na telefonie wyjeżdża od dołu, na desktopie jest okienkiem na środku. */
export function Sheet({
  open,
  onClose,
  children,
  title,
  wide,
  labelledBy,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: ReactNode
  wide?: boolean
  labelledBy?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <div className="absolute inset-0 bg-black/35 dark:bg-black/55 anim-fade" onClick={onClose} />
      <div
        ref={ref}
        className={`relative w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} max-h-[92dvh] overflow-y-auto bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl anim-sheet sm:anim-pop safe-bottom`}
      >
        <div className="sm:hidden flex justify-center pt-2.5">
          <div className="h-1.5 w-10 rounded-full bg-line" />
        </div>
        {title && (
          <div className="flex items-center justify-between px-5 pt-3 sm:pt-5">
            <h2 id={labelledBy} className="text-lg font-semibold">
              {title}
            </h2>
            <IconButton icon="x" label="Zamknij" onClick={onClose} />
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T
  options: Array<{ value: T; label: ReactNode }>
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div role="tablist" className={`inline-flex p-1 rounded-2xl bg-surface-2 gap-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 px-3.5 rounded-xl text-sm font-medium transition ${
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Empty({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="text-center py-12 px-6 anim-pop">
      <div className="text-5xl mb-3" aria-hidden>
        {emoji}
      </div>
      <p className="font-semibold text-lg">{title}</p>
      {children && <div className="text-muted mt-1.5 max-w-sm mx-auto">{children}</div>}
    </div>
  )
}

export function Section({
  title,
  count,
  children,
  collapsible,
  defaultOpen = true,
  action,
}: {
  title: ReactNode
  count?: number
  children: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  action?: ReactNode
}) {
  const id = useRef('s' + Math.random().toString(36).slice(2)).current
  const [open, setOpen] = useLocalToggle(typeof title === 'string' ? `section:${title}` : id, defaultOpen)
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-2 px-1">
        {collapsible ? (
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink min-h-10">
            <Icon name={open ? 'chevronDown' : 'chevronRight'} size={16} />
            {title}
            {count != null && <span className="font-normal">({count})</span>}
          </button>
        ) : (
          <h2 className="text-sm font-semibold text-muted flex items-center gap-1.5 min-h-10">
            {title}
            {count != null && <span className="font-normal">({count})</span>}
          </h2>
        )}
        {action}
      </div>
      {(!collapsible || open) && children}
    </section>
  )
}


export function useLocalToggle(key: string, def: boolean): [boolean, (v: boolean) => void] {
  const [v, setV] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('ui:' + key)
      return raw == null ? def : raw === '1'
    } catch {
      return def
    }
  })
  return [
    v,
    (nv: boolean) => {
      setV(nv)
      try {
        localStorage.setItem('ui:' + key, nv ? '1' : '0')
      } catch {
        /* ignoruj */
      }
    },
  ]
}
