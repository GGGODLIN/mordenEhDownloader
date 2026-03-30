import { REGEX } from '@shared/constants'
import { parsePagesRange } from '@shared/pages-range'

export interface PageFetcherResult {
  pageUrls: string[]
  totalCount: number
}

export interface PageFetcherCallbacks {
  onProgress: (current: number, total: number | null) => void
  onError: (message: string) => void
}

function decodeHtmlEntities(str: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = str
  return textarea.value
}

async function fetchText(url: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(url, { credentials: 'include', signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

async function tryMpv(
  origin: string,
  gid: string,
  token: string,
  retryLimit: number,
  signal: AbortSignal,
): Promise<string[] | null> {
  const mpvUrl = `${origin}/mpv/${gid}/${token}/`
  let attempt = 0
  while (attempt <= retryLimit) {
    try {
      const text = await fetchText(mpvUrl, signal)
      const match = text.match(REGEX.mpvKey)
      if (!match) return null
      const list = new Function('return ' + match[1])() as Array<{ k: string }>
      return list.map((elem, index) => `${origin}/s/${elem.k}/${gid}-${index + 1}`)
    } catch (err) {
      if (signal.aborted) throw err
      attempt++
      if (attempt > retryLimit) return null
    }
  }
  return null
}

async function fetchPaginatedUrls(
  origin: string,
  pathname: string,
  retryLimit: number,
  signal: AbortSignal,
  callbacks: PageFetcherCallbacks,
): Promise<string[]> {
  const allUrls: string[] = []
  let curPage = 0
  let totalPages: number | null = null

  while (true) {
    const url = `${origin}${pathname}?p=${curPage}`
    let text: string | null = null
    let attempt = 0

    while (attempt <= retryLimit) {
      try {
        text = await fetchText(url, signal)
        break
      } catch (err) {
        if (signal.aborted) throw err
        attempt++
        if (attempt > retryLimit) throw new Error(`Failed to fetch page ${curPage} after ${retryLimit} retries`)
      }
    }

    if (!text) throw new Error(`No content for page ${curPage}`)

    const gdtSection = text.split('<div id="gdt"')[1]?.split('<div class="gtb"')[0]
    if (!gdtSection) throw new Error('Could not find gdt section')

    const pagesURL = gdtSection.match(REGEX.pagesURL)
    if (!pagesURL) throw new Error('Could not extract page URLs')

    if (pagesURL[0].indexOf('/mpv/') >= 0) {
      return []
    }

    for (const raw of pagesURL) {
      const href = raw.replace('<a href="', '')
      allUrls.push(decodeHtmlEntities(href))
    }

    if (totalPages === null) {
      const lengthMatch = text.match(REGEX.pagesLength)
      if (lengthMatch) {
        totalPages = parseInt(lengthMatch[1], 10)
      }
    }

    callbacks.onProgress(curPage + 1, totalPages)

    curPage++
    if (totalPages !== null && curPage >= totalPages) break
    if (totalPages === null) break
  }

  return allUrls
}

export async function fetchAllPageUrls(
  origin: string,
  pathname: string,
  gid: string,
  token: string,
  pagesRangeText: string,
  totalPages: number,
  retryLimit: number,
  signal: AbortSignal,
  callbacks: PageFetcherCallbacks,
): Promise<PageFetcherResult> {
  let allUrls: string[] = []

  const mpvUrls = await tryMpv(origin, gid, token, retryLimit, signal)

  if (mpvUrls && mpvUrls.length > 0) {
    allUrls = mpvUrls
  } else {
    const paginatedUrls = await fetchPaginatedUrls(origin, pathname, retryLimit, signal, callbacks)

    if (paginatedUrls.length === 0 && !signal.aborted) {
      const mpvFallback = await tryMpv(origin, gid, token, retryLimit, signal)
      if (mpvFallback) {
        allUrls = mpvFallback
      } else {
        throw new Error('Could not fetch page URLs')
      }
    } else {
      allUrls = paginatedUrls
    }
  }

  const parsedRange = parsePagesRange(pagesRangeText, allUrls.length)

  if (parsedRange === null) {
    throw new Error('Invalid pages range format')
  }

  let filteredUrls: string[]
  if (parsedRange.length === 0) {
    filteredUrls = allUrls
  } else {
    filteredUrls = parsedRange
      .filter(pageNum => pageNum >= 1 && pageNum <= allUrls.length)
      .map(pageNum => allUrls[pageNum - 1])
  }

  return {
    pageUrls: filteredUrls,
    totalCount: filteredUrls.length,
  }
}
