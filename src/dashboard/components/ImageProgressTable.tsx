import type { ImageTask } from '@shared/types'
import ImageProgressRow from './ImageProgressRow'

interface ImageProgressTableProps {
  tasks: ImageTask[]
}

export default function ImageProgressTable({ tasks }: ImageProgressTableProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-zinc-600">
        <svg className="w-8 h-8 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18a1.5 1.5 0 001.5-1.5V5.25A1.5 1.5 0 0021 3.75H3A1.5 1.5 0 001.5 5.25v14.25A1.5 1.5 0 003 21z" />
        </svg>
        <span className="text-xs">Waiting for download to start</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-[3rem_1fr_7rem_4rem_5.5rem] items-center gap-2 px-4 py-2
        text-[10px] font-medium uppercase tracking-wider
        text-zinc-400 dark:text-zinc-500
        border-b border-zinc-200 dark:border-zinc-700/50
        bg-zinc-50/50 dark:bg-zinc-900/50 sticky top-0 z-10">
        <span>#</span>
        <span>Filename</span>
        <span>Progress</span>
        <span className="text-right">Speed</span>
        <span className="text-right">Status</span>
      </div>
      <div className="overflow-y-auto flex-1">
        {tasks.map(task => (
          <ImageProgressRow key={`${task.galleryId}-${task.index}`} task={task} />
        ))}
      </div>
    </div>
  )
}
