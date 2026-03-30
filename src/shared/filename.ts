export interface TemplateVars {
  gid: string
  token: string
  title: string
  subtitle: string
  category: string
  uploader: string
}

const DANGER_CHARS = /[:"*?|<>\/\\~\n]/g

const FULL_WIDTH_MAP: Record<string, string> = {
  ':': '\uFF1A',
  '"': '\uFF02',
  '*': '\uFF0A',
  '?': '\uFF1F',
  '|': '\uFF5C',
  '<': '\uFF1C',
  '>': '\uFF1E',
  '/': '\uFF0F',
  '\\': '\uFF3C',
  '~': '\uFF5E',
  '\n': '-',
}

export function getSafeName(str: string, useFullWidth?: boolean): string {
  if (useFullWidth) {
    return str.replace(DANGER_CHARS, (ch) => FULL_WIDTH_MAP[ch] ?? '-').trim()
  }
  return str.replace(DANGER_CHARS, '-').trim()
}

export function applyTemplate(template: string, vars: TemplateVars, useFullWidth?: boolean): string {
  const subtitle = vars.subtitle || vars.title
  return template
    .replace(/\{gid\}/gi, vars.gid)
    .replace(/\{token\}/gi, vars.token)
    .replace(/\{title\}/gi, getSafeName(vars.title, useFullWidth))
    .replace(/\{subtitle\}/gi, getSafeName(subtitle, useFullWidth))
    .replace(/\{category\}/gi, vars.category)
    .replace(/\{uploader\}/gi, getSafeName(vars.uploader, useFullWidth))
}

export function renameImageDuplicates(names: string[]): string[] {
  const counts = new Map<string, number>()
  return names.map(name => {
    const lower = name.toLowerCase()
    const count = counts.get(lower) ?? 0
    counts.set(lower, count + 1)
    if (count === 0) return name

    const dotIndex = name.lastIndexOf('.')
    if (dotIndex === -1) return `${name} (${count + 1})`
    const base = name.slice(0, dotIndex)
    const ext = name.slice(dotIndex)
    return `${base} (${count + 1})${ext}`
  })
}

export function numberImageName(name: string, index: number, total: number, separator: string): string {
  const padLen = total.toString().length
  const padded = index.toString().padStart(padLen, '0')
  return `${padded}${separator}${name}`
}
