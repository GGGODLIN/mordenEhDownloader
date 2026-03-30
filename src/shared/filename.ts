export interface TemplateVars {
  gid: string
  token: string
  title: string
  subtitle: string
  category: string
  uploader: string
}

const DANGER_CHARS = /[:"*?|<>\/\\~\n]/g

export function getSafeName(str: string): string {
  return str.replace(DANGER_CHARS, '-').trim()
}

export function applyTemplate(template: string, vars: TemplateVars): string {
  const subtitle = vars.subtitle || vars.title
  return template
    .replace(/\{gid\}/gi, vars.gid)
    .replace(/\{token\}/gi, vars.token)
    .replace(/\{title\}/gi, getSafeName(vars.title))
    .replace(/\{subtitle\}/gi, getSafeName(subtitle))
    .replace(/\{category\}/gi, vars.category)
    .replace(/\{uploader\}/gi, getSafeName(vars.uploader))
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
