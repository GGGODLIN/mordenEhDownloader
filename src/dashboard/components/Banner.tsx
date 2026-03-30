interface BannerAction {
  label: string
  onClick: () => void
}

interface BannerProps {
  type: 'error' | 'warning' | 'info'
  message: string
  action?: BannerAction
  onDismiss?: () => void
}

const BANNER_STYLES: Record<BannerProps['type'], string> = {
  error: [
    'bg-red-50 border-red-200 text-red-800',
    'dark:bg-red-950/60 dark:border-red-500/30 dark:text-red-200',
  ].join(' '),
  warning: [
    'bg-amber-50 border-amber-200 text-amber-800',
    'dark:bg-amber-950/60 dark:border-amber-500/30 dark:text-amber-200',
  ].join(' '),
  info: [
    'bg-sky-50 border-sky-200 text-sky-800',
    'dark:bg-sky-950/60 dark:border-sky-500/30 dark:text-sky-200',
  ].join(' '),
}

const ICON_PATHS: Record<BannerProps['type'], string> = {
  error: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
  warning: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  info: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
}

export default function Banner({ type, message, action, onDismiss }: BannerProps) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 border-b text-sm ${BANNER_STYLES[type]}`}>
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[type]} />
      </svg>
      <span className="flex-1 min-w-0 truncate">{message}</span>
      {action && (
        <button
          onClick={action.onClick}
          className="shrink-0 px-2.5 py-1 text-xs font-medium rounded
            bg-white/10 hover:bg-white/20 transition-colors"
        >
          {action.label}
        </button>
      )}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
