import type { ImageTask, Settings, ClassifiedError, QueueItem } from '@shared/types'
import { getSafeName, applyTemplate, renameImageDuplicates, numberImageName } from '@shared/filename'
import { fetchAllPageUrls } from './page-fetcher'
import { fetchImageFromPage } from './image-fetcher'
import { packAndDownload } from './zip-packer'
import { storageManager } from './storage-manager'
import { recordBan } from './ban-tracker'

export interface GalleryDownloadState {
  galleryId: string
  imageTasks: ImageTask[]
  isPaused: boolean
  error: ClassifiedError | null
  activeThreads: number
}

export type DownloadResult = 'completed' | 'failed' | 'paused' | 'aborted' | 'no_pages'

type GalleryInfo = QueueItem

function getOrigin(item: GalleryInfo): string {
  if (item.thumbnailUrl.includes('exhentai')) return 'https://exhentai.org'
  return 'https://e-hentai.org'
}

function getPathname(item: GalleryInfo): string {
  return `/g/${item.gid}/${item.token}/`
}

export class GalleryDownloader {
  private info: GalleryInfo
  private settings: Settings
  private onStateChange: (state: GalleryDownloadState) => void
  private state: GalleryDownloadState
  private abortController: AbortController
  private periodicRetryTimer: ReturnType<typeof setTimeout> | null = null
  private forceResizedForAll = false
  private forceOriginalForAll = false
  private downloadGeneration = 0

  private disposed = false
  private generationController: AbortController | null = null
  private stallMonitorTimer: ReturnType<typeof setInterval> | null = null
  private stallLastDoneCount = 0
  private stallLastChangeTime = 0
  private stallRetryStage = 0
  private stallThreadCount = 1

  private onResult: ((result: DownloadResult) => void) | null = null
  private onTag: ((tag: string) => void) | null = null

  constructor(
    info: GalleryInfo,
    settings: Settings,
    onStateChange: (state: GalleryDownloadState) => void,
  ) {
    this.info = info
    this.settings = settings
    this.onStateChange = onStateChange
    this.abortController = new AbortController()
    this.state = {
      galleryId: info.gid,
      imageTasks: [],
      isPaused: false,
      error: null,
      activeThreads: 0,
    }
  }

  setOnResult(cb: (result: DownloadResult) => void): void {
    this.onResult = cb
  }

  setOnTag(cb: (tag: string) => void): void {
    this.onTag = cb
  }

  private emit(): void {
    if (this.disposed) return
    this.onStateChange({ ...this.state, imageTasks: [...this.state.imageTasks] })
  }

  private updateTask(index: number, partial: Partial<ImageTask>): void {
    this.state = {
      ...this.state,
      imageTasks: this.state.imageTasks.map((t, i) =>
        i === index ? { ...t, ...partial } : t,
      ),
    }
    this.emit()
  }

  async start(threadCount: number): Promise<DownloadResult> {
    const signal = this.abortController.signal
    const origin = getOrigin(this.info)
    const pathname = getPathname(this.info)

    let result
    try {
      result = await fetchAllPageUrls(
        origin,
        pathname,
        this.info.gid,
        this.info.token,
        this.info.pagesRange,
        this.info.pageCount,
        this.settings.retryCount,
        signal,
        {
          onProgress: () => {},
          onError: () => {},
        },
      )
    } catch {
      if (signal.aborted) return 'aborted'
      recordBan()
      this.state = {
        ...this.state,
        isPaused: true,
        error: {
          type: 'network_error',
          message: 'Failed to fetch page URLs',
          shouldRetry: true,
          shouldPauseAll: false,
          forceRetry: false,
        },
      }
      this.emit()
      return 'failed'
    }

    if (result.pageUrls.length === 0) {
      this.state = {
        ...this.state,
        error: {
          type: 'unknown',
          message: 'No pages found',
          shouldRetry: true,
          shouldPauseAll: false,
          forceRetry: false,
        },
      }
      this.emit()
      return 'no_pages'
    }

    const tasks: ImageTask[] = result.pageUrls.map((url, i) => ({
      galleryId: this.info.gid,
      index: i,
      realIndex: i + 1,
      pageUrl: url,
      imageUrl: null,
      imageName: null,
      status: 'pending',
      progress: 0,
      speed: 0,
      retryCount: 0,
      error: null,
      nl: null,
      forceOriginal: false,
    }))

    this.state = { ...this.state, imageTasks: tasks }
    this.emit()

    return this.downloadAll(threadCount)
  }

