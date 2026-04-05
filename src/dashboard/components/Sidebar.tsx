import { useState, useEffect } from 'react'
import type { QueueItem as QueueItemType } from '@shared/types'
import QueueItemCard from './QueueItem'

const PAGE_SIZE = 50

interface SidebarProps {
  queue: QueueItemType[]
  history: QueueItemType[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onRetryAllFailed: () => void
}

type Tab = 'queue' | 'history'

export default function Sidebar({ queue, history, selectedId, onSelect, onRemove, onRetryAllFailed }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab>('queue')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const items = activeTab === 'queue' ? queue : history

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [activeTab])

  const visibleItems = items.slice(0, visibleCount)
  const hasMore = visibleCount < items.length

  return (
    <aside className="flex flex-col w-64 shrink-0 border-r border-zinc-200 dark:border-zinc-700/50
      bg-zinc-50/50 dark:bg-zinc-900/50">
      <div className="flex border-b border-zinc-200 dark:border-zinc-700/50">
        <button
          onClick={() => setActiveTab('queue')}
          className={`flex-1 px-4 py-2.5 text-xs font-medium tracking-wide transition-colors relative
            ${activeTab === 'queue'
              ? 'text-zinc-900 dark:text-zinc-100'
              : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
        >
          Queue
          {queue.length > 0 && (
            <span className="ml-1.5 font-mono tabular-nums text-[10px] px-1.5 py-0.5 rounded-full
              bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400">
              {queue.length}
            </span>
          )}
          {activeTab === 'queue' && (
            <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 px-4 py-2.5 text-xs font-medium tracking-wide transition-colors relative
            ${activeTab === 'history'
              ? 'text-zinc-900 dark:text-zinc-100'
              : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
        >
          History
          {history.length > 0 && (
            <span className="ml-1.5 font-mono tabular-nums text-[10px] px-1.5 py-0.5 rounded-full
              bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400">
              {history.length}
            </span>
          )}
          {activeTab === 'history' && (
            <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
          )}
        </button>
      </div>

      {activeTab === 'queue' && queue.some(item => item.status === 'failed') && (
        <div className="px-2 py-1.5 border-b border-zinc-200 dark:border-zinc-700/50">
          <button
            onClick={onRetryAllFailed}
            className="w-full px-2.5 py-1.5 text-[10px] font-medium rounded-md
              text-amber-600 dark:text-amber-400
              bg-amber-50 dark:bg-amber-900/20
              hover:bg-amber-100 dark:hover:bg-amber-900/30
              transition-colors"
          >
            Retry All Failed ({queue.filter(item => item.status === 'failed').length})
          </button>
        </div>
      )}

      <div key={activeTab} className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <svg className="w-8 h-8 mb-3 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              {activeTab === 'queue' ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
              {activeTab === 'queue'
                ? 'No downloads in queue. Visit a gallery page and click the download button to get started.'
                : 'Completed downloads will appear here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
            {visibleItems.map(item => (
              <QueueItemCard
                key={item.id}
                item={item}
                isSelected={item.id === selectedId}
                onSelect={() => onSelect(item.id)}
                onRemove={() => onRemove(item.id)}
              />
            ))}
            {hasMore && (
              <button
                onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                className="w-full py-2.5 text-[10px] font-medium
                  text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50
                  dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-800/40
                  transition-colors"
              >
                Show more ({items.length - visibleCount} remaining)
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
