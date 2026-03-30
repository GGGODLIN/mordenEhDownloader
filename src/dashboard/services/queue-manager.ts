import type { Settings, QueueItem } from '@shared/types'
import { storage } from '@shared/storage'
import { GalleryDownloader, type GalleryDownloadState } from './gallery-downloader'

export class QueueManager {
  private settings: Settings
  private onStateChange: (states: Map<string, GalleryDownloadState>) => void
  private downloaders: Map<string, GalleryDownloader> = new Map()
  private states: Map<string, GalleryDownloadState> = new Map()
  private activeIds: Set<string> = new Set()

  constructor(
    settings: Settings,
    onStateChange: (states: Map<string, GalleryDownloadState>) => void,
  ) {
    this.settings = settings
    this.onStateChange = onStateChange
  }

  updateSettings(settings: Settings): void {
    this.settings = settings
  }

  async processQueue(): Promise<void> {
    const queue = await storage.getQueue()
    const maxActive = this.settings.maxConcurrentGalleries
    const available = maxActive - this.activeIds.size

    if (available <= 0) return

    const queued = queue.filter(item => item.status === 'queued')

    for (let i = 0; i < Math.min(available, queued.length); i++) {
      const item = queued[i]
      await this.startDownload(item)
    }
  }

  private async startDownload(item: QueueItem): Promise<void> {
    if (this.activeIds.has(item.gid)) return

    const threadCount = Math.max(
      1,
      Math.floor(this.settings.threadCount / this.settings.maxConcurrentGalleries),
    )

    const downloader = new GalleryDownloader(item, this.settings, (state) => {
      this.states.set(item.gid, state)
      this.onStateChange(new Map(this.states))
    })

    this.downloaders.set(item.gid, downloader)
    this.activeIds.add(item.gid)

    await this.updateItemStatus(item.gid, 'downloading')

    downloader.start(threadCount).then(async () => {
      const state = downloader.getState()
      const allDone = state.imageTasks.every(t => t.status === 'done')
      const hasFailed = state.imageTasks.some(t => t.status === 'failed')

      if (allDone && !hasFailed) {
        await this.onDownloadComplete(item.gid)
      } else if (state.isPaused) {
        await this.updateItemStatus(item.gid, 'paused')
      } else {
        await this.updateItemStatus(item.gid, 'failed')
        this.activeIds.delete(item.gid)
        await this.processQueue()
      }
    })
  }

  private async onDownloadComplete(galleryId: string): Promise<void> {
    this.activeIds.delete(galleryId)

    const queue = await storage.getQueue()
    const item = queue.find(q => q.gid === galleryId)

    if (item) {
      const newQueue = queue.filter(q => q.gid !== galleryId)
      await storage.setQueue(newQueue)

      const history = await storage.getHistory()
      await storage.setHistory([...history, { ...item, status: 'completed' }])
    }

    this.downloaders.delete(galleryId)
    this.states.delete(galleryId)
    this.onStateChange(new Map(this.states))

    await this.processQueue()
  }

  private async updateItemStatus(galleryId: string, status: QueueItem['status']): Promise<void> {
    const queue = await storage.getQueue()
    const newQueue = queue.map(item =>
      item.gid === galleryId ? { ...item, status } : item,
    )
    await storage.setQueue(newQueue)
  }

  pauseGallery(id: string): void {
    const downloader = this.downloaders.get(id)
    if (downloader) {
      downloader.pause()
      this.updateItemStatus(id, 'paused')
    }
  }

  resumeGallery(id: string): void {
    const downloader = this.downloaders.get(id)
    if (!downloader) return

    const threadCount = Math.max(
      1,
      Math.floor(this.settings.threadCount / this.settings.maxConcurrentGalleries),
    )

    downloader.resume(threadCount)
    this.updateItemStatus(id, 'downloading')
  }

  retryFailed(id: string): void {
    const downloader = this.downloaders.get(id)
    if (!downloader) return

    const threadCount = Math.max(
      1,
      Math.floor(this.settings.threadCount / this.settings.maxConcurrentGalleries),
    )

    downloader.retryAllFailed(threadCount)
    this.updateItemStatus(id, 'downloading')
  }

  async startGallery(id: string): Promise<void> {
    if (this.activeIds.has(id)) return
    const queue = await storage.getQueue()
    const item = queue.find(q => q.gid === id && q.status === 'queued')
    if (item) {
      await this.startDownload(item)
    }
  }

  async cancelGallery(id: string): Promise<void> {
    const downloader = this.downloaders.get(id)
    if (downloader) {
      const state = downloader.getState()
      const hasDone = state.imageTasks.some(t => t.status === 'done')

      if (this.settings.autoDownloadOnCancel && hasDone) {
        await downloader.savePartial()
      } else {
        downloader.cancel()
      }

      this.downloaders.delete(id)
      this.states.delete(id)
      this.activeIds.delete(id)
      this.onStateChange(new Map(this.states))

      const queue = await storage.getQueue()
      const item = queue.find(q => q.gid === id)
      if (item) {
        const newQueue = queue.filter(q => q.gid !== id)
        await storage.setQueue(newQueue)

        const history = await storage.getHistory()
        await storage.setHistory([{ ...item, status: 'canceled' }, ...history])
      }
    }
  }

  getState(id: string): GalleryDownloadState | undefined {
    return this.states.get(id)
  }
}
