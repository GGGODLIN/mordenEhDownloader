import type { ImageTask } from '@shared/types'

interface ImageProgressRowProps {
  task: ImageTask
}

const STATUS_CONFIG: Record<ImageTask['status'], { label: string; color: string; barColor: string }> = {
  pending: {
    label: 'Pending',
    color: 'text-zinc-400 dark:text-zinc-500',
    barColor: 'bg-zinc-200 dark:bg-zinc-700',
  },
  fetching: {
    label: 'Fetching',
    color: 'text-sky-600 dark:text-sky-400',
    barColor: 'bg-sky-500',
  },
  hashing: {
    label: 'Hashing',
    color: 'text-violet-600 dark:text-violet-400',
    barColor: 'bg-violet-500',
  },
  done: {
    label: 'Done',
    color: 'text-emerald-600 dark:text-emerald-400',
    barColor: 'bg-emerald-500',
  },
  failed: {
    label: 'Failed',
    color: 'text-red-500 dark:text-red-400',
    barColor: 'bg-red-500',
  },
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return ''
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
}

export default function ImageProgressRow({ task }: ImageProgressRowProps) {
  const config = STATUS_CONFIG[task.status]
  const percent = Math.round(task.progress * 100)
  const displayName = task.imageName ?? `page_${String(task.realIndex).padStart(4, '0')}`
  const speed = formatSpeed(task.speed)

  return (
    <div className="grid grid-cols-[3rem_1fr_7rem_4rem_5.5rem] items-center gap-2 px-4 py-1.5
      text-sm border-b border-zinc-100 dark:border-zinc-800/50
      hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
      <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
        #{task.realIndex}
      </span>

      <span className="truncate text-zinc-700 dark:text-zinc-300 text-xs" title={displayName}>
        {displayName}
      </span>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${config.barColor}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500 w-8 text-right">
          {task.status === 'done' ? '' : task.status === 'pending' ? '' : `${percent}%`}
        </span>
      </div>

      <span className="font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500 text-right truncate">
        {speed}
      </span>

      <span className={`text-xs font-medium text-right ${config.color}`}>
        {config.label}
        {task.status === 'failed' && task.retryCount > 0 && (
          <span className="text-[10px] ml-1 opacity-60">x{task.retryCount}</span>
        )}
      </span>
    </div>
  )
}
