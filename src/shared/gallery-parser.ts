export interface GalleryUrlInfo {
  gid: string
  token: string
}

export interface GalleryMetadata {
  title: string
  subtitle: string
  category: string
  uploader: string
  pageCount: number
  fileSize: string
  thumbnailUrl: string
}

export function parseGalleryUrl(url: string): GalleryUrlInfo | null {
  const match = url.match(/\/g\/(\d+)\/([^/]+)/)
  if (!match) return null
  return { gid: match[1], token: match[2] }
}

export function parseGalleryMetadata(doc: Document): GalleryMetadata {
  const title = doc.getElementById('gn')?.textContent?.trim() ?? ''
  const subtitle = doc.getElementById('gj')?.textContent?.trim() ?? ''
  const category = doc.querySelector('#gdc .cs')?.textContent?.trim().toUpperCase() ?? ''
  const uploader = doc.querySelector('#gdn')?.textContent?.trim() ?? ''

  const gddText = doc.getElementById('gdd')?.textContent ?? ''
  const fileSizeMatch = gddText.match(/File Size:\s*([\d.]+\s*\w+)/)
  const pageCountMatch = gddText.match(/Length:\s*(\d+)\s*page/)

  const fileSize = fileSizeMatch?.[1] ?? ''
  const pageCount = pageCountMatch ? parseInt(pageCountMatch[1], 10) : 0

  const coverImg = doc.querySelector('#gd1 div[style*="url("]')
  const styleAttr = coverImg?.getAttribute('style') ?? ''
  const urlMatch = styleAttr.match(/url\(([^)]+)\)/)
  const thumbnailUrl = urlMatch?.[1] ?? ''

  return { title, subtitle, category, uploader, pageCount, fileSize, thumbnailUrl }
}
