import type { QueueItem } from '@shared/types'
import { MESSAGE_TYPES, DEFAULT_SETTINGS } from '@shared/constants'
import { storage } from '@shared/storage'

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') })
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === MESSAGE_TYPES.ADD_TO_QUEUE) {
    handleAddToQueue(message.payload as QueueItem)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: String(err) }))
    return true
  }

  if (message.type === MESSAGE_TYPES.CHECK_DUPLICATE) {
    checkDuplicate(message.payload as DuplicateCheckPayload)
      .then((result) => sendResponse(result))
      .catch(() => sendResponse({ found: false }))
    return true
  }
})

async function handleAddToQueue(item: QueueItem): Promise<void> {
  const queue = await storage.getQueue()
  const exists = queue.some(q => q.id === item.id)
  if (exists) return

  queue.push(item)
  await storage.setQueue(queue)
  await updateBadge(queue)
}

interface DuplicateCheckPayload {
  id: string
  title: string
}

interface DuplicateCheckResult {
  found: boolean
  where: 'queue' | 'history' | null
  status: string | null
  title: string | null
  completedAt: number | null
}

async function checkDuplicate(payload: DuplicateCheckPayload): Promise<DuplicateCheckResult> {
  const { id, title } = payload
  const titleLower = title.toLowerCase()

  const queue = await storage.getQueue()
  const queueMatch = queue.find(q =>
    q.id === id || q.title.toLowerCase() === titleLower,
  )
  if (queueMatch) {
    return { found: true, where: 'queue', status: queueMatch.status, title: queueMatch.title, completedAt: null }
  }

  const settings = await storage.getSettings()
  const checkDays = settings.historyCheckDays ?? DEFAULT_SETTINGS.historyCheckDays
  if (checkDays === 0) {
    return { found: false, where: null, status: null, title: null, completedAt: null }
  }

  const cutoff = Date.now() - checkDays * 24 * 60 * 60 * 1000
  const history = await storage.getHistory()
  const historyMatch = history.find(h =>
    (h.completedAt ?? h.addedAt) >= cutoff &&
    (h.id === id || h.title.toLowerCase() === titleLower),
  )

  if (historyMatch) {
    return {
      found: true,
      where: 'history',
      status: historyMatch.status,
      title: historyMatch.title,
      completedAt: historyMatch.completedAt ?? historyMatch.addedAt,
    }
  }

  return { found: false, where: null, status: null, title: null, completedAt: null }
}

async function updateBadge(queue?: QueueItem[]): Promise<void> {
  const q = queue ?? await storage.getQueue()
  const activeCount = q.filter(item =>
    item.status === 'queued' || item.status === 'downloading'
  ).length
  await chrome.action.setBadgeText({ text: activeCount > 0 ? String(activeCount) : '' })
  await chrome.action.setBadgeBackgroundColor({ color: '#4f535b' })
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.queue) {
    updateBadge(changes.queue.newValue)
  }
})
