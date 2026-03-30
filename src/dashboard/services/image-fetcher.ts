import type { Settings, ClassifiedError } from '@shared/types'
import { REGEX, WATCHDOG_TIMEOUT_MS } from '@shared/constants'
import { getSha1Checksum } from '@shared/checksum'
import { classifyImageResponse } from './error-classifier'
import { storageManager } from './storage-manager'

export interface FetchImageResult {
  imageName: string
  error: ClassifiedError | null
}

export interface FetchImageCallbacks {
  onProgress: (loaded: number, total: number, speed: number) => void
  onStatus: (status: string) => void
}

function decodeHtmlEntities(str: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = str
  return textarea.value
}

function extractImageUrl(html: string): string | null {
  for (const pattern of REGEX.imageURL) {
    const match = html.match(pattern)
    if (match) return decodeHtmlEntities(match[1])
  }
  return null
}

function extractFileName(html: string): string | null {
  const match = html.match(REGEX.fileName)
  if (!match) return null
  return decodeHtmlEntities(match[1])
}

function parseChecksumFromUrl(imageUrl: string, pageUrl: string): string | null {
  const sigMatch = imageUrl.match(REGEX.imageUrlParse.signature)
  if (sigMatch) return sigMatch[1]
  const pageMatch = pageUrl.match(REGEX.pageUrlParse)
  if (pageMatch) return pageMatch[1]
  return null
}

function getFileNameFromUrl(url: string): string | null {
  const part = url.split('/').pop()?.split('?')[0]
  if (part && part.indexOf('.') > 0 && part.indexOf('.php') < 0) return part
  return null
}

function padIndex(index: number): string {
  return String(index).padStart(5, '0')
}

export async function fetchImageFromPage(
  pageUrl: string,
  galleryId: string,
  index: number,
  settings: Settings,
  signal: AbortSignal,
  callbacks: FetchImageCallbacks,
): Promise<FetchImageResult> {
  callbacks.onStatus('fetching')

  let pageHtml: string
  try {
    const pageRes = await fetch(pageUrl, { credentials: 'include', signal })
    if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status}`)
    pageHtml = await pageRes.text()
  } catch (err) {
    if (signal.aborted) {
      return {
        imageName: '',
        error: {
          type: 'network_error',
          message: 'Aborted',
          shouldRetry: false,
          shouldPauseAll: false,
          forceRetry: false,
        },
      }
    }
    return {
      imageName: '',
      error: {
        type: 'network_error',
        message: err instanceof Error ? err.message : 'Failed to fetch page',
        shouldRetry: true,
        shouldPauseAll: false,
        forceRetry: false,
      },
    }
  }

  const imageUrl = extractImageUrl(pageHtml)
  if (!imageUrl) {
    return {
      imageName: '',
      error: {
        type: 'unknown',
        message: 'Could not extract image URL from page',
        shouldRetry: true,
        shouldPauseAll: false,
        forceRetry: false,
      },
    }
  }

  const parsedFileName = extractFileName(pageHtml)

  let imageResponse: Response
  try {
    const controller = new AbortController()
    const combinedSignal = signal

    let watchdogTimer: ReturnType<typeof setTimeout> | null = null

    const resetWatchdog = () => {
      if (watchdogTimer) clearTimeout(watchdogTimer)
      watchdogTimer = setTimeout(() => {
        controller.abort()
      }, WATCHDOG_TIMEOUT_MS)
    }

    resetWatchdog()

    const fetchSignal = controller.signal

    imageResponse = await fetch(imageUrl, {
      credentials: 'include',
      signal: fetchSignal,
    })

    if (watchdogTimer) clearTimeout(watchdogTimer)

    if (!imageResponse.body) {
      return {
        imageName: '',
        error: {
          type: 'empty_response',
          message: 'No response body',
          shouldRetry: true,
          shouldPauseAll: false,
          forceRetry: false,
        },
      }
    }

    const contentLength = parseInt(imageResponse.headers.get('content-length') ?? '0', 10)
    const contentType = imageResponse.headers.get('content-type') ?? ''
    const contentDisposition = imageResponse.headers.get('content-disposition') ?? ''

    const chunks: Uint8Array[] = []
    let loaded = 0
    let lastLoaded = 0
    let lastTimestamp = Date.now()

    const reader = imageResponse.body.getReader()

    while (true) {
      if (signal.aborted) {
        reader.cancel()
        return {
          imageName: '',
          error: {
            type: 'network_error',
            message: 'Aborted',
            shouldRetry: false,
            shouldPauseAll: false,
            forceRetry: false,
          },
        }
      }

      resetWatchdog()

      const { done, value } = await reader.read()
      if (done) break

      chunks.push(value)
      loaded += value.byteLength

      const now = Date.now()
      if (now - lastTimestamp >= 1000) {
        const speed = (loaded - lastLoaded) / (now - lastTimestamp) * 1000 / 1024
        lastLoaded = loaded
        lastTimestamp = now
        callbacks.onProgress(loaded, contentLength, speed)
      }
    }

    if (watchdogTimer) clearTimeout(watchdogTimer)

    const totalBytes = chunks.reduce((sum, c) => sum + c.byteLength, 0)
    const buffer = new ArrayBuffer(totalBytes)
    const view = new Uint8Array(buffer)
    let offset = 0
    for (const chunk of chunks) {
      view.set(chunk, offset)
      offset += chunk.byteLength
    }

    const bodyText = contentType.startsWith('text/') ? new TextDecoder().decode(view) : null

    const classifiedError = classifyImageResponse(
      imageResponse.status,
      bodyText,
      contentType,
      totalBytes,
    )

    if (classifiedError) {
      return { imageName: '', error: classifiedError }
    }

    let imageName = parsedFileName ?? ''

    const resFileNameMatch = contentDisposition.match(REGEX.resFileName)
    if (resFileNameMatch) {
      imageName = resFileNameMatch[1].trim()
    } else {
      const nameFromUrl = getFileNameFromUrl(imageUrl)
      if (nameFromUrl) imageName = nameFromUrl
    }

    if (!imageName) imageName = `image_${index}`

    if (settings.checksum) {
      callbacks.onStatus('hashing')
      const checksum = parseChecksumFromUrl(imageUrl, pageUrl)
      if (checksum) {
        const hash = await getSha1Checksum(buffer)
        if (hash && hash.indexOf(checksum) !== 0) {
          return {
            imageName: '',
            error: {
              type: 'checksum_mismatch',
              message: `Checksum mismatch: expected ${checksum}, got ${hash?.slice(0, checksum.length)}`,
              shouldRetry: true,
              shouldPauseAll: false,
              forceRetry: false,
            },
          }
        }
      }
    }

    const storedFileName = `${padIndex(index)}_${imageName}`
    await storageManager.writeImage(galleryId, storedFileName, buffer)

    return { imageName, error: null }
  } catch (err) {
    if (signal.aborted) {
      return {
        imageName: '',
        error: {
          type: 'network_error',
          message: 'Aborted',
          shouldRetry: false,
          shouldPauseAll: false,
          forceRetry: false,
        },
      }
    }

    const isTimeout = err instanceof Error && err.name === 'AbortError'
    return {
      imageName: '',
      error: {
        type: isTimeout ? 'timeout' : 'network_error',
        message: err instanceof Error ? err.message : 'Network error',
        shouldRetry: true,
        shouldPauseAll: false,
        forceRetry: false,
      },
    }
  }
}
