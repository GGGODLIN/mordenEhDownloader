interface HeaderProps {
  imageLimitsCurrent: number
  imageLimitsTotal: number
  estimatedCost?: number
  onOpenSettings: () => void
}

export default function Header({ imageLimitsCurrent, imageLimitsTotal, estimatedCost, onOpenSettings }: HeaderProps) {
  const projected = imageLimitsCurrent + (estimatedCost ?? 0)
  const limitsPercent = imageLimitsTotal > 0 ? (imageLimitsCurrent / imageLimitsTotal) * 100 : 0
  const isNearLimit = limitsPercent > 80 || (imageLimitsTotal > 0 && projected > imageLimitsTotal)
  const hasLimitsData = imageLimitsTotal > 0

  return (
    <header className="flex items-center justify-between h-12 px-4
      border-b border-zinc-200 dark:border-zinc-700/50
      bg-white dark:bg-zinc-900">
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-md bg-zinc-900 dark:bg-zinc-100
          flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-white dark:text-zinc-900" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </div>
        <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          EH Downloader
        </span>
      </div>

      <div className="flex items-center gap-3">
        {hasLimitsData && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md
            bg-zinc-50 dark:bg-zinc-800">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Limits
            </span>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isNearLimit ? 'bg-red-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(limitsPercent, 100)}%` }}
                />
              </div>
              <span className={`font-mono text-[10px] tabular-nums ${
                isNearLimit
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}>
                {imageLimitsCurrent.toLocaleString()}/{imageLimitsTotal.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-md
            text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100
            dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-800
            transition-colors active:scale-[0.95]"
          title="Settings"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </header>
  )
}
