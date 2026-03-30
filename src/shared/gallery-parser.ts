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
  rating: string
  postedDate: string
  metaRows: string[]
  tags: Record<string, string[]>
  uploaderComment: string
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

  const ratingEl = doc.getElementById('rating_label')
  const rating = ratingEl?.textContent?.replace('Average:', '').trim() ?? ''

  const postedRow = doc.getElementById('gdd')?.innerHTML ?? ''
  const postedMatch = postedRow.match(/Posted:<\/td><td[^>]*>(.*?)<\/td>/)
  const postedDate = postedMatch?.[1]?.trim() ?? ''

  const metaRows: string[] = []
  const metaNodes = doc.querySelectorAll('#gdd tr')
  metaNodes.forEach(tr => {
    const c1 = tr.querySelector('.gdt1')?.textContent?.trim() ?? ''
    const c2 = tr.querySelector('.gdt2')?.textContent?.trim() ?? ''
    if (c1 && c2) metaRows.push(`${c1} ${c2}`)
  })

  const tags: Record<string, string[]> = {}
  const tagRows = doc.querySelectorAll('#taglist tr')
  tagRows.forEach(tr => {
    const tds = tr.querySelectorAll('td')
    if (tds.length < 2) return
    const namespace = tds[0].textContent?.trim().replace(/:$/, '') ?? ''
    const tagLinks = tds[1].querySelectorAll('a')
    const tagValues: string[] = []
    tagLinks.forEach(a => {
      const text = a.textContent?.trim()
      if (text) tagValues.push(text)
    })
    if (namespace && tagValues.length > 0) tags[namespace] = tagValues
  })

  const commentEl = doc.getElementById('comment_0')
  const uploaderComment = commentEl?.innerHTML
    ?.replace(/<br\s*\/?>/gi, '\n')
    ?.replace(/<[^>]+>/g, '')
    ?.trim() ?? ''

  return { title, subtitle, category, uploader, pageCount, fileSize, thumbnailUrl, rating, postedDate, metaRows, tags, uploaderComment }
}