  private async downloadAll(threadCount: number): Promise<DownloadResult> {
    this.downloadGeneration++
    const currentGeneration = this.downloadGeneration

    if (this.generationController) {
      this.generationController.abort()
    }
    this.generationController = new AbortController()

    const signal = this.abortController.signal
    const genSignal = this.generationController.signal
    let taskIndex = 0

    this.startStallMonitor(threadCount)

    const getNextPendingIndex = (): number => {
      while (taskIndex < this.state.imageTasks.length) {
        const task = this.state.imageTasks[taskIndex]
        if (task.status === 'pending') {
          taskIndex++
          return taskIndex - 1
        }
        taskIndex++
      }
      return -1
    }

    const runThread = async (): Promise<void> => {
      this.state = { ...this.state, activeThreads: this.state.activeThreads + 1 }
      this.emit()
      try {
      while (!signal.aborted && !genSignal.aborted && !this.state.isPaused && currentGeneration === this.downloadGeneration) {
        const idx = getNextPendingIndex()
        if (idx === -1) break

        const task = this.state.imageTasks[idx]
        if (!task) break

        const storedFileName = `${String(task.index + 1).padStart(5, '0')}_`
        const existingFiles = await storageManager.listImages(this.info.gid)
        const existing = existingFiles.find(f => f.startsWith(storedFileName))

        if (existing) {
          const imageName = existing.replace(/^\d{5}_/, '')
          this.updateTask(idx, { status: 'done', imageName, progress: 1 })
          continue
        }

        this.updateTask(idx, { status: 'fetching' })

        let retries = 0
        const maxRetries = this.settings.retryCount

        const combinedSignal = AbortSignal.any([signal, genSignal])

        while (true) {
          if (signal.aborted || genSignal.aborted || this.state.isPaused) break

          let currentPageUrl = task.pageUrl
          const taskNl = this.state.imageTasks[idx].nl
          if (taskNl && retries > 0) {
            const separator = currentPageUrl.includes('?') ? '&' : '?'
            currentPageUrl = `${currentPageUrl}${separator}nl=${taskNl}`
          }

          const result = await fetchImageFromPage(
            currentPageUrl,
            this.info.gid,
            task.index + 1,
            this.settings,
            combinedSignal,
            {
              onProgress: (loaded, total, speed) => {
                this.updateTask(idx, {
                  progress: total > 0 ? loaded / total : 0,
                  speed,
                })
              },
              onStatus: (status) => {
                if (status === 'hashing') {
                  this.updateTask(idx, { status: 'hashing' })
                }
              },
            },
            this.state.imageTasks[idx].forceOriginal ? false
              : this.forceOriginalForAll ? false
              : this.forceResizedForAll ? true
              : undefined,
          )

          if (result.nl) {
            this.updateTask(idx, { nl: result.nl })
          }

          if (result.error === null) {
            this.updateTask(idx, {
              status: 'done',
              imageName: result.imageName,
              progress: 1,
              error: null,
            })
            if (this.settings.delayRequest > 0) {
              await new Promise(r => setTimeout(r, this.settings.delayRequest * 1000))
            }
            break
          }

          if (result.error.type === 'account_suspended' && !this.settings.forceAsLoggedIn) {
            this.forceResizedForAll = true
          }

          if (result.error.shouldPauseAll) {
            this.state = { ...this.state, isPaused: true, error: result.error }
            this.updateTask(idx, { status: 'failed', error: result.error.message })
            this.emit()
            return
          }

          if (result.error.forceRetry || retries < maxRetries) {
            retries++
            this.updateTask(idx, { retryCount: retries, status: 'fetching' })
            if (this.settings.delayRequest > 0) {
              await new Promise(r => setTimeout(r, this.settings.delayRequest * 1000))
            }
            continue
          }

          this.updateTask(idx, {
            status: 'failed',
            error: result.error.message,
            retryCount: retries,
          })
          if (this.settings.delayRequest > 0) {
            await new Promise(r => setTimeout(r, this.settings.delayRequest * 1000))
          }
          break
        }
      }
      } finally {
        this.state = { ...this.state, activeThreads: Math.max(0, this.state.activeThreads - 1) }
        this.emit()
      }
    }

    const threads = Array.from({ length: threadCount }, () => runThread())
    await Promise.all(threads)

    if (signal.aborted || genSignal.aborted) return 'aborted'
    if (currentGeneration !== this.downloadGeneration) return 'aborted'

    const failed = this.state.imageTasks.filter(t => t.status === 'failed')

    if (failed.length > 0 && !this.state.isPaused) {
      this.startPeriodicRetry(threadCount)
      this.onResult?.('failed')
      return 'failed'
    }

    if (this.state.isPaused) {
      this.onResult?.('paused')
      return 'paused'
    }

    if (this.disposed) return 'aborted'

    this.stopPeriodicRetry()
    this.stopStallMonitor()
    this.disposed = true
    await this.finalize()
    this.onResult?.('completed')
    return 'completed'
  }

