import type { ImageTask, Settings, ClassifiedError, QueueItem } from '@shared/types'
import { getSafeName, applyTemplate, renameImageDuplicates, numberImageName } from '@shared/filename'
import { fetchAllPageUrls } from './page-fetcher'
import { fetchImageFromPage } from './image-fetcher'
import { packAndDownload } from './zip-packer'
import { storageManager } from './storage-manager'

export interface GalleryDownloadState {
  galleryId: string
  imageTasks: ImageTask[]
  isPaused: boolean
  error: ClassifiedError | null
}

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
    }
  }

  private emit(): void {
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

  async start(threadCount: number): Promise<void> {
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
      if (signal.aborted) return
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
      return
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
    }))

    this.state = { ...this.state, imageTasks: tasks }
    this.emit()

    await this.downloadAll(threadCount)
  }

  private async downloadAll(threadCount: number): Promise<void> {
    const signal = this.abortController.signal
    let taskIndex = 0

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
      while (!signal.aborted && !this.state.isPaused) {
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

        while (true) {
          if (signal.aborted || this.state.isPaused) break

          const result = await fetchImageFromPage(
            task.pageUrl,
            this.info.gid,
            task.index + 1,
            this.settings,
            signal,
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
          )

          if (result.error === null) {
            this.updateTask(idx, {
              status: 'done',
              imageName: result.imageName,
              progress: 1,
              error: null,
            })
            break
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
            continue
          }

          this.updateTask(idx, {
            status: 'failed',
            error: result.error.message,
            retryCount: retries,
          })
          break
        }
      }
    }

    const threads = Array.from({ length: threadCount }, () => runThread())
    await Promise.all(threads)

    if (signal.aborted) return

    const failed = this.state.imageTasks.filter(t => t.status === 'failed')

    if (failed.length > 0 && !this.state.isPaused) {
      this.startPeriodicRetry(threadCount)
      return
    }

    if (!this.state.isPaused) {
      await this.finalize()
    }
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

  private async finalize(): Promise<void> {
    const doneTasks = this.state.imageTasks.filter(t => t.status === 'done')

    let names = doneTasks.map(t => t.imageName ?? '')
    const total = names.length

    if (this.settings.numberImages) {
      names = names.map((name, i) =>
        numberImageName(name, i + 1, total, this.settings.numberSeparator),
      )
    }

    names = renameImageDuplicates(names)

    const nameMapping = new Map<string, string>()
    for (let i = 0; i < doneTasks.length; i++) {
      const task = doneTasks[i]
      const storedKey = `${String(task.index + 1).padStart(5, '0')}_${task.imageName ?? ''}`
      nameMapping.set(storedKey, names[i])
    }

    const templateVars = {
      gid: this.info.gid,
      token: this.info.token,
      title: this.info.title,
      subtitle: this.info.subtitle,
      category: this.info.category,
      uploader: this.info.uploader,
    }

    const dirName = applyTemplate(this.settings.dirNameTemplate, templateVars)
    const rawFileName = applyTemplate(this.settings.fileNameTemplate, templateVars)
    const fileName = getSafeName(rawFileName) + '.zip'

    await packAndDownload({
      galleryId: this.info.gid,
      dirName,
      fileName,
      nameMapping,
      onProgress: () => {},
    })
  }

  retryAllFailed(threadCount: number): void {
    this.stopPeriodicRetry()
    this.state = {
      ...this.state,
      isPaused: false,
      error: null,
      imageTasks: this.state.imageTasks.map(t =>
        t.status === 'failed' ? { ...t, status: 'pending', error: null } : t,
      ),
    }
    this.emit()

    let taskIndex = 0
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

    const signal = this.abortController.signal

    const runThread = async (): Promise<void> => {
      while (!signal.aborted) {
        const idx = getNextPendingIndex()
        if (idx === -1) break

        this.updateTask(idx, { status: 'fetching' })

        const result = await fetchImageFromPage(
          this.state.imageTasks[idx].pageUrl,
          this.info.gid,
          this.state.imageTasks[idx].index + 1,
          this.settings,
          signal,
          {
            onProgress: (loaded, total, speed) => {
              this.updateTask(idx, {
                progress: total > 0 ? loaded / total : 0,
                speed,
              })
            },
            onStatus: (status) => {
              if (status === 'hashing') this.updateTask(idx, { status: 'hashing' })
            },
          },
        )

        if (result.error === null) {
          this.updateTask(idx, {
            status: 'done',
            imageName: result.imageName,
            progress: 1,
            error: null,
          })
        } else {
          this.updateTask(idx, { status: 'failed', error: result.error.message })
        }
      }
    }

    const threads = Array.from({ length: threadCount }, () => runThread())
    Promise.all(threads).then(async () => {
      if (signal.aborted) return
      const stillFailed = this.state.imageTasks.filter(t => t.status === 'failed')
      if (stillFailed.length === 0) {
        await this.finalize()
      } else {
        this.startPeriodicRetry(threadCount)
      }
    })
  }

  pause(): void {
    this.stopPeriodicRetry()
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
    this.abortController.abort()
    storageManager.deleteGallery(this.info.gid)
  }

  getState(): GalleryDownloadState {
    return this.state
  }
}
