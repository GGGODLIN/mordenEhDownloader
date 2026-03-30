import { useState, useEffect, useRef, useCallback } from 'react'
import type { Settings, ImageTask } from '@shared/types'
import { storage } from '@shared/storage'
import { QueueManager } from '@services/queue-manager'
import type { GalleryDownloadState } from '@services/gallery-downloader'

export function useDownloadEngine(settings: Settings | null) {
  const managerRef = useRef<QueueManager | null>(null)
  const [downloadStates, setDownloadStates] = useState<Map<string, GalleryDownloadState>>(new Map())

  useEffect(() => {
    if (!settings) return
    if (!managerRef.current) {
      managerRef.current = new QueueManager(settings, setDownloadStates)
      managerRef.current.processQueue()
    } else {
      managerRef.current.updateSettings(settings)
    }

    const unsubscribe = storage.onChanged((changes) => {
      if (changes.queue) managerRef.current?.processQueue()
    })
    return unsubscribe
  }, [settings])

  const getImageTasks = useCallback((galleryId: string): ImageTask[] => {
    return downloadStates.get(galleryId)?.imageTasks ?? []
  }, [downloadStates])

  const getBanner = useCallback((galleryId: string) => {
    const state = downloadStates.get(galleryId)
    if (!state?.error) return null
    const errorType = state.error.type
    const bannerType = (errorType === 'limits_exceeded' || errorType === 'ip_banned' || errorType === 'account_suspended') ? 'error' as const : 'warning' as const
    return { type: bannerType, message: state.error.message }
  }, [downloadStates])

  return {
    getImageTasks,
    getBanner,
    start: (id: string) => managerRef.current?.startGallery(id),
    pause: (id: string) => managerRef.current?.pauseGallery(id),
    resume: (id: string) => managerRef.current?.resumeGallery(id),
    retryFailed: (id: string) => managerRef.current?.retryFailed(id),
    cancel: (id: string) => managerRef.current?.cancelGallery(id),
  }
}
