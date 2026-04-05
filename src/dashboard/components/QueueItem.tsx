import type { QueueItem as QueueItemType } from '@shared/types'

interface QueueItemProps {
  item: QueueItemType
  isSelected: boolean
  onSelect: () => void
  onRemove: () => void
}

const STATUS_DOT: Record<QueueItemType['status'], string> = {
  queued: 'bg-zinc-400 dark:bg-zinc-500',
  downloading: 'bg-sky-500 animate-pulse',
  paused: 'bg-amber-500',
  completed: 'bg-emerald-500',
  failed: 'bg-red-500',
  canceled: 'bg-zinc-400 dark:bg-zinc-500',
}

const STATUS_LABEL: Record<QueueItemType['status'], string> = {
  queued: 'Queued',
  downloading: 'Downloading',
  paused: 'Paused',
  completed: 'Completed',
  failed: 'Failed',
  canceled: 'Canceled',
}

export default function QueueItemCard({ item, isSelected, onSelect, onRemove }: QueueItemProps) {
  return (
    <div
      onClick={onSelect}
      className={`
        group relative flex items-start gap-2.5 px-3 py-2.5 cursor-pointer
        border-l-2 transition-all duration-150
        ${isSelected
          ? 'border-l-sky-500 bg-sky-50/80 dark:bg-sky-950/30'
          : 'border-l-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
        }
      `}
    >
      <div className="shrink-0 w-10 h-14 rounded overflow-hidden bg-zinc-100 dark:bg-zinc-800 mt-0.5">
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-300 dark:text-zinc-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18a1.5 1.5 0 001.5-1.5V5.25A1.5 1.5 0 0021 3.75H3A1.5 1.5 0 001.5 5.25v14.25A1.5 1.5 0 003 21z" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium leading-snug line-clamp-2
          ${isSelected
            ? 'text-zinc-900 dark:text-zinc-100'
            : 'text-zinc-700 dark:text-zinc-300'
          }`}
        >
          {item.title}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[item.status]}`} />
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {STATUS_LABEL[item.status]}
          </span>
          <span className="text-[10px] text-zinc-300 dark:text-zinc-600 mx-0.5">|</span>
          <span className="text-[10px] font-mono tabular-nums text-zinc-400 dark:text-zinc-500">
            {item.pageCount}p
          </span>
          {item.tag && (
            <>
              <span className="text-[10px] text-zinc-300 dark:text-zinc-600 mx-0.5">|</span>
              <span className="text-[10px] font-medium text-orange-500 dark:text-orange-400">
                {item.tag}
              </span>
            </>
          )}
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="absolute top-1.5 right-1.5 p-1 rounded
          opacity-0 group-hover:opacity-100
          text-zinc-400 hover:text-red-500 hover:bg-red-50
          dark:hover:text-red-400 dark:hover:bg-red-950/30
          transition-all"
        title="Remove"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