  private startPeriodicRetry(threadCount: number): void {
    this.stopPeriodicRetry()
    this.periodicRetryTimer = setTimeout(async () => {
      this.retryAllFailed(threadCount)
    }, this.settings.periodicRetrySec * 1000)
  }

  private stopPeriodicRetry(): void {
    if (this.periodicRetryTimer !== null) {
      clearTimeout(this.periodicRetryTimer)
      this.periodicRetryTimer = null
    }
  }

  private startStallMonitor(threadCount: number): void {
    this.stallThreadCount = threadCount
    if (this.stallMonitorTimer) return
    this.stallLastDoneCount = this.state.imageTasks.filter(t => t.status === 'done').length
    this.stallLastChangeTime = Date.now()

    this.stallMonitorTimer = setInterval(() => {
      if (this.state.isPaused) return
      if (this.state.error?.type === 'ip_banned') return

      const doneCount = this.state.imageTasks.filter(t => t.status === 'done').length
      const total = this.state.imageTasks.length
      const remaining = total - doneCount

      if (doneCount !== this.stallLastDoneCount) {
        this.stallLastDoneCount = doneCount
        this.stallLastChangeTime = Date.now()
        this.stallRetryStage = 0
        return
      }

      if (remaining === 0 || remaining > 10) return
      if (Date.now() - this.stallLastChangeTime < 30_000) return

      if (this.stallRetryStage === 0) {
        this.stallRetryStage = 1
        this.stallLastChangeTime = Date.now()
        this.retryAllNonDone(this.stallThreadCount)
      } else if (this.stallRetryStage === 1) {
        this.stallRetryStage = 2
        this.stallLastChangeTime = Date.now()
        this.retryWithOriginal(this.stallThreadCount)
      } else {
        this.stopStallMonitor()
        this.onTag?.('stalled')
      }
    }, 5_000)
  }

  private stopStallMonitor(): void {
    if (this.stallMonitorTimer) {
      clearInterval(this.stallMonitorTimer)
      this.stallMonitorTimer = null
    }
  }

