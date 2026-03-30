import type { QueueItem, Settings, ImageLimits } from './types'
import { DEFAULT_SETTINGS } from './constants'

interface StorageSchema {
  queue: QueueItem[]
  settings: Settings
  imageLimits: ImageLimits
  history: QueueItem[]
}

type StorageKey = keyof StorageSchema

async function get<K extends StorageKey>(key: K): Promise<StorageSchema[K]> {
  const result = await chrome.storage.local.get(key)
  return result[key]
}

async function set<K extends StorageKey>(key: K, value: StorageSchema[K]): Promise<void> {
  await chrome.storage.local.set({ [key]: value })
}

export const storage = {
  getQueue: () => get('queue').then(q => q ?? []),
  setQueue: (queue: QueueItem[]) => set('queue', queue),

  getSettings: () => get('settings').then(s => ({ ...DEFAULT_SETTINGS, ...s })),
  setSettings: (settings: Settings) => set('settings', settings),

  getImageLimits: () => get('imageLimits').then(l => l ?? {
    current: 0, total: 0, isDonator: false,
    isSuspended: false, isIpBanned: false, timestamp: 0,
  }),
  setImageLimits: (limits: ImageLimits) => set('imageLimits', limits),

  getHistory: () => get('history').then(h => h ?? []),
  setHistory: (history: QueueItem[]) => set('history', history),

  onChanged: (callback: (changes: Partial<Record<StorageKey, chrome.storage.StorageChange>>) => void) => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local') callback(changes)
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  },
}
