import { REGEX } from './constants'

export function parsePagesRange(input: string, totalPages: number): number[] | null {
  const text = input.replace(/，/g, ',').trim()

  if (!text) return []

  if (!REGEX.pagesRange.test(text)) return null

  let normalized = text
  if (normalized[0] === '!') {
    normalized = '1-,' + normalized
  }

  const rangeRegex = /!?(?:(\d*)-(\d*))(?:\/(\d+))?|!?(\d+)/g
  let pages: number[] = []
  let match: RegExpExecArray | null

  while ((match = rangeRegex.exec(normalized)) !== null) {
    const selected: number[] = []
    const single = Number(match[4])

    if (!isNaN(single) && match[4] !== undefined) {
      selected.push(single)
    } else {
      const begin = Number(match[1]) || 1
      const end = Number(match[2]) || totalPages
      const [lo, hi] = begin <= end ? [begin, end] : [end, begin]
      const step = Number(match[3]) || 1

      for (let i = lo; i <= hi; i += step) {
        selected.push(i)
      }
    }

    if (match[0][0] === '!') {
      pages = pages.filter(e => !selected.includes(e))
    } else {
      pages.push(...selected)
    }
  }

  pages.sort((a, b) => a - b)
  pages = pages.filter((e, i, arr) => i === 0 || e !== arr[i - 1])
  pages = pages.filter(e => e >= 1 && e <= totalPages)

  return pages
}