  private async finalize(tasksOverride?: ImageTask[]): Promise<void> {
    const doneTasks = (tasksOverride ?? this.state.imageTasks).filter(t => t.status === 'done')

    let names = doneTasks.map(t => t.imageName ?? '')

    if (this.settings.numberImages) {
      if (this.settings.numberRealIndex) {
        const total = this.info.pageCount
        names = doneTasks.map((task, i) =>
          numberImageName(names[i], task.realIndex, total, this.settings.numberSeparator),
        )
      } else {
        const total = names.length
        names = names.map((name, i) =>
          numberImageName(name, i + 1, total, this.settings.numberSeparator),
        )
      }
    }

    names = renameImageDuplicates(names)

    const nameMapping = new Map<string, string>()
    for (let i = 0; i < doneTasks.length; i++) {
      const task = doneTasks[i]
      const storedKey = `${String(task.index + 1).padStart(5, '0')}_${task.imageName ?? ''}`
      nameMapping.set(storedKey, names[i])
    }

    const useFullWidth = this.settings.replaceWithFullWidth
    const templateVars = {
      gid: this.info.gid,
      token: this.info.token,
      title: this.info.title,
      subtitle: this.info.subtitle,
      category: this.info.category,
      uploader: this.info.uploader,
    }

    const dirName = applyTemplate(this.settings.dirNameTemplate, templateVars, useFullWidth)
    const rawFileName = applyTemplate(this.settings.fileNameTemplate, templateVars, useFullWidth)
    const fileName = getSafeName(rawFileName, useFullWidth) + '.zip'

    let infoText: string | undefined
    if (this.settings.saveGalleryInfo) {
      const origin = getOrigin(this.info)
      const url = `${origin}/g/${this.info.gid}/${this.info.token}/`
      const lines: string[] = []

      lines.push(this.info.title)
      if (this.info.subtitle) lines.push(this.info.subtitle)
      lines.push(url)
      lines.push('')

      lines.push(`Category: ${this.info.category}`)
      lines.push(`Uploader: ${this.info.uploader}`)
      for (const row of this.info.metaRows ?? []) {
        lines.push(row)
      }
      if (this.info.rating) lines.push(`Rating: ${this.info.rating}`)
      lines.push('')

      if (this.info.tags && Object.keys(this.info.tags).length > 0) {
        lines.push('Tags:')
        for (const [ns, values] of Object.entries(this.info.tags)) {
          lines.push(`> ${ns}:  ${values.join(', ')}`)
        }
        lines.push('')
      }

      if (this.info.uploaderComment) {
        lines.push('Uploader Comment:')
        lines.push(this.info.uploaderComment)
        lines.push('')
      }

      for (const task of doneTasks) {
        lines.push(`Page ${task.realIndex}: ${task.pageUrl}`)
        lines.push(`Image ${task.realIndex}: ${task.imageName ?? ''}`)
      }

      lines.push('')
      lines.push(`Downloaded at ${new Date()}`)
      lines.push('')
      lines.push('Generated by E-Hentai Downloader. https://github.com/GGGODLIN/mordenEhDownloader')

      infoText = lines.join('\r\n')
    }

    await packAndDownload({
      galleryId: this.info.gid,
      dirName,
      fileName,
      nameMapping,
      onProgress: () => {},
      infoText,
      compressionLevel: this.settings.compressionLevel,
    })
  }

  retryFailedWithOriginal(threadCount: number): void {
    this.stopPeriodicRetry()
    this.state = {
      ...this.state,
      isPaused: false,
      error: null,
      imageTasks: this.state.imageTasks.map(t =>
        t.status === 'failed' ? { ...t, status: 'pending' as const, error: null, forceOriginal: true } : t,
      ),
    }
    this.emit()
    this.downloadAll(threadCount)
  }

  retryAllFailed(threadCount: number): void {
    this.stopPeriodicRetry()
    this.state = {
      ...this.state,
      isPaused: false,
      error: null,
      imageTasks: this.state.imageTasks.map(t =>
        t.status === 'failed' ? { ...t, status: 'pending' as const, error: null } : t,
      ),
    }
    this.emit()
    this.downloadAll(threadCount)
  }

  retryWithOriginal(threadCount: number): void {
    this.forceOriginalForAll = true
    this.forceResizedForAll = false
    this.retryAllNonDone(threadCount)
  }

  retryAllNonDone(threadCount: number): void {
    this.stopPeriodicRetry()
    this.state = {
      ...this.state,
      isPaused: false,
      error: null,
      imageTasks: this.state.imageTasks.map(t =>
        t.status !== 'done'
          ? { ...t, status: 'pending' as const, error: null, retryCount: 0, progress: 0, speed: 0 }
          : t,
      ),
    }
    this.emit()
    this.downloadAll(threadCount)
  }

  pause(): void {
    this.stopPeriodicRetry()
    this.stopStallMonitor()
    this.state = { ...this.state, isPaused: true }
    this.emit()
  }

  resume(threadCount: number): void {
    if (!this.state.isPaused) return
    this.state = {
      ...this.state,
      isPaused: false,
      error: null,
      imageTasks: this.state.imageTasks.map(t =>
        t.status === 'fetching' ? { ...t, status: 'pending' } : t,
      ),
    }
    this.emit()
    this.downloadAll(threadCount)
  }

  cancel(): void {
    this.stopPeriodicRetry()
    this.stopStallMonitor()
    this.abortController.abort()
    storageManager.deleteGallery(this.info.gid)
  }

  async savePartial(): Promise<void> {
    this.stopPeriodicRetry()
    this.stopStallMonitor()
    this.abortController.abort()
    await this.finalize()
  }

  dispose(): void {
    this.stopPeriodicRetry()
    this.stopStallMonitor()
    this.disposed = true
  }

  getState(): GalleryDownloadState {
    return this.state
  }

  getInfo(): GalleryInfo {
    return this.info
  }

  updateInfo(partial: Partial<GalleryInfo>): void {
    this.info = { ...this.info, ...partial }
  }
}
