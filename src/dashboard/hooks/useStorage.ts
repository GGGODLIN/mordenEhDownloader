import { useState, useEffect } from 'react'
import { storage } from '@shared/storage'
import type { QueueItem, Settings, ImageLimits } from '@shared/types'

export function useQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  useEffect(() => {
    storage.getQueue().then(setQueue)
    return storage.onChanged((changes) => {
      if (changes.queue?.newValue) setQueue(changes.queue.newValue)
    })
  }, [])
  return queue
}

export function useHistory() {
  const [history, setHistory] = useState<QueueItem[]>([])
  useEffect(() => {
    storage.getHistory().then(setHistory)
    return storage.onChanged((changes) => {
      if (changes.history?.newValue) setHistory(changes.history.newValue)
    })
  }, [])
  return history
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  useEffect(() => {
    storage.getSettings().then(setSettings)
    return storage.onChanged((changes) => {
      if (changes.settings?.newValue) setSettings(changes.settings.newValue)
    })
  }, [])
  return settings
}
