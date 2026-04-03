import type { QueueItem, ImageTask } from '@shared/types'
import GalleryDetail from './GalleryDetail'
import Banner from './Banner'

interface BannerData {
  type: 'error' | 'warning' | 'info'
  message: string
}

interface MainAreaProps {
  selectedItem: QueueItem | null
  imageTasks: ImageTask[]
  banner: BannerData | null
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onRetryFailed: () => void
  onRetryAll: () => void
  onRetryOriginal: () => void
  onCancel: () => void
  onRequeue: () => void
  onDismissBanner: () => void
}

export default function MainArea({
  selectedItem, imageTasks, banner,
  onStart, onPause, onResume, onRetryFailed, onRetryAll, onRetryOriginal, onCancel, onRequeue, onDismissBanner,
}: MainAreaProps) {
  return (
    <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-900">
      {banner && (
        <Banner
          type={banner.type}
          message={banner.message}
          onDismiss={onDismissBanner}
        />
      )}

      {selectedItem ? (
        <GalleryDetail
          item={selectedItem}
          imageTasks={imageTasks}
          onStart={onStart}
          onPause={onPause}
          onResume={onResume}
          onRetryFailed={onRetryFailed}
          onRetryAll={onRetryAll}
          onRetryOriginal={onRetryOriginal}
          onCancel={onCancel}
          onRequeue={onRequeue}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="flex flex-col items-center max-w-xs text-center">
            <div className="w-16 h-16 mb-5 rounded-2xl bg-zinc-100 dark:bg-zinc-800
              flex items-center justify-center">
              <svg className="w-7 h-7 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              No gallery selected
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
              Select a gallery from the sidebar to view its download progress and details.
              Add galleries by visiting E-Hentai and clicking the download button on any gallery page.
            </p>
          </div>
        </div>
      )}
    </main>
  )
}
