import type { QueueItem, ImageTask } from '@shared/types'
import ImageProgressTable from './ImageProgressTable'

interface GalleryDetailProps {
  item: QueueItem
  imageTasks: ImageTask[]
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onRetryFailed: () => void
  onRetryAll: () => void
  onRetryOriginal: () => void
  onCancel: () => void
  onRequeue: () => void
}

const CATEGORY_COLORS: Record<string, string> = {
  'Doujinshi': 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'Manga': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'Artist CG': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'Game CG': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'Western': 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  'Non-H': 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  'Image Set': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'Cosplay': 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'Asian Porn': 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
  'Misc': 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
}

function computeProgress(tasks: ImageTask[]): { done: number; total: number; percent: number } {
  if (tasks.length === 0) return { done: 0, total: 0, percent: 0 }
  const done = tasks.filter(t => t.status === 'done').length
  return { done, total: tasks.length, percent: Math.round((done / tasks.length) * 100) }
}

function computeOverallSpeed(tasks: ImageTask[]): number {
  return tasks
    .filter(t => t.status === 'fetching')
    .reduce((acc, t) => acc + t.speed, 0)
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '0 B/s'
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
}

export default function GalleryDetail({
  item, imageTasks, onStart, onPause, onResume, onRetryFailed, onRetryAll, onRetryOriginal, onCancel, onRequeue,
}: GalleryDetailProps) {
  const progress = computeProgress(imageTasks)
  const overallSpeed = computeOverallSpeed(imageTasks)
  const failedCount = imageTasks.filter(t => t.status === 'failed').length
  const categoryStyle = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS['Misc']

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 p-5 border-b border-zinc-200 dark:border-zinc-700/50">
        <div className="flex gap-4">
          <div className="shrink-0 w-20 h-28 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800
            shadow-sm">
            {item.thumbnailUrl ? (
              <img
                src={item.thumbnailUrl}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-300 dark:text-zinc-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18a1.5 1.5 0 001.5-1.5V5.25A1.5 1.5 0 0021 3.75H3A1.5 1.5 0 001.5 5.25v14.25A1.5 1.5 0 003 21z" />
                </svg>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <a
              href={`${item.thumbnailUrl.includes('exhentai') ? 'https://exhentai.org' : 'https://e-hentai.org'}/g/${item.gid}/${item.token}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold leading-snug line-clamp-2 mb-1
                text-zinc-900 dark:text-zinc-100
                hover:text-sky-600 dark:hover:text-sky-400
                transition-colors"
            >
              {item.title}
            </a>
            {item.subtitle && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mb-2">
                {item.subtitle}
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${categoryStyle}`}>
                {item.category}
              </span>
              <span className="text-zinc-400 dark:text-zinc-500">
                {item.uploader}
              </span>
              <span className="text-zinc-300 dark:text-zinc-600">|</span>
              <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                {item.pageCount} pages{(item.status === 'queued' || item.status === 'downloading') && (
                  <span className="text-zinc-400 dark:text-zinc-500">
                    {' '}(~{item.pageCount} limits)
                  </span>
                )}
              </span>
              <span className="text-zinc-300 dark:text-zinc-600">|</span>
              <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                {item.fileSize}
              </span>
              {item.pagesRange && item.pagesRange !== '' && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-600">|</span>
                  <span className="font-mono tabular-nums text-zinc-400 dark:text-zinc-500">
                    Range: {item.pagesRange}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-3">
              {imageTasks.length > 0 && (
                <span className="font-mono text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
                  {progress.done}/{progress.total}
                </span>
              )}
              {item.status === 'downloading' && overallSpeed > 0 && (
                <span className="font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                  {formatSpeed(overallSpeed)}
                </span>
              )}
              {failedCount > 0 && (
                <span className="text-[10px] font-medium text-red-500">
                  {failedCount} failed
                </span>
              )}
            </div>
            {imageTasks.length > 0 && (
              <span className="font-mono text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
                {progress.percent}%
              </span>
            )}
          </div>
          <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                item.status === 'completed'
                  ? 'bg-emerald-500'
                  : item.status === 'failed'
                    ? 'bg-red-500'
                    : item.status === 'paused' || item.status === 'canceled'
                      ? 'bg-amber-500'
                      : 'bg-sky-500'
              }`}
              style={{ width: `${item.status === 'completed' ? 100 : progress.percent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          {item.status === 'downloading' && (
            <button
              onClick={onPause}
              className="px-3 py-1.5 text-xs font-medium rounded-md
                bg-zinc-100 text-zinc-700 hover:bg-zinc-200
                dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700
                transition-colors active:scale-[0.98]"
            >
              Pause
            </button>
          )}
          {item.status === 'queued' && (
            <span className="px-3 py-1.5 text-xs font-medium text-zinc-400 dark:text-zinc-500">
              Waiting in queue...
            </span>
          )}
          {item.status === 'paused' && (
            <button
              onClick={onResume}
              className="px-3 py-1.5 text-xs font-medium rounded-md
                bg-emerald-600 text-white hover:bg-emerald-700
                transition-colors active:scale-[0.98]"
            >
              Resume
            </button>
          )}
          {failedCount > 0 && (
            <button
              onClick={onRetryFailed}
              className="px-3 py-1.5 text-xs font-medium rounded-md
                bg-amber-100 text-amber-800 hover:bg-amber-200
                dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60
                transition-colors active:scale-[0.98]"
            >
              Retry Failed ({failedCount})
            </button>
          )}
          {item.status === 'downloading' && imageTasks.length > 0 && progress.done < imageTasks.length && (
            <>
              <button
                onClick={onRetryAll}
                className="px-3 py-1.5 text-xs font-medium rounded-md
                  bg-violet-100 text-violet-800 hover:bg-violet-200
                  dark:bg-violet-900/40 dark:text-violet-300 dark:hover:bg-violet-900/60
                  transition-colors active:scale-[0.98]"
              >
                Retry All ({imageTasks.length - progress.done})
              </button>
              <button
                onClick={onRetryOriginal}
                className="px-3 py-1.5 text-xs font-medium rounded-md
                  bg-orange-100 text-orange-800 hover:bg-orange-200
                  dark:bg-orange-900/40 dark:text-orange-300 dark:hover:bg-orange-900/60
                  transition-colors active:scale-[0.98]"
                title="Retry non-done images using original (full-size) images. May consume GP/image limits."
              >
                Retry Original
              </button>
            </>
          )}
          {item.status === 'failed' && (
            <button
              onClick={onRequeue}
              className="px-3 py-1.5 text-xs font-medium rounded-md
                bg-sky-600 text-white hover:bg-sky-700
                transition-colors active:scale-[0.98]"
            >
              Retry
            </button>
          )}
          {item.status === 'canceled' && (
            <button
              onClick={onRequeue}
              className="px-3 py-1.5 text-xs font-medium rounded-md
                bg-sky-100 text-sky-700 hover:bg-sky-200
                dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-900/60
                transition-colors active:scale-[0.98]"
            >
              Re-queue
            </button>
          )}
          {item.status !== 'completed' && item.status !== 'canceled' && item.status !== 'failed' && (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-xs font-medium rounded-md
                text-zinc-500 hover:text-red-600 hover:bg-red-50
                dark:text-zinc-400 dark:hover:text-red-400 dark:hover:bg-red-950/30
                transition-colors active:scale-[0.98]"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ImageProgressTable tasks={imageTasks} />
      </div>
    </div>
  )
}
