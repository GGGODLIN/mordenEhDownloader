import { useState, useEffect, useCallback } from 'react'
import { storage } from '@shared/storage'
import { useQueue, useHistory, useSettings } from './hooks/useStorage'
import { useImageLimits } from './hooks/useImageLimits'
import { useDownloadEngine } from './hooks/useDownloadEngine'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import MainArea from './components/MainArea'
import SettingsModal from './components/SettingsModal'

export default function App() {
  const queue = useQueue()
  const history = useHistory()
  const settings = useSettings()
  const imageLimits = useImageLimits()
  const { getImageTasks, getBanner, start, pause, resume, retryFailed, cancel } = useDownloadEngine(settings)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(new Set())

  useEffect(() => {
    const hasDownloading = queue.some(item => item.status === 'downloading')
    if (!hasDownloading) return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [queue])

  const handleRemove = useCallback((id: string) => {
    const queueItem = queue.find(q => q.id === id)
    if (queueItem) {
      if (queueItem.status === 'downloading' || queueItem.status === 'paused') {
        cancel(queueItem.gid)
      }
      storage.setQueue(queue.filter(q => q.id !== id))
    } else {
      storage.setHistory(history.filter(h => h.id !== id))
    }
    if (selectedId === id) {
      setSelectedId(null)
    }
  }, [queue, history, selectedId, cancel])

  const estimatedCost = queue
    .filter(item => item.status === 'queued' || item.status === 'downloading')
    .reduce((sum, item) => sum + item.pageCount, 0)

  const selectedItem = [...queue, ...history].find(item => item.id === selectedId) ?? null

  const imageTasks = selectedItem ? getImageTasks(selectedItem.gid) : []
  const rawBanner = selectedItem ? getBanner(selectedItem.gid) : null
  const banner = rawBanner && !dismissedBanners.has(selectedItem?.gid ?? '') ? rawBanner : null

  const handleDismissBanner = useCallback(() => {
    if (selectedItem) {
      setDismissedBanners(prev => new Set([...prev, selectedItem.gid]))
    }
  }, [selectedItem])

  return (
    <div className="flex flex-col h-screen
      bg-white text-zinc-900
      dark:bg-zinc-900 dark:text-zinc-100">
      <Header
        imageLimitsCurrent={imageLimits.current}
        imageLimitsTotal={imageLimits.total}
        estimatedCost={estimatedCost}
        onOpenSettings={() => setShowSettings(true)}
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          queue={queue}
          history={history}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRemove={handleRemove}
        />
        <MainArea
          selectedItem={selectedItem}
          imageTasks={imageTasks}
          banner={banner}
          onStart={() => selectedItem && start(selectedItem.gid)}
          onPause={() => selectedItem && pause(selectedItem.gid)}
          onResume={() => selectedItem && resume(selectedItem.gid)}
          onRetryFailed={() => selectedItem && retryFailed(selectedItem.gid)}
          onCancel={() => selectedItem && cancel(selectedItem.gid)}
          onDismissBanner={handleDismissBanner}
        />
      </div>
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}
