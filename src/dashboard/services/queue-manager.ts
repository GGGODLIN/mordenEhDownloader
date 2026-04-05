import type { Settings, QueueItem } from '@shared/types'
import { storage } from '@shared/storage'
import { GalleryDownloader, type GalleryDownloadState } from './gallery-downloader'
import { setOnRecovered } from './ban-tracker'

export class QueueManager {
  private settings: Settings
  private onStateChange: (states: Map<string, GalleryDownloadState>) => void
  private downloaders: Map<string, GalleryDownloader> = new Map()
  private states: Map<string, GalleryDownloadState> = new Map()
  private activeIds: Set<string> = new Set()
  private completedGids: Set<string> = new Set()
  private processing = false
  private pendingProcess = false

  constructor(
    settings: Settings,
    onStateChange: (states: Map<string, GalleryDownloadState>) => void,
  ) {
    this.settings = settings
    this.onStateChange = onStateChange
    setOnRecovered(() => this.recoverFromBan())
  }

  private get effectiveThreadCount(): number {
    return this.settings.slowMode ? this.settings.slowThreadCount : this.settings.threadCount
  }

  private get effectiveMaxConcurrent(): number {
    return this.settings.slowMode ? this.settings.slowMaxConcurrentGalleries : this.settings.maxConcurrentGalleries
  }

  private get perGalleryThreadCount(): number {
    return Math.max(1, Math.floor(this.effectiveThreadCount / this.effectiveMaxConcurrent))
  }

  private getThreadCountForGallery(gid: string): number {
    const downloader = this.downloaders.get(gid)
    const override = downloader?.getInfo().threadCountOverride
    return override ?? this.perGalleryThreadCount
  }

  private async recoverFromBan(): Promise<void> {
    await this.doRecovery()
    setTimeout(() => this.doRecovery(), 3_000)
    setTimeout(() => this.doRecovery(), 8_000)
  }

  private async doRecovery(): Promise<void> {
    for (const [id, downloader] of this.downloaders) {
      if (this.completedGids.has(id)) continue
      const state = downloader.getState()
      const hasFailed = state.imageTasks.some(t => t.status === 'failed')
      if (state.isPaused || hasFailed) {
        downloader.retryAllNonDone(this.getThreadCountForGallery(id))
        this.activeIds.add(id)
        await this.updateItemStatus(id, 'downloading')
      }
    }

    const queue = await storage.getQueue()
    const stalled = queue.filter(item =>
      (item.status === 'failed' || item.status === 'paused') &&
      !this.activeIds.has(item.gid) &&
      !this.downloaders.has(item.gid) &&
      !this.completedGids.has(item.gid),
    )
    if (stalled.length > 0) {
      const newQueue = queue.map(item =>
        stalled.some(s => s.gid === item.gid) ? { ...item, status: 'queued' as const } : item,
      )
      await storage.setQueue(newQueue)
    }

    await this.processQueue()
  }

  updateSettings(settings: Settings): void {
    this.settings = settings
  }

  async processQueue(): Promise<void> {
    if (this.processing) {
      this.pendingProcess = true
      return
    }
    this.processing = true

    try {
      let queue = await storage.getQueue()

      const orphaned = queue.filter(item =>
        (item.status === 'downloading' || item.status === 'paused') && !this.activeIds.has(item.gid),
      )
      if (orphaned.length > 0) {
        queue = queue.map(item =>
          orphaned.some(o => o.gid === item.gid) ? { ...item, status: 'queued' as const } : item,
        )
        await storage.setQueue(queue)
      }

      const available = this.effectiveMaxConcurrent - this.activeIds.size

      if (available <= 0) return

      const queued = queue.filter(item =>
        item.status === 'queued' && !this.activeIds.has(item.gid),
      )

      for (let i = 0; i < Math.min(available, queued.length); i++) {
        const item = queued[i]
        await this.startDownload(item)
      }
    } finally {
      this.processing = false
      if (this.pendingProcess) {
        this.pendingProcess = false
        this.processQueue()
      }
    }
  }

