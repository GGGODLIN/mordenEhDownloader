import type { QueueItem } from '@shared/types'
import { MESSAGE_TYPES } from '@shared/constants'
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
})

async function handleAddToQueue(item: QueueItem): Promise<void> {
  const queue = await storage.getQueue()
  const exists = queue.some(q => q.id === item.id)
  if (exists) return

  queue.push(item)
  await storage.setQueue(queue)
  await updateBadge(queue)
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
