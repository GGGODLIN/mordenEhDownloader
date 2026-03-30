import { describe, it, expect } from 'vitest'
import { parseGalleryUrl, parseGalleryMetadata } from '@shared/gallery-parser'

describe('parseGalleryUrl', () => {
  it('parses e-hentai gallery URL', () => {
    const url = 'https://e-hentai.org/g/2750736/abc123def/'
    expect(parseGalleryUrl(url)).toEqual({ gid: '2750736', token: 'abc123def' })
  })

  it('parses exhentai gallery URL', () => {
    const url = 'https://exhentai.org/g/1234567/xyz789abc/'
    expect(parseGalleryUrl(url)).toEqual({ gid: '1234567', token: 'xyz789abc' })
  })

  it('returns null for invalid URL', () => {
    expect(parseGalleryUrl('https://e-hentai.org/')).toBeNull()
    expect(parseGalleryUrl('https://example.com/foo/bar')).toBeNull()
    expect(parseGalleryUrl('')).toBeNull()
  })
})

describe('parseGalleryMetadata', () => {
  function buildDoc(html: string): Document {
    const parser = new DOMParser()
    return parser.parseFromString(html, 'text/html')
  }

  const sampleHtml = `
    <html><body>
      <h1 id="gn">Test Gallery Title</h1>
      <h2 id="gj">日本語サブタイトル</h2>
      <div id="gdc"><div class="cs">Doujinshi</div></div>
      <div id="gdn">TestUploader</div>
      <div id="gdd">
        Length: 42 pages
        File Size: 123.4 MB
      </div>
      <div id="gd1">
        <div style="background:url(https://ehgt.org/thumb.jpg) center"></div>
      </div>
    </body></html>
  `

  it('extracts title', () => {
    const doc = buildDoc(sampleHtml)
    expect(parseGalleryMetadata(doc).title).toBe('Test Gallery Title')
  })

  it('extracts subtitle', () => {
    const doc = buildDoc(sampleHtml)
    expect(parseGalleryMetadata(doc).subtitle).toBe('日本語サブタイトル')
  })

  it('extracts category in uppercase', () => {
    const doc = buildDoc(sampleHtml)
    expect(parseGalleryMetadata(doc).category).toBe('DOUJINSHI')
  })

  it('extracts page count', () => {
    const doc = buildDoc(sampleHtml)
    expect(parseGalleryMetadata(doc).pageCount).toBe(42)
  })

  it('extracts file size', () => {
    const doc = buildDoc(sampleHtml)
    expect(parseGalleryMetadata(doc).fileSize).toBe('123.4 MB')
  })

  it('extracts thumbnail URL', () => {
    const doc = buildDoc(sampleHtml)
    expect(parseGalleryMetadata(doc).thumbnailUrl).toBe('https://ehgt.org/thumb.jpg')
  })

  it('returns empty strings and zero when elements are missing', () => {
    const doc = buildDoc('<html><body></body></html>')
    const meta = parseGalleryMetadata(doc)
    expect(meta.title).toBe('')
    expect(meta.subtitle).toBe('')
    expect(meta.category).toBe('')
    expect(meta.uploader).toBe('')
    expect(meta.pageCount).toBe(0)
    expect(meta.fileSize).toBe('')
    expect(meta.thumbnailUrl).toBe('')
  })
})