  private async startDownload(item: QueueItem): Promise<void> {
    if (this.activeIds.has(item.gid)) return
    if (this.completedGids.has(item.gid)) return

    const downloader = new GalleryDownloader(item, this.settings, (state) => {
      this.states.set(item.gid, state)
      this.onStateChange(new Map(this.states))
    })

    downloader.setOnTag(async (tag) => {
      await this.tagItem(item.gid, tag)
    })

    downloader.setOnResult(async (result) => {
      switch (result) {
        case 'completed':
          await this.onDownloadComplete(item.gid)
          break
        case 'paused':
          await this.updateItemStatus(item.gid, 'paused')
          break
        case 'failed':
          await this.updateItemStatus(item.gid, 'failed')
          this.activeIds.delete(item.gid)
          await this.processQueue()
          break
      }
    })

    this.downloaders.set(item.gid, downloader)
    this.activeIds.add(item.gid)

    await this.updateItemStatus(item.gid, 'downloading')

    const startThreads = item.threadCountOverride ?? this.perGalleryThreadCount
    downloader.start(startThreads).then(async (result) => {
      if (result === 'no_pages' || result === 'failed') {
        await this.updateItemStatus(item.gid, 'failed')
        this.activeIds.delete(item.gid)
        this.downloaders.delete(item.gid)
        await this.processQueue()
      }
    })
  }

  private async onDownloadComplete(galleryId: string): Promise<void> {
    if (this.completedGids.has(galleryId)) return
    this.completedGids.add(galleryId)
    this.activeIds.delete(galleryId)

    const downloader = this.downloaders.get(galleryId)
    if (downloader) {
      downloader.dispose()
    }

    const queue = await storage.getQueue()
    const item = queue.find(q => q.gid === galleryId)

    if (item) {
      const newQueue = queue.filter(q => q.gid !== galleryId)
      await storage.setQueue(newQueue)

      const history = await storage.getHistory()
      await storage.setHistory([{ ...item, status: 'completed', completedAt: Date.now() }, ...history])
    }

    this.downloaders.delete(galleryId)
    this.states.delete(galleryId)
    this.onStateChange(new Map(this.states))

    await this.processQueue()
  }

  private async tagItem(galleryId: string, tag: string): Promise<void> {
    const queue = await storage.getQueue()
    const newQueue = queue.map(item =>
      item.gid === galleryId ? { ...item, tag } : item,
    )
    await storage.setQueue(newQueue)
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
    if (this.completedGids.has(id)) return
    const downloader = this.downloaders.get(id)
    if (!downloader) return

    downloader.resume(this.getThreadCountForGallery(id))
    this.updateItemStatus(id, 'downloading')
  }

  retryWithOriginal(id: string): void {
    if (this.completedGids.has(id)) return
    const downloader = this.downloaders.get(id)
    if (!downloader) return

    this.activeIds.add(id)
    downloader.retryWithOriginal(this.getThreadCountForGallery(id))
    this.updateItemStatus(id, 'downloading')
  }

  retryAllNonDone(id: string): void {
    if (this.completedGids.has(id)) return
    const downloader = this.downloaders.get(id)
    if (!downloader) return

    this.activeIds.add(id)
    downloader.retryAllNonDone(this.getThreadCountForGallery(id))
    this.updateItemStatus(id, 'downloading')
  }

  retryFailed(id: string): void {
    if (this.completedGids.has(id)) return
    const downloader = this.downloaders.get(id)
    if (!downloader) return

    this.activeIds.add(id)
    downloader.retryFailedWithOriginal(this.getThreadCountForGallery(id))
    this.updateItemStatus(id, 'downloading')
  }

  async setThreadCountOverride(id: string, count: number | undefined): Promise<void> {
    const downloader = this.downloaders.get(id)
    if (downloader) {
      downloader.updateInfo({ threadCountOverride: count })
    }

    const queue = await storage.getQueue()
    const newQueue = queue.map(item =>
      item.gid === id ? { ...item, threadCountOverride: count } : item,
    )
    await storage.setQueue(newQueue)
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
        await storage.setHistory([{ ...item, status: 'canceled', completedAt: Date.now() }, ...history])
      }
    }
  }

  getState(id: string): GalleryDownloadState | undefined {
    return this.states.get(id)
  }
}
