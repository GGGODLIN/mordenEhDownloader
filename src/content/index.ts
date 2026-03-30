import './inject.css'
import { parseGalleryUrl, parseGalleryMetadata } from '@shared/gallery-parser'
import type { QueueItem } from '@shared/types'
import { MESSAGE_TYPES } from '@shared/constants'

function init() {
  const urlInfo = parseGalleryUrl(window.location.href)
  if (!urlInfo) return

  const metadata = parseGalleryMetadata(document)

  const container = document.createElement('div')
  container.className = 'ehd-inject-container'

  const rangeInput = document.createElement('input')
  rangeInput.type = 'text'
  rangeInput.className = 'ehd-inject-input'
  rangeInput.placeholder = 'Pages Range (eg. -10,!8,12,14-20,70-)'

  const addBtn = document.createElement('button')
  addBtn.className = 'ehd-inject-btn'
  addBtn.textContent = 'Add to Queue'

  addBtn.addEventListener('click', () => {
    const item: QueueItem = {
      id: `${urlInfo.gid}_${urlInfo.token}`,
      gid: urlInfo.gid,
      token: urlInfo.token,
      title: metadata.title,
      subtitle: metadata.subtitle,
      category: metadata.category,
      uploader: metadata.uploader,
      pageCount: metadata.pageCount,
      fileSize: metadata.fileSize,
      thumbnailUrl: metadata.thumbnailUrl,
      pagesRange: rangeInput.value.trim(),
      addedAt: Date.now(),
      status: 'queued',
    }

    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.ADD_TO_QUEUE, payload: item })

    addBtn.textContent = 'Added ✓'
    addBtn.disabled = true
    setTimeout(() => {
      addBtn.textContent = 'Add to Queue'
      addBtn.disabled = false
    }, 2000)
  })

  container.appendChild(rangeInput)
  container.appendChild(addBtn)

  const insertTarget = document.getElementById('asm')
    ?? document.querySelector('.gm')?.nextElementSibling
  if (insertTarget?.parentNode) {
    insertTarget.parentNode.insertBefore(container, insertTarget)
  } else {
    document.body.appendChild(container)
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'q' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
      addBtn.click()
    }
  })
}

init()
