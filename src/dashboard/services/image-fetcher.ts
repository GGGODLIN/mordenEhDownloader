import type { Settings, ClassifiedError } from '@shared/types'
import { REGEX, WATCHDOG_TIMEOUT_MS } from '@shared/constants'
import { getSha1Checksum } from '@shared/checksum'
import { classifyImageResponse } from './error-classifier'
import { storageManager } from './storage-manager'

export interface FetchImageResult {
  imageName: string
  error: ClassifiedError | null
  nl: string | null
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

function extractNl(html: string): string | null {
  const match = html.match(REGEX.nl)
  return match ? match[1] : null
}

function extractImageUrl(html: string, forceResized?: boolean): string | null {
  const patterns = forceResized ? REGEX.imageURL.slice(1) : REGEX.imageURL
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) return decodeHtmlEntities(match[1])
  }
  return null
}

function replaceImageDomain(imageUrl: string, domain: string): string {
  try {
    const url = new URL(imageUrl)
    url.hostname = domain
    return url.toString()
  } catch {
    return imageUrl
  }
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
  forceResizedOverride?: boolean,
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
        nl: null,
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
      nl: null,
      error: {
        type: 'network_error',
        message: err instanceof Error ? err.message : 'Failed to fetch page',
        shouldRetry: true,
        shouldPauseAll: false,
        forceRetry: false,
      },
    }
  }

  const nl = extractNl(pageHtml)
  const useResized = forceResizedOverride ?? settings.forceResized
  const imageUrl = extractImageUrl(pageHtml, useResized)
  if (!imageUrl) {
    return {
      imageName: '',
      nl,
      error: {
        type: 'unknown',
        message: 'Could not extract image URL from page',
        shouldRetry: true,
        shouldPauseAll: false,
        forceRetry: false,
      },
    }
  }

  let finalImageUrl = imageUrl
  if (settings.originalDownloadDomain) {
    finalImageUrl = replaceImageDomain(finalImageUrl, settings.originalDownloadDomain)
  }

  const parsedFileName = extractFileName(pageHtml)

  let imageResponse: Response
  try {
    const controller = new AbortController()

    let watchdogTimer: ReturnType<typeof setTimeout> | null = null

    const resetWatchdog = () => {
      if (watchdogTimer) clearTimeout(watchdogTimer)
      watchdogTimer = setTimeout(() => {
        controller.abort()
      }, WATCHDOG_TIMEOUT_MS)
    }

    resetWatchdog()

    const fetchSignal = controller.signal

    imageResponse = await fetch(finalImageUrl, {
      credentials: 'include',
      signal: fetchSignal,
    })

    if (watchdogTimer) clearTimeout(watchdogTimer)

    if (!imageResponse.body) {
      return {
        imageName: '',
        nl,
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
          nl,
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
      return { imageName: '', nl, error: classifiedError }
    }

    let imageName = parsedFileName ?? ''

    const resFileNameMatch = contentDisposition.match(REGEX.resFileName)
    if (resFileNameMatch) {
      imageName = resFileNameMatch[1].trim()
    } else {
      const nameFromUrl = getFileNameFromUrl(finalImageUrl)
      if (nameFromUrl) imageName = nameFromUrl
    }

    if (!imageName) imageName = `image_${index}`

    if (settings.checksum) {
      callbacks.onStatus('hashing')
      const checksum = parseChecksumFromUrl(finalImageUrl, pageUrl)
      if (checksum) {
        const hash = await getSha1Checksum(buffer)
        if (hash && hash.indexOf(checksum) !== 0) {
          return {
            imageName: '',
            nl,
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

    return { imageName, nl, error: null }
  } catch (err) {
    if (signal.aborted) {
      return {
        imageName: '',
        nl: null,
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
      nl: null,
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
