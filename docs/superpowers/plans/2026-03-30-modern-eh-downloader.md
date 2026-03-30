# Modern E-Hentai Downloader — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome Extension (MV3) with a React dashboard that replaces the E-Hentai Downloader userscript — content script adds galleries to a queue, dashboard manages downloads.

**Architecture:** Dashboard-centric — the Dashboard tab performs all downloading via `fetch` (CORS bypassed by `host_permissions`). Images stored in OPFS to avoid memory pressure. Background service worker is lightweight (queue coordination + badge). Content script injects a button on gallery pages.

**Tech Stack:** Vite + CRXJS, React 18, TypeScript, Tailwind CSS, JSZip, OPFS, chrome.storage.local

**Spec:** `docs/superpowers/specs/2026-03-30-modern-eh-downloader-design.md`

**Original script reference:** `ehDownloader.js` (v1.36.1) — download logic is ported from this file.

---

## File Structure

```
manifest.json                          — MV3 manifest with host_permissions
vite.config.ts                         — Vite + CRXJS config
tailwind.config.ts                     — Tailwind with dark mode (class strategy)
tsconfig.json                          — TypeScript config
package.json                           — Dependencies

src/
├── shared/
│   ├── types.ts                       — QueueItem, ImageTask, Settings, ImageLimits
│   ├── constants.ts                   — Default settings, regex patterns, template variables
│   ├── storage.ts                     — Typed chrome.storage.local wrapper
│   ├── pages-range.ts                 — Pages range parser (pure function)
│   ├── gallery-parser.ts              — Parse gallery info from HTML string
│   ├── filename.ts                    — Template replacement, safe filename, rename duplicates
│   └── checksum.ts                    — SHA-1 checksum via crypto.subtle
│
├── background/
│   └── index.ts                       — Service worker: message handler, badge update
│
├── content/
│   ├── index.ts                       — Inject UI into gallery page, send message
│   └── inject.css                     — Injected button/input styles
│
├── dashboard/
│   ├── index.html                     — Dashboard HTML entry
│   ├── main.tsx                       — React entry point
│   ├── App.tsx                        — Root layout: Header + Sidebar + MainArea
│   ├── components/
│   │   ├── Header.tsx                 — Logo, Image Limits display, Settings button
│   │   ├── Sidebar.tsx                — Queue/History tabs, gallery list
│   │   ├── QueueItem.tsx              — Single gallery card in sidebar
│   │   ├── MainArea.tsx               — Selected gallery detail or empty state
│   │   ├── GalleryDetail.tsx          — Metadata, overall progress, action buttons
│   │   ├── ImageProgressTable.tsx     — Per-image progress rows
│   │   ├── ImageProgressRow.tsx       — Single image progress row
│   │   ├── SettingsModal.tsx          — Settings modal with 3 sections
│   │   └── Banner.tsx                 — Error/warning banners (IP ban, limits exceeded)
│   ├── hooks/
│   │   ├── useStorage.ts             — Subscribe to chrome.storage changes
│   │   ├── useDownloadEngine.ts      — Connect engine to React state
│   │   └── useImageLimits.ts         — Periodic Image Limits fetcher
│   ├── store/
│   │   └── download-store.ts         — Download state (React context + useReducer)
│   └── services/
│       ├── storage-manager.ts         — OPFS read/write/delete/list
│       ├── page-fetcher.ts            — Fetch all page URLs from gallery
│       ├── image-fetcher.ts           — Download single image with error handling
│       ├── zip-packer.ts              — OPFS → JSZip → chrome.downloads
│       ├── gallery-downloader.ts      — Orchestrate single gallery download
│       ├── queue-manager.ts           — Multi-gallery queue scheduling
│       └── error-classifier.ts        — Classify response errors (7 layers)
│
└── tests/
    ├── shared/
    │   ├── pages-range.test.ts
    │   ├── filename.test.ts
    │   ├── gallery-parser.test.ts
    │   └── checksum.test.ts
    └── services/
        ├── error-classifier.test.ts
        └── queue-manager.test.ts
```

---

## Phase 1: Project Foundation

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `manifest.json`, `src/dashboard/index.html`, `src/dashboard/main.tsx`, `src/dashboard/App.tsx`, `src/background/index.ts`, `src/content/index.ts`, `src/content/inject.css`

- [ ] **Step 1: Initialize project and install dependencies**

```bash
cd /Users/linhancheng/Desktop/work/mordenEhDownloader
npm init -y
npm install react react-dom jszip
npm install -D typescript vite @crxjs/vite-plugin@beta @types/react @types/react-dom @types/chrome tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@dashboard/*": ["src/dashboard/*"],
      "@services/*": ["src/dashboard/services/*"]
    },
    "types": ["chrome", "vitest/globals"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@dashboard': resolve(__dirname, 'src/dashboard'),
      '@services': resolve(__dirname, 'src/dashboard/services'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
  },
})
```

- [ ] **Step 4: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "E-Hentai Downloader",
  "version": "2.0.0",
  "description": "Modern download dashboard for E-Hentai galleries",
  "permissions": [
    "storage",
    "downloads"
  ],
  "host_permissions": [
    "*://*.e-hentai.org/*",
    "*://*.exhentai.org/*",
    "*://*.hath.network/*"
  ],
  "background": {
    "service_worker": "src/background/index.ts",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.e-hentai.org/g/*",
        "*://*.exhentai.org/g/*"
      ],
      "js": ["src/content/index.ts"],
      "css": ["src/content/inject.css"]
    }
  ],
  "action": {
    "default_title": "Open E-Hentai Downloader Dashboard"
  },
  "icons": {
    "48": "public/icons/icon-48.png",
    "128": "public/icons/icon-128.png"
  }
}
```

- [ ] **Step 5: Create tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/dashboard/**/*.{tsx,ts,html}'],
  darkMode: 'media',
} satisfies Config
```

- [ ] **Step 6: Create minimal Dashboard entry files**

`src/dashboard/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>E-Hentai Downloader</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

`src/dashboard/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

`src/dashboard/index.css`:
```css
@import 'tailwindcss';
```

`src/dashboard/App.tsx`:
```tsx
export default function App() {
  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <h1 className="p-4 text-xl font-bold">E-Hentai Downloader</h1>
    </div>
  )
}
```

- [ ] **Step 7: Create minimal Background service worker**

`src/background/index.ts`:
```typescript
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') })
})
```

- [ ] **Step 8: Create minimal Content Script**

`src/content/index.ts`:
```typescript
console.log('[EHD] Content script loaded')
```

`src/content/inject.css`:
```css
/* placeholder */
```

- [ ] **Step 9: Create placeholder icon**

```bash
mkdir -p public/icons
# Create a simple 48x48 and 128x128 PNG placeholder (solid color square)
```

Use any solid-color PNG as placeholder. Replace later with real icon.

- [ ] **Step 10: Verify build**

```bash
npm run dev
```

Expected: Vite starts, extension builds without errors.

- [ ] **Step 11: Load extension in Chrome and verify**

1. Open `chrome://extensions/`
2. Enable Developer Mode
3. Click "Load unpacked" → select `dist/` folder
4. Click the extension icon → Dashboard tab opens with "E-Hentai Downloader" heading

- [ ] **Step 12: Commit**

```bash
git init
echo "node_modules/\ndist/\n.vite/" > .gitignore
git add .
git commit -m "feat: scaffold Chrome Extension with Vite + React + Tailwind"
```

---

## Phase 2: Shared Utilities

### Task 2: Types & Constants

**Files:**
- Create: `src/shared/types.ts`, `src/shared/constants.ts`

- [ ] **Step 1: Create shared types**

`src/shared/types.ts`:
```typescript
export interface QueueItem {
  id: string
  gid: string
  token: string
  title: string
  subtitle: string
  category: string
  uploader: string
  pageCount: number
  fileSize: string
  thumbnailUrl: string
  pagesRange: string
  addedAt: number
  status: 'queued' | 'downloading' | 'paused' | 'completed' | 'failed'
}

export interface ImageTask {
  galleryId: string
  index: number
  realIndex: number
  pageUrl: string
  imageUrl: string | null
  imageName: string | null
  status: 'pending' | 'fetching' | 'hashing' | 'done' | 'failed'
  progress: number
  speed: number
  retryCount: number
  error: string | null
}

export interface Settings {
  threadCount: number
  maxConcurrentGalleries: number
  retryCount: number
  timeout: number
  speedDetect: boolean
  speedMinKBs: number
  speedExpiredSec: number
  periodicRetrySec: number
  dirNameTemplate: string
  fileNameTemplate: string
  numberImages: boolean
  numberSeparator: string
  checksum: boolean
  peakHoursWarning: boolean
  imageLimitsWarning: boolean
}

export interface ImageLimits {
  current: number
  total: number
  isDonator: boolean
  isSuspended: boolean
  isIpBanned: boolean
  timestamp: number
}

export type ImageTaskStatus = ImageTask['status']
export type QueueItemStatus = QueueItem['status']

export type ErrorType =
  | 'empty_response'
  | 'access_denied'
  | 'limits_exceeded'
  | 'ip_banned'
  | 'account_suspended'
  | 'http_error'
  | 'wrong_mime'
  | 'checksum_mismatch'
  | 'network_error'
  | 'timeout'
  | 'low_speed'
  | 'stall_detected'
  | 'unknown'

export interface ClassifiedError {
  type: ErrorType
  message: string
  shouldRetry: boolean
  shouldPauseAll: boolean
  forceRetry: boolean
}
```

- [ ] **Step 2: Create constants**

`src/shared/constants.ts`:
```typescript
import type { Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  threadCount: 5,
  maxConcurrentGalleries: 1,
  retryCount: 3,
  timeout: 300,
  speedDetect: true,
  speedMinKBs: 5,
  speedExpiredSec: 30,
  periodicRetrySec: 60,
  dirNameTemplate: '/',
  fileNameTemplate: '{title}',
  numberImages: false,
  numberSeparator: '：',
  checksum: true,
  peakHoursWarning: true,
  imageLimitsWarning: true,
}

export const TEMPLATE_VARS = [
  '{gid}', '{token}', '{title}', '{subtitle}', '{category}', '{uploader}',
] as const

export const REGEX = {
  imageURL: [
    /<a href="(\S+?\/fullimg(?:\.php\?|\/)\S+?)"/,
    /<img id="img" src="(\S+?)"/,
    /<\/(?:script|iframe)><a[\s\S]+?><img src="(\S+?)"/,
  ],
  fileName: /g\/l.png"\s?\/?><\/a><\/div><div>([\s\S]+?) :: /,
  resFileName: /filename=['"]?([\s\S]+?)['"]?$/m,
  nl: /return nl\('([\d\w-]+)'\)/,
  dangerChars: /[:"*?|<>\/\\\n]/g,
  pagesRange: /^(!?\d*(-\d*(\/\d+)?)?\s*,\s*)*!?\d*(-\d*(\/\d+)?)?$/,
  pagesURL: /(?:<a href=").+?(?=")/gi,
  mpvKey: /var imagelist\s*=\s*(\[.+?\]);/,
  imageLimits: /You are currently at <strong>([\d,]+)<\/strong> towards.*?limit of <strong>([\d,]+)<\/strong>/,
  pagesLength: /<table class="ptt".+>(\d+)<\/a>.+?<\/table>/,
  IPBanExpires: /The ban expires in \d+ hours?( and \d+ minutes?)?/,
  donatorPower: /<td>Donations<\/td><td.*>([+-]?[\d.]+)<\/td>/,
  postedTime: /<td.*?>Posted:<\/td><td.*?>(.*?)<\/td>/,
  originalImagePattern: /\/fullimg(?:\.php\?|\/)/,
  imageUrlParse: {
    signature: /(\w{40})-(\d+)-(\d+)-(\d+)-(\w+)/,
    h: /\/h\/(.+?)\/(.+?)\/(.+$)/,
    om: /\/om\/(\d+?)\/(.+?)\/(.+?)\/(\d+)\/.+?\/(.+$)/,
  },
  pageUrlParse: /\/s\/(\w+)\/(\d+)-(\d+)/,
  slashOnly: /^[\\/]*$/,
} as const

export const WATCHDOG_TIMEOUT_MS = 30_000

export const IMAGE_MIME_TYPES = [
  'image', 'jpg', 'jpeg', 'gif', 'png', 'bmp', 'tif', 'tiff', 'webp', 'apng',
] as const

export const ACCESS_DENIED_BYTE_SIZES = [925, 28] as const

export const LIMITS_EXCEEDED_BYTE_SIZES = [142, 144, 28658, 102, 93] as const

export const LIMITS_EXCEEDED_STRINGS = [
  'You have exceeded your image viewing limits',
  'do not have sufficient GP to buy',
  'requires GP, and you do not have enough',
] as const

export const MESSAGE_TYPES = {
  ADD_TO_QUEUE: 'ADD_TO_QUEUE',
  OPEN_DASHBOARD: 'OPEN_DASHBOARD',
} as const
```

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/shared/types.ts src/shared/constants.ts
git commit -m "feat: add shared types and constants"
```

---

### Task 3: Pages Range Parser

**Files:**
- Create: `src/shared/pages-range.ts`, `src/tests/shared/pages-range.test.ts`

- [ ] **Step 1: Write failing tests**

`src/tests/shared/pages-range.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { parsePagesRange } from '@shared/pages-range'

describe('parsePagesRange', () => {
  it('returns empty array for empty string', () => {
    expect(parsePagesRange('', 100)).toEqual([])
  })

  it('parses single page', () => {
    expect(parsePagesRange('5', 100)).toEqual([5])
  })

  it('parses range', () => {
    expect(parsePagesRange('3-6', 100)).toEqual([3, 4, 5, 6])
  })

  it('parses range with open end', () => {
    expect(parsePagesRange('98-', 100)).toEqual([98, 99, 100])
  })

  it('parses range with open start', () => {
    expect(parsePagesRange('-3', 100)).toEqual([1, 2, 3])
  })

  it('parses range with step', () => {
    expect(parsePagesRange('1-10/3', 100)).toEqual([1, 4, 7, 10])
  })

  it('parses multiple ranges separated by comma', () => {
    expect(parsePagesRange('1-3,7,10-12', 100)).toEqual([1, 2, 3, 7, 10, 11, 12])
  })

  it('parses negative range (exclusion)', () => {
    expect(parsePagesRange('1-10,!5-7', 100)).toEqual([1, 2, 3, 4, 8, 9, 10])
  })

  it('handles negative range at start (selects all first)', () => {
    expect(parsePagesRange('!5', 10)).toEqual([1, 2, 3, 4, 6, 7, 8, 9, 10])
  })

  it('deduplicates and sorts', () => {
    expect(parsePagesRange('5,3,5,1', 100)).toEqual([1, 3, 5])
  })

  it('filters out pages exceeding total', () => {
    expect(parsePagesRange('8-12', 10)).toEqual([8, 9, 10])
  })

  it('handles full-width comma', () => {
    expect(parsePagesRange('1，3，5', 100)).toEqual([1, 3, 5])
  })

  it('returns null for invalid format', () => {
    expect(parsePagesRange('abc', 100)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/tests/shared/pages-range.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement pages range parser**

`src/shared/pages-range.ts`:
```typescript
import { REGEX } from './constants'

export function parsePagesRange(input: string, totalPages: number): number[] | null {
  const text = input.replace(/，/g, ',').trim()
  if (!text) return []

  if (!REGEX.pagesRange.test(text)) return null

  let effectiveText = text
  if (effectiveText[0] === '!') {
    effectiveText = '1-,' + effectiveText
  }

  const rangeRegex = /!?(?:(\d*)-(\d*))(?:\/(\d+))?|!?(\d+)/g
  let result: number[] = []
  let matches: RegExpExecArray | null

  while ((matches = rangeRegex.exec(effectiveText)) !== null) {
    const selected: number[] = []
    const single = Number(matches[4])

    if (!isNaN(single)) {
      selected.push(single)
    } else {
      let begin = Number(matches[1]) || 1
      let end = Number(matches[2]) || totalPages
      if (begin > end) {
        const tmp = begin
        begin = end
        end = tmp
      }
      const mod = Number(matches[3]) || 1
      for (let i = begin; i <= end; i += mod) {
        selected.push(i)
      }
    }

    if (matches[0][0] === '!') {
      result = result.filter(e => !selected.includes(e))
    } else {
      selected.forEach(e => result.push(e))
    }
  }

  result.sort((a, b) => a - b)
  result = result.filter((e, i, arr) => i === 0 || e !== arr[i - 1])
  result = result.filter(e => e <= totalPages)

  return result
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/tests/shared/pages-range.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/pages-range.ts src/tests/shared/pages-range.test.ts
git commit -m "feat: add pages range parser with tests"
```

---

### Task 4: Filename Utilities

**Files:**
- Create: `src/shared/filename.ts`, `src/tests/shared/filename.test.ts`

- [ ] **Step 1: Write failing tests**

`src/tests/shared/filename.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { getSafeName, applyTemplate, renameImageDuplicates } from '@shared/filename'

describe('getSafeName', () => {
  it('replaces dangerous characters with dashes', () => {
    expect(getSafeName('file:name*test?.jpg')).toBe('file-name-test-.jpg')
  })

  it('trims whitespace', () => {
    expect(getSafeName('  hello.jpg  ')).toBe('hello.jpg')
  })

  it('replaces newlines', () => {
    expect(getSafeName('hello\nworld.jpg')).toBe('hello-world.jpg')
  })
})

describe('applyTemplate', () => {
  const vars = {
    gid: '12345',
    token: 'abc',
    title: 'Test Title',
    subtitle: 'Sub Title',
    category: 'DOUJINSHI',
    uploader: 'user1',
  }

  it('replaces all template variables', () => {
    expect(applyTemplate('{gid}_{token}', vars)).toBe('12345_abc')
  })

  it('handles title template', () => {
    expect(applyTemplate('{title}', vars)).toBe('Test Title')
  })

  it('replaces subtitle with title if subtitle is empty', () => {
    const noSub = { ...vars, subtitle: '' }
    expect(applyTemplate('{subtitle}', noSub)).toBe('Test Title')
  })

  it('is case insensitive', () => {
    expect(applyTemplate('{GID}', vars)).toBe('12345')
  })
})

describe('renameImageDuplicates', () => {
  it('leaves unique names unchanged', () => {
    const names = ['a.jpg', 'b.jpg', 'c.jpg']
    expect(renameImageDuplicates(names)).toEqual(['a.jpg', 'b.jpg', 'c.jpg'])
  })

  it('renames duplicates with suffix', () => {
    const names = ['a.jpg', 'a.jpg', 'a.jpg']
    expect(renameImageDuplicates(names)).toEqual(['a.jpg', 'a (2).jpg', 'a (3).jpg'])
  })

  it('handles case-insensitive duplicates', () => {
    const names = ['A.jpg', 'a.jpg']
    expect(renameImageDuplicates(names)).toEqual(['A.jpg', 'a (2).jpg'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/tests/shared/filename.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement filename utilities**

`src/shared/filename.ts`:
```typescript
import { REGEX } from './constants'

const REPLACE_MAP: Record<string, string> = {
  ':': '-', '"': '-', '*': '-', '?': '-', '|': '-',
  '<': '-', '>': '-', '/': '-', '\\': '-', '~': '-', '\n': '-',
}

export function getSafeName(str: string): string {
  return str.trim().replace(REGEX.dangerChars, (match) => REPLACE_MAP[match] ?? '-')
}

interface TemplateVars {
  gid: string
  token: string
  title: string
  subtitle: string
  category: string
  uploader: string
}

export function applyTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{gid\}/gi, vars.gid)
    .replace(/\{token\}/gi, vars.token)
    .replace(/\{title\}/gi, getSafeName(vars.title))
    .replace(/\{subtitle\}/gi, vars.subtitle ? getSafeName(vars.subtitle) : getSafeName(vars.title))
    .replace(/\{tag\}|\{category\}/gi, vars.category)
    .replace(/\{uploader\}/gi, getSafeName(vars.uploader))
}

export function renameImageDuplicates(names: string[]): string[] {
  const result = [...names]
  const countMap = new Map<string, number>()

  for (let i = 0; i < result.length; i++) {
    const lowerName = result[i].toLowerCase()
    const existing = countMap.get(lowerName)

    if (existing !== undefined) {
      const count = existing + 1
      countMap.set(lowerName, count)
      const parts = result[i].split('.')
      const ext = parts.pop()!
      result[i] = `${parts.join('.')} (${count}).${ext}`
    } else {
      countMap.set(lowerName, 1)
    }
  }

  return result
}

export function numberImageName(
  name: string,
  index: number,
  total: number,
  separator: string,
): string {
  const len = Math.max(total.toString().length, 3)
  const padded = index.toString().padStart(len, '0')
  return `${padded}${separator}${name}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/tests/shared/filename.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/filename.ts src/tests/shared/filename.test.ts
git commit -m "feat: add filename utilities with tests"
```

---

### Task 5: Checksum & Error Classifier

**Files:**
- Create: `src/shared/checksum.ts`, `src/dashboard/services/error-classifier.ts`, `src/tests/shared/checksum.test.ts`, `src/tests/services/error-classifier.test.ts`

- [ ] **Step 1: Write checksum tests**

`src/tests/shared/checksum.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { getSha1Checksum } from '@shared/checksum'

describe('getSha1Checksum', () => {
  it('returns hex string for valid data', async () => {
    const data = new TextEncoder().encode('hello world')
    const result = await getSha1Checksum(data.buffer as ArrayBuffer)
    expect(result).toBe('2aae6c35c94fcfb415dbe95f408b9ce91ee846ed')
  })

  it('returns null if crypto.subtle is unavailable', async () => {
    const original = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true })
    const data = new TextEncoder().encode('test')
    const result = await getSha1Checksum(data.buffer as ArrayBuffer)
    expect(result).toBeNull()
    Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true })
  })
})
```

- [ ] **Step 2: Write error classifier tests**

`src/tests/services/error-classifier.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { classifyImageResponse } from '@services/error-classifier'

describe('classifyImageResponse', () => {
  it('detects empty response', () => {
    const result = classifyImageResponse(200, null, '', 0)
    expect(result.type).toBe('empty_response')
    expect(result.shouldRetry).toBe(true)
  })

  it('detects 403 by byte size 925', () => {
    const result = classifyImageResponse(200, new ArrayBuffer(925), 'image/jpeg', 925)
    expect(result.type).toBe('access_denied')
    expect(result.forceRetry).toBe(true)
  })

  it('detects limits exceeded by text content', () => {
    const text = 'You have exceeded your image viewing limits'
    const buf = new TextEncoder().encode(text)
    const result = classifyImageResponse(200, buf.buffer as ArrayBuffer, 'text/html', buf.byteLength)
    expect(result.type).toBe('limits_exceeded')
    expect(result.shouldPauseAll).toBe(true)
  })

  it('detects IP ban', () => {
    const text = 'Your IP address has been temporarily banned'
    const buf = new TextEncoder().encode(text)
    const result = classifyImageResponse(200, buf.buffer as ArrayBuffer, 'text/html', buf.byteLength)
    expect(result.type).toBe('ip_banned')
    expect(result.shouldPauseAll).toBe(true)
  })

  it('detects account suspended', () => {
    const text = 'as your account has been suspended'
    const buf = new TextEncoder().encode(text)
    const result = classifyImageResponse(200, buf.buffer as ArrayBuffer, 'text/html', buf.byteLength)
    expect(result.type).toBe('account_suspended')
    expect(result.shouldPauseAll).toBe(true)
  })

  it('detects non-200 status', () => {
    const result = classifyImageResponse(500, new ArrayBuffer(100), 'text/html', 100)
    expect(result.type).toBe('http_error')
    expect(result.shouldRetry).toBe(true)
  })

  it('detects 404 as non-retryable', () => {
    const result = classifyImageResponse(404, new ArrayBuffer(100), 'text/html', 100)
    expect(result.type).toBe('http_error')
    expect(result.shouldRetry).toBe(false)
  })

  it('detects wrong MIME type', () => {
    const result = classifyImageResponse(200, new ArrayBuffer(5000), 'text/plain', 5000)
    expect(result.type).toBe('wrong_mime')
    expect(result.shouldRetry).toBe(true)
  })

  it('returns null for valid image', () => {
    const result = classifyImageResponse(200, new ArrayBuffer(5000), 'image/jpeg', 5000)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run src/tests/shared/checksum.test.ts src/tests/services/error-classifier.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 4: Implement checksum**

`src/shared/checksum.ts`:
```typescript
export async function getSha1Checksum(data: ArrayBuffer): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle?.digest) {
    return null
  }

  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
```

- [ ] **Step 5: Implement error classifier**

`src/dashboard/services/error-classifier.ts`:
```typescript
import type { ClassifiedError } from '@shared/types'
import {
  ACCESS_DENIED_BYTE_SIZES,
  LIMITS_EXCEEDED_BYTE_SIZES,
  LIMITS_EXCEEDED_STRINGS,
  IMAGE_MIME_TYPES,
} from '@shared/constants'

export function classifyImageResponse(
  status: number,
  body: ArrayBuffer | null,
  contentType: string,
  byteLength: number,
): ClassifiedError | null {
  if (!body) {
    return {
      type: 'empty_response',
      message: 'Empty Response',
      shouldRetry: true,
      shouldPauseAll: false,
      forceRetry: false,
    }
  }

  if ((ACCESS_DENIED_BYTE_SIZES as readonly number[]).includes(byteLength)) {
    return {
      type: 'access_denied',
      message: 'Error 403',
      shouldRetry: true,
      shouldPauseAll: false,
      forceRetry: true,
    }
  }

  const mimeBase = contentType.split('/')[0]
  let responseText: string | undefined

  if (mimeBase === 'text') {
    responseText = new TextDecoder().decode(new DataView(body))
  }

  if (
    (LIMITS_EXCEEDED_BYTE_SIZES as readonly number[]).includes(byteLength) ||
    (responseText && LIMITS_EXCEEDED_STRINGS.some(s => responseText!.includes(s)))
  ) {
    return {
      type: 'limits_exceeded',
      message: 'Exceed Limits/GPs',
      shouldRetry: false,
      shouldPauseAll: true,
      forceRetry: false,
    }
  }

  if (responseText?.includes('Your IP address has been temporarily banned')) {
    return {
      type: 'ip_banned',
      message: 'IP Banned',
      shouldRetry: false,
      shouldPauseAll: true,
      forceRetry: false,
    }
  }

  if (responseText?.includes('as your account has been suspended')) {
    return {
      type: 'account_suspended',
      message: 'Account Suspended',
      shouldRetry: false,
      shouldPauseAll: true,
      forceRetry: false,
    }
  }

  if (status !== 200) {
    return {
      type: 'http_error',
      message: `Status ${status}`,
      shouldRetry: status !== 404,
      shouldPauseAll: false,
      forceRetry: false,
    }
  }

  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(mimeBase)) {
    return {
      type: 'wrong_mime',
      message: 'Wrong MIME Type',
      shouldRetry: true,
      shouldPauseAll: false,
      forceRetry: false,
    }
  }

  return null
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run src/tests/shared/checksum.test.ts src/tests/services/error-classifier.test.ts
```

Expected: All PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/checksum.ts src/dashboard/services/error-classifier.ts src/tests/
git commit -m "feat: add checksum utility and error classifier with tests"
```

---

### Task 6: Chrome Storage Wrapper

**Files:**
- Create: `src/shared/storage.ts`

- [ ] **Step 1: Implement typed storage wrapper**

`src/shared/storage.ts`:
```typescript
import type { QueueItem, Settings, ImageLimits } from './types'
import { DEFAULT_SETTINGS } from './constants'

interface StorageSchema {
  queue: QueueItem[]
  settings: Settings
  imageLimits: ImageLimits
  history: QueueItem[]
}

type StorageKey = keyof StorageSchema

async function get<K extends StorageKey>(key: K): Promise<StorageSchema[K]> {
  const result = await chrome.storage.local.get(key)
  return result[key]
}

async function set<K extends StorageKey>(key: K, value: StorageSchema[K]): Promise<void> {
  await chrome.storage.local.set({ [key]: value })
}

export const storage = {
  getQueue: () => get('queue').then(q => q ?? []),
  setQueue: (queue: QueueItem[]) => set('queue', queue),

  getSettings: () => get('settings').then(s => ({ ...DEFAULT_SETTINGS, ...s })),
  setSettings: (settings: Settings) => set('settings', settings),

  getImageLimits: () => get('imageLimits').then(l => l ?? {
    current: 0, total: 0, isDonator: false,
    isSuspended: false, isIpBanned: false, timestamp: 0,
  }),
  setImageLimits: (limits: ImageLimits) => set('imageLimits', limits),

  getHistory: () => get('history').then(h => h ?? []),
  setHistory: (history: QueueItem[]) => set('history', history),

  onChanged: (callback: (changes: Partial<Record<StorageKey, chrome.storage.StorageChange>>) => void) => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local') callback(changes)
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  },
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/storage.ts
git commit -m "feat: add typed chrome.storage wrapper"
```

---

## Phase 3: Content Script & Background

### Task 7: Gallery Page Parser

**Files:**
- Create: `src/shared/gallery-parser.ts`, `src/tests/shared/gallery-parser.test.ts`

- [ ] **Step 1: Write failing tests**

`src/tests/shared/gallery-parser.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { parseGalleryUrl, parseGalleryMetadata } from '@shared/gallery-parser'

describe('parseGalleryUrl', () => {
  it('extracts gid and token from e-hentai URL', () => {
    const result = parseGalleryUrl('https://e-hentai.org/g/1234567/abcdef1234/')
    expect(result).toEqual({ gid: '1234567', token: 'abcdef1234' })
  })

  it('extracts gid and token from exhentai URL', () => {
    const result = parseGalleryUrl('https://exhentai.org/g/9876543/xyz789/')
    expect(result).toEqual({ gid: '9876543', token: 'xyz789' })
  })

  it('returns null for invalid URL', () => {
    const result = parseGalleryUrl('https://e-hentai.org/popular')
    expect(result).toBeNull()
  })
})

describe('parseGalleryMetadata', () => {
  const html = `
    <div id="gn">Test Gallery Title</div>
    <div id="gj">テストタイトル</div>
    <div id="gdc"><div class="cs">Doujinshi</div></div>
    <div id="gdn"><a>uploader_name</a></div>
    <div id="gdd">
      <table><tr>
        <td class="gdt1">File Size:</td>
        <td class="gdt2">123.4 MB</td>
      </tr><tr>
        <td class="gdt1">Length:</td>
        <td class="gdt2">42 pages</td>
      </tr></table>
    </div>
  `

  it('extracts title', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const result = parseGalleryMetadata(doc)
    expect(result.title).toBe('Test Gallery Title')
  })

  it('extracts subtitle', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const result = parseGalleryMetadata(doc)
    expect(result.subtitle).toBe('テストタイトル')
  })

  it('extracts category', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const result = parseGalleryMetadata(doc)
    expect(result.category).toBe('DOUJINSHI')
  })

  it('extracts page count', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const result = parseGalleryMetadata(doc)
    expect(result.pageCount).toBe(42)
  })

  it('extracts file size', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const result = parseGalleryMetadata(doc)
    expect(result.fileSize).toBe('123.4 MB')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/tests/shared/gallery-parser.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement gallery parser**

`src/shared/gallery-parser.ts`:
```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/tests/shared/gallery-parser.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/gallery-parser.ts src/tests/shared/gallery-parser.test.ts
git commit -m "feat: add gallery URL and metadata parser with tests"
```

---

### Task 8: Content Script

**Files:**
- Modify: `src/content/index.ts`, `src/content/inject.css`

- [ ] **Step 1: Implement content script**

`src/content/index.ts`:
```typescript
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
}

init()
```

- [ ] **Step 2: Style the injected elements**

`src/content/inject.css`:
```css
.ehd-inject-container {
  margin: 16px auto 20px;
  width: 732px;
  box-sizing: border-box;
  font-size: 13px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.ehd-inject-btn {
  padding: 6px 16px;
  border: 1px solid #4f535b;
  background: #34353b;
  color: #dddddd;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  white-space: nowrap;
}

.ehd-inject-btn:hover {
  background: #4f535b;
}

.ehd-inject-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.ehd-inject-input {
  flex: 1;
  padding: 5px 8px;
  border: 1px solid #4f535b;
  background: #34353b;
  color: #dddddd;
  border-radius: 4px;
  font-size: 13px;
}

.ehd-inject-input::placeholder {
  color: #999999;
}
```

- [ ] **Step 3: Build and manually test on a gallery page**

```bash
npm run build
```

Load extension in Chrome, navigate to an E-Hentai gallery page, verify button and input appear.

- [ ] **Step 4: Commit**

```bash
git add src/content/
git commit -m "feat: add content script with queue button and pages range input"
```

---

### Task 9: Background Service Worker

**Files:**
- Modify: `src/background/index.ts`

- [ ] **Step 1: Implement background message handler**

`src/background/index.ts`:
```typescript
import type { QueueItem } from '@shared/types'
import { MESSAGE_TYPES } from '@shared/constants'
import { storage } from '@shared/storage'

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') })
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === MESSAGE_TYPES.ADD_TO_QUEUE) {
    handleAddToQueue(message.payload as QueueItem)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: String(err) }))
    return true
  }
})

async function handleAddToQueue(item: QueueItem): Promise<void> {
  const queue = await storage.getQueue()
  const exists = queue.some(q => q.id === item.id)
  if (exists) return

  queue.push(item)
  await storage.setQueue(queue)
  await updateBadge(queue)
}

async function updateBadge(queue?: QueueItem[]): Promise<void> {
  const q = queue ?? await storage.getQueue()
  const activeCount = q.filter(item =>
    item.status === 'queued' || item.status === 'downloading'
  ).length
  await chrome.action.setBadgeText({ text: activeCount > 0 ? String(activeCount) : '' })
  await chrome.action.setBadgeBackgroundColor({ color: '#4f535b' })
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.queue) {
    updateBadge(changes.queue.newValue)
  }
})
```

- [ ] **Step 2: Build and test end-to-end**

1. Build extension
2. Open gallery page → click "Add to Queue"
3. Check badge shows "1"
4. Open DevTools → Application → Storage → chrome.storage.local → verify queue entry

- [ ] **Step 3: Commit**

```bash
git add src/background/index.ts
git commit -m "feat: add background service worker with queue management and badge"
```

---

## Phase 4: Dashboard UI

### Task 10: Dashboard Layout Shell

**Files:**
- Modify: `src/dashboard/App.tsx`
- Create: `src/dashboard/components/Header.tsx`, `src/dashboard/components/Sidebar.tsx`, `src/dashboard/components/MainArea.tsx`

- [ ] **Step 1: Create Header component**

`src/dashboard/components/Header.tsx`:
```tsx
interface HeaderProps {
  imageLimitsCurrent: number
  imageLimitsTotal: number
  onOpenSettings: () => void
}

export default function Header({ imageLimitsCurrent, imageLimitsTotal, onOpenSettings }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-gray-200 px-6 py-3 dark:border-gray-700">
      <h1 className="text-lg font-bold">E-Hentai Downloader</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Image Limits: {imageLimitsCurrent} / {imageLimitsTotal}
        </span>
        <button
          onClick={onOpenSettings}
          className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          Settings
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Create Sidebar component**

`src/dashboard/components/Sidebar.tsx`:
```tsx
import { useState } from 'react'
import type { QueueItem } from '@shared/types'
import QueueItemCard from './QueueItem'

interface SidebarProps {
  queue: QueueItem[]
  history: QueueItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}

export default function Sidebar({ queue, history, selectedId, onSelect, onRemove }: SidebarProps) {
  const [tab, setTab] = useState<'queue' | 'history'>('queue')
  const items = tab === 'queue' ? queue : history

  return (
    <aside className="flex w-72 flex-col border-r border-gray-200 dark:border-gray-700">
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setTab('queue')}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            tab === 'queue'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Queue ({queue.length})
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            tab === 'history'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          History ({history.length})
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.map(item => (
          <QueueItemCard
            key={item.id}
            item={item}
            isSelected={item.id === selectedId}
            onSelect={() => onSelect(item.id)}
            onRemove={() => onRemove(item.id)}
          />
        ))}
        {items.length === 0 && (
          <p className="p-4 text-center text-sm text-gray-400">
            {tab === 'queue' ? 'No downloads in queue' : 'No download history'}
          </p>
        )}
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Create QueueItem card component**

`src/dashboard/components/QueueItem.tsx`:
```tsx
import type { QueueItem as QueueItemType } from '@shared/types'

interface QueueItemCardProps {
  item: QueueItemType
  isSelected: boolean
  onSelect: () => void
  onRemove: () => void
}

const STATUS_COLORS: Record<QueueItemType['status'], string> = {
  queued: 'text-gray-400',
  downloading: 'text-blue-500',
  paused: 'text-yellow-500',
  completed: 'text-green-500',
  failed: 'text-red-500',
}

export default function QueueItemCard({ item, isSelected, onSelect, onRemove }: QueueItemCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`group flex cursor-pointer gap-3 border-b border-gray-100 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800 ${
        isSelected ? 'bg-gray-100 dark:bg-gray-800' : ''
      }`}
    >
      {item.thumbnailUrl && (
        <img
          src={item.thumbnailUrl}
          alt=""
          className="h-14 w-10 rounded object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className={`text-xs ${STATUS_COLORS[item.status]}`}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </p>
        <p className="text-xs text-gray-400">{item.pageCount} pages</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="hidden text-gray-400 hover:text-red-500 group-hover:block"
        title="Remove"
      >
        ×
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Create MainArea placeholder**

`src/dashboard/components/MainArea.tsx`:
```tsx
import type { QueueItem, ImageTask } from '@shared/types'

interface MainAreaProps {
  selectedItem: QueueItem | null
  imageTasks: ImageTask[]
  onPause: () => void
  onResume: () => void
  onRetryFailed: () => void
  onCancel: () => void
}

export default function MainArea({ selectedItem }: MainAreaProps) {
  if (!selectedItem) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-400">
        Select a gallery from the sidebar
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-lg font-bold">{selectedItem.title}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {selectedItem.category} | {selectedItem.uploader} | {selectedItem.pageCount} pages | {selectedItem.fileSize}
      </p>
      <p className="mt-4 text-sm text-gray-400">Download details will appear here.</p>
    </div>
  )
}
```

- [ ] **Step 5: Wire layout in App.tsx**

`src/dashboard/App.tsx`:
```tsx
import { useState, useEffect } from 'react'
import type { QueueItem } from '@shared/types'
import { storage } from '@shared/storage'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import MainArea from './components/MainArea'

export default function App() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [history, setHistory] = useState<QueueItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    storage.getQueue().then(setQueue)
    storage.getHistory().then(setHistory)

    return storage.onChanged((changes) => {
      if (changes.queue?.newValue) setQueue(changes.queue.newValue)
      if (changes.history?.newValue) setHistory(changes.history.newValue)
    })
  }, [])

  const selectedItem = [...queue, ...history].find(item => item.id === selectedId) ?? null

  const handleRemove = async (id: string) => {
    const updated = queue.filter(item => item.id !== id)
    await storage.setQueue(updated)
    if (selectedId === id) setSelectedId(null)
  }

  return (
    <div className="flex h-screen flex-col bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <Header
        imageLimitsCurrent={0}
        imageLimitsTotal={0}
        onOpenSettings={() => setShowSettings(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          queue={queue}
          history={history}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRemove={handleRemove}
        />
        <MainArea
          selectedItem={selectedItem}
          imageTasks={[]}
          onPause={() => {}}
          onResume={() => {}}
          onRetryFailed={() => {}}
          onCancel={() => {}}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Build and verify layout in browser**

```bash
npm run build
```

Open Dashboard → verify Header, Sidebar, and Main Area render correctly in both light and dark mode.

- [ ] **Step 7: Commit**

```bash
git add src/dashboard/
git commit -m "feat: add dashboard layout shell with Header, Sidebar, MainArea"
```

---

### Task 11: Gallery Detail View & Image Progress Table

**Files:**
- Create: `src/dashboard/components/GalleryDetail.tsx`, `src/dashboard/components/ImageProgressTable.tsx`, `src/dashboard/components/ImageProgressRow.tsx`, `src/dashboard/components/Banner.tsx`
- Modify: `src/dashboard/components/MainArea.tsx`

- [ ] **Step 1: Create ImageProgressRow**

`src/dashboard/components/ImageProgressRow.tsx`:
```tsx
import type { ImageTask } from '@shared/types'

interface ImageProgressRowProps {
  task: ImageTask
}

const STATUS_CLASS: Record<ImageTask['status'], string> = {
  pending: 'text-gray-400',
  fetching: 'text-blue-500',
  hashing: 'text-blue-400',
  done: 'text-green-500',
  failed: 'text-red-500',
}

export default function ImageProgressRow({ task }: ImageProgressRowProps) {
  const statusText = task.status === 'failed'
    ? `Failed (${task.error ?? 'Unknown'})`
    : task.status === 'fetching'
      ? task.retryCount > 0
        ? `Retrying (${task.retryCount})...`
        : 'Downloading...'
      : task.status.charAt(0).toUpperCase() + task.status.slice(1)

  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      <td className="truncate py-1.5 pr-2 text-sm">
        #{task.realIndex}{task.imageName ? `: ${task.imageName}` : ''}
      </td>
      <td className="w-40 py-1.5">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-200"
            style={{ width: `${task.progress * 100}%` }}
          />
        </div>
      </td>
      <td className="w-20 py-1.5 text-right text-xs text-gray-400">
        {task.speed > 0 ? `${task.speed.toFixed(1)} KB/s` : ''}
      </td>
      <td className={`w-36 py-1.5 text-right text-xs ${STATUS_CLASS[task.status]}`}>
        {statusText}
      </td>
    </tr>
  )
}
```

- [ ] **Step 2: Create ImageProgressTable**

`src/dashboard/components/ImageProgressTable.tsx`:
```tsx
import type { ImageTask } from '@shared/types'
import ImageProgressRow from './ImageProgressRow'

interface ImageProgressTableProps {
  tasks: ImageTask[]
}

export default function ImageProgressTable({ tasks }: ImageProgressTableProps) {
  if (tasks.length === 0) return null

  return (
    <table className="mt-4 w-full table-fixed">
      <thead>
        <tr className="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-700">
          <th className="py-1 text-left font-medium">File</th>
          <th className="w-40 py-1 text-left font-medium">Progress</th>
          <th className="w-20 py-1 text-right font-medium">Speed</th>
          <th className="w-36 py-1 text-right font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map(task => (
          <ImageProgressRow key={`${task.galleryId}-${task.index}`} task={task} />
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 3: Create Banner component**

`src/dashboard/components/Banner.tsx`:
```tsx
interface BannerProps {
  type: 'error' | 'warning' | 'info'
  message: string
  action?: { label: string; onClick: () => void }
  onDismiss?: () => void
}

const BANNER_STYLES = {
  error: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300',
  warning: 'border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  info: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
}

export default function Banner({ type, message, action, onDismiss }: BannerProps) {
  return (
    <div className={`flex items-center justify-between rounded-md border p-3 text-sm ${BANNER_STYLES[type]}`}>
      <span>{message}</span>
      <div className="flex gap-2">
        {action && (
          <button onClick={action.onClick} className="font-medium underline">
            {action.label}
          </button>
        )}
        {onDismiss && (
          <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100">×</button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create GalleryDetail component**

`src/dashboard/components/GalleryDetail.tsx`:
```tsx
import type { QueueItem, ImageTask } from '@shared/types'
import ImageProgressTable from './ImageProgressTable'

interface GalleryDetailProps {
  item: QueueItem
  imageTasks: ImageTask[]
  onPause: () => void
  onResume: () => void
  onRetryFailed: () => void
  onCancel: () => void
}

export default function GalleryDetail({
  item, imageTasks, onPause, onResume, onRetryFailed, onCancel,
}: GalleryDetailProps) {
  const doneCount = imageTasks.filter(t => t.status === 'done').length
  const failedCount = imageTasks.filter(t => t.status === 'failed').length
  const totalCount = imageTasks.length
  const overallProgress = totalCount > 0 ? doneCount / totalCount : 0

  return (
    <div>
      <div className="flex gap-4">
        {item.thumbnailUrl && (
          <img src={item.thumbnailUrl} alt="" className="h-32 w-24 rounded object-cover" />
        )}
        <div className="flex-1">
          <h2 className="text-lg font-bold">{item.title}</h2>
          {item.subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{item.subtitle}</p>
          )}
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {item.category} | {item.uploader} | {item.pageCount} pages | {item.fileSize}
          </p>

          <div className="mt-3">
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${overallProgress * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">
                {doneCount}/{totalCount}
                {failedCount > 0 && ` (${failedCount} failed)`}
              </span>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            {item.status === 'downloading' && (
              <button
                onClick={onPause}
                className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                Pause
              </button>
            )}
            {item.status === 'paused' && (
              <button
                onClick={onResume}
                className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                Resume
              </button>
            )}
            {failedCount > 0 && (
              <button
                onClick={onRetryFailed}
                className="rounded border border-yellow-400 px-3 py-1 text-sm text-yellow-600 hover:bg-yellow-50 dark:border-yellow-600 dark:text-yellow-400 dark:hover:bg-yellow-900/20"
              >
                Retry Failed
              </button>
            )}
            {(item.status === 'downloading' || item.status === 'paused') && (
              <button
                onClick={onCancel}
                className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <ImageProgressTable tasks={imageTasks} />
    </div>
  )
}
```

- [ ] **Step 5: Update MainArea to use GalleryDetail**

`src/dashboard/components/MainArea.tsx`:
```tsx
import type { QueueItem, ImageTask } from '@shared/types'
import GalleryDetail from './GalleryDetail'
import Banner from './Banner'

interface MainAreaProps {
  selectedItem: QueueItem | null
  imageTasks: ImageTask[]
  banner: { type: 'error' | 'warning' | 'info'; message: string } | null
  onPause: () => void
  onResume: () => void
  onRetryFailed: () => void
  onCancel: () => void
  onDismissBanner: () => void
}

export default function MainArea({
  selectedItem, imageTasks, banner,
  onPause, onResume, onRetryFailed, onCancel, onDismissBanner,
}: MainAreaProps) {
  if (!selectedItem) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-400">
        Select a gallery from the sidebar
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {banner && (
        <div className="mb-4">
          <Banner type={banner.type} message={banner.message} onDismiss={onDismissBanner} />
        </div>
      )}
      <GalleryDetail
        item={selectedItem}
        imageTasks={imageTasks}
        onPause={onPause}
        onResume={onResume}
        onRetryFailed={onRetryFailed}
        onCancel={onCancel}
      />
    </div>
  )
}
```

- [ ] **Step 6: Update App.tsx to pass banner prop**

In `App.tsx`, update the `MainArea` usage to include `banner={null}` and `onDismissBanner={() => {}}`.

- [ ] **Step 7: Build and verify**

```bash
npm run build
```

Verify gallery detail view renders correctly with mock data.

- [ ] **Step 8: Commit**

```bash
git add src/dashboard/components/
git commit -m "feat: add GalleryDetail, ImageProgressTable, and Banner components"
```

---

### Task 12: Settings Modal

**Files:**
- Create: `src/dashboard/components/SettingsModal.tsx`
- Modify: `src/dashboard/App.tsx`

- [ ] **Step 1: Create SettingsModal**

`src/dashboard/components/SettingsModal.tsx`:
```tsx
import { useState, useEffect } from 'react'
import type { Settings } from '@shared/types'
import { DEFAULT_SETTINGS, TEMPLATE_VARS } from '@shared/constants'
import { storage } from '@shared/storage'

interface SettingsModalProps {
  onClose: () => void
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)

  useEffect(() => {
    storage.getSettings().then(setSettings)
  }, [])

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    await storage.setSettings(settings)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[80vh] w-[520px] overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-bold">Settings</h2>

        <section className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-500 uppercase dark:text-gray-400">Download</h3>
          <div className="space-y-3">
            <NumberField label="Concurrent threads" value={settings.threadCount} onChange={v => update('threadCount', v)} min={1} max={10} />
            <NumberField label="Concurrent galleries" value={settings.maxConcurrentGalleries} onChange={v => update('maxConcurrentGalleries', v)} min={1} max={3} />
            <NumberField label="Retry count" value={settings.retryCount} onChange={v => update('retryCount', v)} min={1} max={10} />
            <NumberField label="Request timeout (sec)" value={settings.timeout} onChange={v => update('timeout', v)} min={0} max={600} />
            <NumberField label="Periodic retry interval (sec)" value={settings.periodicRetrySec} onChange={v => update('periodicRetrySec', v)} min={10} max={600} />
            <ToggleField label="Checksum verification" value={settings.checksum} onChange={v => update('checksum', v)} />
          </div>
        </section>

        <section className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-500 uppercase dark:text-gray-400">File</h3>
          <div className="space-y-3">
            <TextField label="ZIP directory name" value={settings.dirNameTemplate} onChange={v => update('dirNameTemplate', v)} placeholder="/" />
            <TextField label="ZIP file name" value={settings.fileNameTemplate} onChange={v => update('fileNameTemplate', v)} placeholder="{title}" />
            <p className="text-xs text-gray-400">
              Variables: {TEMPLATE_VARS.join(', ')}
              <br />Use <code>/</code> as directory name for no folder.
            </p>
            <ToggleField label="Auto-number images" value={settings.numberImages} onChange={v => update('numberImages', v)} />
            {settings.numberImages && (
              <TextField label="Number separator" value={settings.numberSeparator} onChange={v => update('numberSeparator', v)} placeholder="：" />
            )}
          </div>
        </section>

        <section className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-500 uppercase dark:text-gray-400">Warnings</h3>
          <div className="space-y-3">
            <ToggleField label="Peak Hours warning" value={settings.peakHoursWarning} onChange={v => update('peakHoursWarning', v)} />
            <ToggleField label="Image Limits warning" value={settings.imageLimitsWarning} onChange={v => update('imageLimitsWarning', v)} />
            <ToggleField label="Speed detection" value={settings.speedDetect} onChange={v => update('speedDetect', v)} />
            {settings.speedDetect && (
              <>
                <NumberField label="Min speed threshold (KB/s)" value={settings.speedMinKBs} onChange={v => update('speedMinKBs', v)} min={1} max={100} />
                <NumberField label="Low speed timeout (sec)" value={settings.speedExpiredSec} onChange={v => update('speedExpiredSec', v)} min={5} max={120} />
              </>
            )}
          </div>
        </section>

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
          <button
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function NumberField({ label, value, onChange, min, max }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number
}) {
  return (
    <label className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        min={min}
        max={max}
        className="w-20 rounded border border-gray-300 px-2 py-1 text-right dark:border-gray-600 dark:bg-gray-700"
      />
    </label>
  )
}

function TextField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string
}) {
  return (
    <label className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-44 rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-700"
      />
    </label>
  )
}

function ToggleField({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between text-sm">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          value ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
          value ? 'translate-x-4.5' : 'translate-x-0.5'
        }`} />
      </button>
    </label>
  )
}
```

- [ ] **Step 2: Wire SettingsModal in App.tsx**

Add to `App.tsx` inside the return, after the layout div:

```tsx
{showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
```

- [ ] **Step 3: Build and verify settings modal**

```bash
npm run build
```

Click Settings → modal opens → fields editable → Save writes to chrome.storage → Cancel closes without saving.

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/components/SettingsModal.tsx src/dashboard/App.tsx
git commit -m "feat: add settings modal with download, file, and warning sections"
```

---

## Phase 5: Download Engine

### Task 13: OPFS Storage Manager

**Files:**
- Create: `src/dashboard/services/storage-manager.ts`

- [ ] **Step 1: Implement OPFS storage manager**

`src/dashboard/services/storage-manager.ts`:
```typescript
async function getRoot(): Promise<FileSystemDirectoryHandle> {
  return navigator.storage.getDirectory()
}

async function getGalleryDir(galleryId: string, create = true): Promise<FileSystemDirectoryHandle> {
  const root = await getRoot()
  return root.getDirectoryHandle(galleryId, { create })
}

export const storageManager = {
  async writeImage(galleryId: string, fileName: string, data: ArrayBuffer): Promise<void> {
    const dir = await getGalleryDir(galleryId)
    const fileHandle = await dir.getFileHandle(fileName, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(data)
    await writable.close()
  },

  async readImage(galleryId: string, fileName: string): Promise<ArrayBuffer> {
    const dir = await getGalleryDir(galleryId)
    const fileHandle = await dir.getFileHandle(fileName)
    const file = await fileHandle.getFile()
    return file.arrayBuffer()
  },

  async listImages(galleryId: string): Promise<string[]> {
    try {
      const dir = await getGalleryDir(galleryId, false)
      const names: string[] = []
      for await (const [name] of dir.entries()) {
        names.push(name)
      }
      return names.sort()
    } catch {
      return []
    }
  },

  async hasImage(galleryId: string, fileName: string): Promise<boolean> {
    try {
      const dir = await getGalleryDir(galleryId, false)
      await dir.getFileHandle(fileName)
      return true
    } catch {
      return false
    }
  },

  async deleteGallery(galleryId: string): Promise<void> {
    const root = await getRoot()
    try {
      await root.removeEntry(galleryId, { recursive: true })
    } catch {
      // directory doesn't exist, ignore
    }
  },

  async deleteImage(galleryId: string, fileName: string): Promise<void> {
    try {
      const dir = await getGalleryDir(galleryId, false)
      await dir.removeEntry(fileName)
    } catch {
      // file doesn't exist, ignore
    }
  },
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/services/storage-manager.ts
git commit -m "feat: add OPFS storage manager for image persistence"
```

---

### Task 14: Page Fetcher

**Files:**
- Create: `src/dashboard/services/page-fetcher.ts`

- [ ] **Step 1: Implement page fetcher**

`src/dashboard/services/page-fetcher.ts`:
```typescript
import { REGEX } from '@shared/constants'
import { parsePagesRange } from '@shared/pages-range'

interface PageFetcherResult {
  pageUrls: string[]
  totalCount: number
}

interface PageFetcherCallbacks {
  onProgress: (current: number, total: number | null) => void
  onError: (message: string) => void
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
  let pageUrlsList: string[] = []

  const mpvAvailable = await checkMpvAvailable(origin, gid, token, signal)
  if (mpvAvailable) {
    callbacks.onProgress(0, null)
    pageUrlsList = await fetchFromMpv(origin, gid, token, retryLimit, signal, callbacks)
  } else {
    pageUrlsList = await fetchFromPagination(origin, pathname, retryLimit, signal, callbacks)
  }

  let pagesRange = parsePagesRange(pagesRangeText, pageUrlsList.length)
  if (pagesRange === null) {
    callbacks.onError('Invalid pages range format')
    return { pageUrls: [], totalCount: 0 }
  }

  if (pagesRange.length > 0) {
    const validRange = pagesRange.filter(p => p <= pageUrlsList.length)
    const filteredUrls = validRange.map(p => pageUrlsList[p - 1])
    return { pageUrls: filteredUrls, totalCount: filteredUrls.length }
  }

  return { pageUrls: pageUrlsList, totalCount: pageUrlsList.length }
}

async function checkMpvAvailable(
  origin: string, gid: string, token: string, signal: AbortSignal,
): Promise<boolean> {
  try {
    const res = await fetch(`${origin}/mpv/${gid}/${token}/`, { signal, credentials: 'include' })
    return res.ok
  } catch {
    return false
  }
}

async function fetchFromMpv(
  origin: string, gid: string, token: string,
  retryLimit: number, signal: AbortSignal,
  callbacks: PageFetcherCallbacks,
): Promise<string[]> {
  const mpvUrl = `${origin}/mpv/${gid}/${token}/`
  let attempt = 0

  while (attempt <= retryLimit) {
    try {
      const res = await fetch(mpvUrl, { signal, credentials: 'include' })
      const text = await res.text()
      if (!res.ok || !text) throw new Error('Empty response')

      const match = text.match(REGEX.mpvKey)
      if (!match) throw new Error('Cannot parse MPV response')

      const list: Array<{ k: string }> = JSON.parse(match[1])
      return list.map((elem, index) => `${origin}/s/${elem.k}/${gid}-${index + 1}`)
    } catch (err) {
      attempt++
      if (attempt > retryLimit) {
        callbacks.onError('Failed to fetch pages from MPV')
        return []
      }
    }
  }
  return []
}

async function fetchFromPagination(
  origin: string, pathname: string,
  retryLimit: number, signal: AbortSignal,
  callbacks: PageFetcherCallbacks,
): Promise<string[]> {
  const pageUrls: string[] = []
  let currentPage = 0
  let totalPaginationPages: number | null = null

  while (true) {
    let attempt = 0
    let pageText: string | null = null

    while (attempt <= retryLimit) {
      try {
        const res = await fetch(`${origin}${pathname}?p=${currentPage}`, {
          signal, credentials: 'include',
        })
        if (!res.ok) throw new Error(`Status ${res.status}`)
        pageText = await res.text()
        if (!pageText) throw new Error('Empty response')
        break
      } catch (err) {
        attempt++
        if (attempt > retryLimit) {
          callbacks.onError(`Failed to fetch page list (page ${currentPage + 1})`)
          return pageUrls
        }
      }
    }

    if (!pageText) break

    const gdtSection = pageText.split('<div id="gdt"')[1]?.split('<div class="gtb"')[0]
    if (!gdtSection) {
      callbacks.onError('Cannot parse gallery page structure')
      return pageUrls
    }

    const urls = gdtSection.match(REGEX.pagesURL)
    if (!urls) {
      callbacks.onError('Cannot extract page URLs')
      return pageUrls
    }

    for (const rawUrl of urls) {
      const cleanUrl = rawUrl.split('"')[1]
      if (cleanUrl) pageUrls.push(decodeHTMLEntities(cleanUrl))
    }

    if (totalPaginationPages === null) {
      const lengthMatch = pageText.match(REGEX.pagesLength)
      if (lengthMatch) totalPaginationPages = Number(lengthMatch[1])
    }

    callbacks.onProgress(currentPage + 1, totalPaginationPages)
    currentPage++

    if (totalPaginationPages !== null && currentPage >= totalPaginationPages) break
  }

  return pageUrls
}

function decodeHTMLEntities(str: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = str
  return textarea.value
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/services/page-fetcher.ts
git commit -m "feat: add page fetcher with MPV and pagination support"
```

---

### Task 15: Image Fetcher

**Files:**
- Create: `src/dashboard/services/image-fetcher.ts`

- [ ] **Step 1: Implement image fetcher**

`src/dashboard/services/image-fetcher.ts`:
```typescript
import { REGEX, WATCHDOG_TIMEOUT_MS } from '@shared/constants'
import { getSha1Checksum } from '@shared/checksum'
import { getSafeName } from '@shared/filename'
import { classifyImageResponse } from './error-classifier'
import { storageManager } from './storage-manager'
import type { ClassifiedError, Settings } from '@shared/types'

interface FetchImageResult {
  imageName: string
  error: ClassifiedError | null
}

interface FetchImageCallbacks {
  onProgress: (loaded: number, total: number, speed: number) => void
  onStatus: (status: string) => void
}

export async function fetchImageFromPage(
  pageUrl: string,
  galleryId: string,
  index: number,
  settings: Settings,
  signal: AbortSignal,
  callbacks: FetchImageCallbacks,
): Promise<FetchImageResult> {
  callbacks.onStatus('Fetching page...')
  const pageRes = await fetch(pageUrl, { signal, credentials: 'include' })
  const pageText = await pageRes.text()

  if (!pageRes.ok || !pageText) {
    return { imageName: '', error: { type: 'empty_response', message: 'Empty page response', shouldRetry: true, shouldPauseAll: false, forceRetry: false } }
  }

  const imageUrl = extractImageUrl(pageText)
  if (!imageUrl) {
    return { imageName: '', error: { type: 'unknown', message: 'Cannot parse image URL', shouldRetry: true, shouldPauseAll: false, forceRetry: false } }
  }

  const fileNameFromPage = extractFileName(pageText)
  const imageName = getSafeName(fileNameFromPage)

  callbacks.onStatus('Downloading...')

  const imageResult = await downloadImage(imageUrl, pageUrl, galleryId, imageName, settings, signal, callbacks)
  return imageResult
}

function extractImageUrl(pageText: string): string | null {
  for (const pattern of REGEX.imageURL) {
    const match = pageText.match(pattern)
    if (match) return decodeHTMLEntities(match[1])
  }
  return null
}

function extractFileName(pageText: string): string {
  const match = pageText.match(REGEX.fileName)
  return match ? decodeHTMLEntities(match[1]) : `image_${Date.now()}.jpg`
}

async function downloadImage(
  imageUrl: string,
  pageUrl: string,
  galleryId: string,
  imageName: string,
  settings: Settings,
  signal: AbortSignal,
  callbacks: FetchImageCallbacks,
): Promise<FetchImageResult> {
  const controller = new AbortController()
  const combinedSignal = AbortSignal.any([signal, controller.signal])

  let watchdogTimer: ReturnType<typeof setTimeout> | null = null
  const resetWatchdog = () => {
    if (watchdogTimer) clearTimeout(watchdogTimer)
    watchdogTimer = setTimeout(() => controller.abort('Watchdog timeout'), WATCHDOG_TIMEOUT_MS)
  }

  let speedTimer: ReturnType<typeof setTimeout> | null = null
  let lastLoaded = 0
  let lastTimestamp = Date.now()

  const cleanup = () => {
    if (watchdogTimer) clearTimeout(watchdogTimer)
    if (speedTimer) clearTimeout(speedTimer)
  }

  try {
    resetWatchdog()

    const res = await fetch(imageUrl, {
      signal: combinedSignal,
      credentials: 'include',
      headers: { Referer: pageUrl },
    })

    const contentType = res.headers.get('Content-Type') ?? ''
    const contentLength = Number(res.headers.get('Content-Length') ?? 0)

    if (!res.body) {
      cleanup()
      return { imageName, error: { type: 'empty_response', message: 'Empty Response', shouldRetry: true, shouldPauseAll: false, forceRetry: false } }
    }

    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let loaded = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      resetWatchdog()
      chunks.push(value)
      loaded += value.length

      const now = Date.now()
      const elapsed = now - lastTimestamp
      if (elapsed >= 1000 || lastLoaded === 0) {
        const speed = elapsed > 0 ? (loaded - lastLoaded) / elapsed : 0
        callbacks.onProgress(loaded, contentLength, speed)
        lastLoaded = loaded
        lastTimestamp = now
      }
    }

    cleanup()

    const body = mergeChunks(chunks, loaded)
    const classified = classifyImageResponse(res.status, body, contentType, body.byteLength)
    if (classified) {
      return { imageName, error: classified }
    }

    const actualName = extractFileNameFromResponse(res, imageUrl) ?? imageName

    if (settings.checksum) {
      callbacks.onStatus('Hashing...')
      const checksumError = await verifyChecksum(imageUrl, pageUrl, body)
      if (checksumError) {
        return { imageName: actualName, error: checksumError }
      }
    }

    await storageManager.writeImage(galleryId, `${String(index).padStart(5, '0')}_${actualName}`, body)

    return { imageName: actualName, error: null }
  } catch (err) {
    cleanup()
    if (signal.aborted) throw err

    const message = err instanceof Error ? err.message : 'Unknown error'
    const isTimeout = message.includes('Watchdog') || message.includes('timeout')

    return {
      imageName,
      error: {
        type: isTimeout ? 'timeout' : 'network_error',
        message: isTimeout ? 'Timed Out' : 'Network Error',
        shouldRetry: true,
        shouldPauseAll: false,
        forceRetry: false,
      },
    }
  }
}

function mergeChunks(chunks: Uint8Array[], totalLength: number): ArrayBuffer {
  const merged = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged.buffer as ArrayBuffer
}

function extractFileNameFromResponse(res: Response, requestUrl: string): string | null {
  const disposition = res.headers.get('Content-Disposition')
  if (disposition) {
    const match = disposition.match(/filename=['"]?([^'";\n]+)/)
    if (match) return getSafeName(match[1].trim())
  }

  const urlName = requestUrl.split('/').pop()?.split('?')[0]
  if (urlName && urlName.includes('.') && !urlName.includes('.php')) {
    return getSafeName(urlName)
  }

  return null
}

async function verifyChecksum(
  imageUrl: string, pageUrl: string, body: ArrayBuffer,
): Promise<ClassifiedError | null> {
  const parsedUrl = imageUrl.match(REGEX.imageUrlParse.signature)
  const expectedHash = parsedUrl?.[1]
    ?? pageUrl.match(REGEX.pageUrlParse)?.[1]

  if (!expectedHash) return null

  const actualHash = await getSha1Checksum(body)
  if (!actualHash) return null

  if (!actualHash.startsWith(expectedHash)) {
    return {
      type: 'checksum_mismatch',
      message: 'Checksum Mismatch',
      shouldRetry: true,
      shouldPauseAll: false,
      forceRetry: false,
    }
  }

  return null
}

function decodeHTMLEntities(str: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = str
  return textarea.value
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/services/image-fetcher.ts
git commit -m "feat: add image fetcher with watchdog, speed detection, and checksum"
```

---

### Task 16: ZIP Packer

**Files:**
- Create: `src/dashboard/services/zip-packer.ts`

- [ ] **Step 1: Implement ZIP packer**

`src/dashboard/services/zip-packer.ts`:
```typescript
import JSZip from 'jszip'
import { storageManager } from './storage-manager'
import { REGEX } from '@shared/constants'

interface PackOptions {
  galleryId: string
  dirName: string
  fileName: string
  onProgress: (percent: number) => void
}

export async function packAndDownload(options: PackOptions): Promise<void> {
  const { galleryId, dirName, fileName, onProgress } = options

  const zip = new JSZip()
  const useFolder = dirName && !REGEX.slashOnly.test(dirName)
  const target = useFolder ? zip.folder(dirName)! : zip

  const imageFiles = await storageManager.listImages(galleryId)
  const total = imageFiles.length

  for (let i = 0; i < imageFiles.length; i++) {
    const data = await storageManager.readImage(galleryId, imageFiles[i])
    const cleanName = imageFiles[i].replace(/^\d+_/, '')
    target.file(cleanName, data)
    onProgress((i + 1) / total * 0.5)
  }

  const blob = await zip.generateAsync(
    { type: 'blob', compression: 'STORE' },
    (meta) => onProgress(0.5 + meta.percent / 200),
  )

  const url = URL.createObjectURL(blob)

  await chrome.downloads.download({
    url,
    filename: `${fileName}.zip`,
    saveAs: true,
  })

  setTimeout(() => URL.revokeObjectURL(url), 30_000)

  await storageManager.deleteGallery(galleryId)
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/services/zip-packer.ts
git commit -m "feat: add ZIP packer reading from OPFS with chrome.downloads"
```

---

### Task 17: Gallery Downloader & Queue Manager

**Files:**
- Create: `src/dashboard/services/gallery-downloader.ts`, `src/dashboard/services/queue-manager.ts`

- [ ] **Step 1: Implement gallery downloader**

`src/dashboard/services/gallery-downloader.ts`:
```typescript
import type { ImageTask, Settings, ClassifiedError } from '@shared/types'
import { fetchAllPageUrls } from './page-fetcher'
import { fetchImageFromPage } from './image-fetcher'
import { packAndDownload } from './zip-packer'
import { storageManager } from './storage-manager'
import { applyTemplate } from '@shared/filename'
import { numberImageName, renameImageDuplicates } from '@shared/filename'

export interface GalleryDownloadState {
  galleryId: string
  imageTasks: ImageTask[]
  isPaused: boolean
  error: ClassifiedError | null
}

interface GalleryInfo {
  gid: string
  token: string
  title: string
  subtitle: string
  category: string
  uploader: string
  pagesRange: string
  pageCount: number
  origin: string
  pathname: string
}

type StateCallback = (state: GalleryDownloadState) => void

export class GalleryDownloader {
  private abortController = new AbortController()
  private state: GalleryDownloadState
  private settings: Settings
  private info: GalleryInfo
  private onStateChange: StateCallback
  private activeThreads = 0
  private periodicRetryTimer: ReturnType<typeof setInterval> | null = null

  constructor(info: GalleryInfo, settings: Settings, onStateChange: StateCallback) {
    this.info = info
    this.settings = settings
    this.onStateChange = onStateChange
    this.state = {
      galleryId: `${info.gid}_${info.token}`,
      imageTasks: [],
      isPaused: false,
      error: null,
    }
  }

  async start(threadCount: number): Promise<void> {
    const { origin, pathname, gid, token, pagesRange, pageCount } = this.info

    const result = await fetchAllPageUrls(
      origin, pathname, gid, token, pagesRange, pageCount,
      this.settings.retryCount, this.abortController.signal,
      {
        onProgress: () => {},
        onError: (msg) => { this.state.error = { type: 'unknown', message: msg, shouldRetry: false, shouldPauseAll: false, forceRetry: false } },
      },
    )

    if (result.pageUrls.length === 0) return

    this.state.imageTasks = result.pageUrls.map((url, i) => ({
      galleryId: this.state.galleryId,
      index: i,
      realIndex: i + 1,
      pageUrl: url,
      imageUrl: null,
      imageName: null,
      status: 'pending' as const,
      progress: 0,
      speed: 0,
      retryCount: 0,
      error: null,
    }))
    this.emit()

    await this.downloadAll(threadCount)
  }

  private async downloadAll(threadCount: number): Promise<void> {
    const tasks = this.state.imageTasks
    let nextIndex = 0

    const runThread = async (): Promise<void> => {
      while (nextIndex < tasks.length) {
        if (this.state.isPaused || this.abortController.signal.aborted) return

        const idx = nextIndex++
        const task = tasks[idx]
        if (task.status === 'done') continue

        const alreadyOnDisk = await storageManager.hasImage(
          this.state.galleryId,
          `${String(idx).padStart(5, '0')}_${task.imageName ?? ''}`,
        )
        if (alreadyOnDisk && task.imageName) {
          task.status = 'done'
          task.progress = 1
          this.emit()
          continue
        }

        await this.downloadSingleImage(idx)
      }
    }

    const threads = Array.from({ length: Math.min(threadCount, tasks.length) }, () => runThread())
    await Promise.all(threads)

    if (this.abortController.signal.aborted) return

    const failedTasks = tasks.filter(t => t.status === 'failed')
    if (failedTasks.length > 0) {
      this.startPeriodicRetry(threadCount)
      return
    }

    await this.finalize()
  }

  private async downloadSingleImage(index: number): Promise<void> {
    const task = this.state.imageTasks[index]
    task.status = 'fetching'
    task.error = null
    this.emit()

    const result = await fetchImageFromPage(
      task.pageUrl,
      this.state.galleryId,
      index,
      this.settings,
      this.abortController.signal,
      {
        onProgress: (loaded, total, speed) => {
          task.progress = total > 0 ? loaded / total : 0
          task.speed = speed
          this.emit()
        },
        onStatus: (status) => {
          if (status === 'Hashing...') task.status = 'hashing'
          this.emit()
        },
      },
    )

    if (result.error) {
      if (result.error.shouldPauseAll) {
        task.status = 'failed'
        task.error = result.error.message
        this.state.error = result.error
        this.state.isPaused = true
        this.emit()
        return
      }

      if (task.retryCount < this.settings.retryCount || result.error.forceRetry) {
        task.retryCount++
        task.status = 'pending'
        task.progress = 0
        task.speed = 0
        this.emit()
        return this.downloadSingleImage(index)
      }

      task.status = 'failed'
      task.error = result.error.message
      this.emit()
      return
    }

    task.imageName = result.imageName
    task.status = 'done'
    task.progress = 1
    task.speed = 0
    this.emit()
  }

  private async finalize(): Promise<void> {
    const { settings, info, state } = this
    const templateVars = {
      gid: info.gid,
      token: info.token,
      title: info.title,
      subtitle: info.subtitle,
      category: info.category,
      uploader: info.uploader,
    }

    const dirName = applyTemplate(settings.dirNameTemplate, templateVars)
    const fileName = applyTemplate(settings.fileNameTemplate, templateVars)

    await packAndDownload({
      galleryId: state.galleryId,
      dirName,
      fileName,
      onProgress: () => {},
    })
  }

  retryAllFailed(threadCount: number): void {
    this.stopPeriodicRetry()
    for (const task of this.state.imageTasks) {
      if (task.status === 'failed') {
        task.status = 'pending'
        task.retryCount = 0
        task.progress = 0
        task.speed = 0
        task.error = null
      }
    }
    this.state.isPaused = false
    this.state.error = null
    this.emit()
    this.downloadAll(threadCount)
  }

  pause(): void {
    this.state.isPaused = true
    this.stopPeriodicRetry()
    this.emit()
  }

  resume(threadCount: number): void {
    this.state.isPaused = false
    this.emit()
    this.downloadAll(threadCount)
  }

  cancel(): void {
    this.abortController.abort()
    this.stopPeriodicRetry()
    storageManager.deleteGallery(this.state.galleryId)
  }

  private startPeriodicRetry(threadCount: number): void {
    if (this.periodicRetryTimer) return
    this.periodicRetryTimer = setInterval(() => {
      if (this.state.isPaused) return
      this.retryAllFailed(threadCount)
    }, this.settings.periodicRetrySec * 1000)
  }

  private stopPeriodicRetry(): void {
    if (this.periodicRetryTimer) {
      clearInterval(this.periodicRetryTimer)
      this.periodicRetryTimer = null
    }
  }

  private emit(): void {
    this.onStateChange({ ...this.state })
  }
}
```

- [ ] **Step 2: Implement queue manager**

`src/dashboard/services/queue-manager.ts`:
```typescript
import type { QueueItem, Settings } from '@shared/types'
import { storage } from '@shared/storage'
import { GalleryDownloader, type GalleryDownloadState } from './gallery-downloader'

type QueueCallback = (states: Map<string, GalleryDownloadState>) => void

export class QueueManager {
  private downloaders = new Map<string, GalleryDownloader>()
  private states = new Map<string, GalleryDownloadState>()
  private settings: Settings
  private onStateChange: QueueCallback

  constructor(settings: Settings, onStateChange: QueueCallback) {
    this.settings = settings
    this.onStateChange = onStateChange
  }

  updateSettings(settings: Settings): void {
    this.settings = settings
  }

  async processQueue(): Promise<void> {
    const queue = await storage.getQueue()
    const activeCount = [...this.downloaders.keys()].length
    const maxConcurrent = this.settings.maxConcurrentGalleries

    const pendingItems = queue.filter(item =>
      item.status === 'queued' && !this.downloaders.has(item.id)
    )

    const slotsAvailable = maxConcurrent - activeCount
    const toStart = pendingItems.slice(0, slotsAvailable)

    for (const item of toStart) {
      await this.startDownload(item)
    }
  }

  private async startDownload(item: QueueItem): Promise<void> {
    const origin = item.thumbnailUrl.includes('exhentai') ? 'https://exhentai.org' : 'https://e-hentai.org'
    const pathname = `/g/${item.gid}/${item.token}/`

    const threadsPerGallery = Math.max(1, Math.floor(
      this.settings.threadCount / this.settings.maxConcurrentGalleries
    ))

    const downloader = new GalleryDownloader(
      {
        gid: item.gid,
        token: item.token,
        title: item.title,
        subtitle: item.subtitle,
        category: item.category,
        uploader: item.uploader,
        pagesRange: item.pagesRange,
        pageCount: item.pageCount,
        origin,
        pathname,
      },
      this.settings,
      (state) => {
        this.states.set(item.id, state)
        this.onStateChange(new Map(this.states))
      },
    )

    this.downloaders.set(item.id, downloader)
    await this.updateQueueItemStatus(item.id, 'downloading')

    try {
      await downloader.start(threadsPerGallery)
      await this.onDownloadComplete(item.id)
    } catch {
      await this.updateQueueItemStatus(item.id, 'failed')
    }
  }

  private async onDownloadComplete(id: string): Promise<void> {
    this.downloaders.delete(id)

    const queue = await storage.getQueue()
    const item = queue.find(q => q.id === id)
    if (item) {
      const updated = queue.filter(q => q.id !== id)
      await storage.setQueue(updated)

      item.status = 'completed'
      const history = await storage.getHistory()
      history.unshift(item)
      await storage.setHistory(history)
    }

    this.processQueue()
  }

  pauseGallery(id: string): void {
    this.downloaders.get(id)?.pause()
    this.updateQueueItemStatus(id, 'paused')
  }

  resumeGallery(id: string): void {
    const threadsPerGallery = Math.max(1, Math.floor(
      this.settings.threadCount / this.settings.maxConcurrentGalleries
    ))
    this.downloaders.get(id)?.resume(threadsPerGallery)
    this.updateQueueItemStatus(id, 'downloading')
  }

  retryFailed(id: string): void {
    const threadsPerGallery = Math.max(1, Math.floor(
      this.settings.threadCount / this.settings.maxConcurrentGalleries
    ))
    this.downloaders.get(id)?.retryAllFailed(threadsPerGallery)
    this.updateQueueItemStatus(id, 'downloading')
  }

  cancelGallery(id: string): void {
    this.downloaders.get(id)?.cancel()
    this.downloaders.delete(id)
    this.states.delete(id)
    this.updateQueueItemStatus(id, 'failed')
    this.onStateChange(new Map(this.states))
    this.processQueue()
  }

  getState(id: string): GalleryDownloadState | undefined {
    return this.states.get(id)
  }

  private async updateQueueItemStatus(id: string, status: QueueItem['status']): Promise<void> {
    const queue = await storage.getQueue()
    const item = queue.find(q => q.id === id)
    if (item) {
      item.status = status
      await storage.setQueue(queue)
    }
  }
}
```

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/services/gallery-downloader.ts src/dashboard/services/queue-manager.ts
git commit -m "feat: add gallery downloader and queue manager with thread pool"
```

---

## Phase 6: Integration

### Task 18: Dashboard Hooks & Engine Wiring

**Files:**
- Create: `src/dashboard/hooks/useDownloadEngine.ts`, `src/dashboard/hooks/useStorage.ts`, `src/dashboard/hooks/useImageLimits.ts`
- Modify: `src/dashboard/App.tsx`

- [ ] **Step 1: Create useStorage hook**

`src/dashboard/hooks/useStorage.ts`:
```tsx
import { useState, useEffect } from 'react'
import { storage } from '@shared/storage'
import type { QueueItem, Settings } from '@shared/types'

export function useQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([])

  useEffect(() => {
    storage.getQueue().then(setQueue)
    return storage.onChanged((changes) => {
      if (changes.queue?.newValue) setQueue(changes.queue.newValue)
    })
  }, [])

  return queue
}

export function useHistory() {
  const [history, setHistory] = useState<QueueItem[]>([])

  useEffect(() => {
    storage.getHistory().then(setHistory)
    return storage.onChanged((changes) => {
      if (changes.history?.newValue) setHistory(changes.history.newValue)
    })
  }, [])

  return history
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    storage.getSettings().then(setSettings)
    return storage.onChanged((changes) => {
      if (changes.settings?.newValue) setSettings(changes.settings.newValue)
    })
  }, [])

  return settings
}
```

- [ ] **Step 2: Create useImageLimits hook**

`src/dashboard/hooks/useImageLimits.ts`:
```tsx
import { useState, useEffect } from 'react'
import type { ImageLimits } from '@shared/types'
import { REGEX } from '@shared/constants'
import { storage } from '@shared/storage'

export function useImageLimits() {
  const [limits, setLimits] = useState<ImageLimits>({
    current: 0, total: 0, isDonator: false,
    isSuspended: false, isIpBanned: false, timestamp: 0,
  })

  useEffect(() => {
    storage.getImageLimits().then(setLimits)
    fetchLimits()
    const interval = setInterval(fetchLimits, 60_000)
    return () => clearInterval(interval)
  }, [])

  async function fetchLimits() {
    try {
      const res = await fetch('https://e-hentai.org/home.php', { credentials: 'include' })
      const text = await res.text()

      const data: ImageLimits = { ...limits, timestamp: Date.now() }

      if (text.includes('as your account has been suspended')) {
        data.isSuspended = true
      } else if (text.includes('Your IP address has been temporarily banned')) {
        data.isIpBanned = true
      } else {
        const match = text.match(REGEX.imageLimits)
        if (match && match.length >= 3) {
          data.current = Number(match[1].replace(/,/g, ''))
          data.total = Number(match[2].replace(/,/g, ''))
          data.isSuspended = false
          data.isIpBanned = false

          const donatorMatch = text.match(REGEX.donatorPower)
          data.isDonator = donatorMatch ? Number(donatorMatch[1]) > 0 : false
        }
      }

      await storage.setImageLimits(data)
      setLimits(data)
    } catch {
      // silently fail — will retry next interval
    }
  }

  return limits
}
```

- [ ] **Step 3: Create useDownloadEngine hook**

`src/dashboard/hooks/useDownloadEngine.ts`:
```tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Settings, ImageTask } from '@shared/types'
import { QueueManager } from '@services/queue-manager'
import type { GalleryDownloadState } from '@services/gallery-downloader'

export function useDownloadEngine(settings: Settings | null) {
  const managerRef = useRef<QueueManager | null>(null)
  const [downloadStates, setDownloadStates] = useState<Map<string, GalleryDownloadState>>(new Map())

  useEffect(() => {
    if (!settings) return

    if (!managerRef.current) {
      managerRef.current = new QueueManager(settings, setDownloadStates)
      managerRef.current.processQueue()
    } else {
      managerRef.current.updateSettings(settings)
    }
  }, [settings])

  useEffect(() => {
    if (!managerRef.current) return
    const unsubscribe = (await import('@shared/storage')).storage.onChanged((changes) => {
      if (changes.queue) managerRef.current?.processQueue()
    })
    return unsubscribe
  }, [])

  const getImageTasks = useCallback((galleryId: string): ImageTask[] => {
    return downloadStates.get(galleryId)?.imageTasks ?? []
  }, [downloadStates])

  const getBanner = useCallback((galleryId: string) => {
    const state = downloadStates.get(galleryId)
    if (!state?.error) return null
    return {
      type: 'error' as const,
      message: state.error.message,
    }
  }, [downloadStates])

  return {
    getImageTasks,
    getBanner,
    pause: (id: string) => managerRef.current?.pauseGallery(id),
    resume: (id: string) => managerRef.current?.resumeGallery(id),
    retryFailed: (id: string) => managerRef.current?.retryFailed(id),
    cancel: (id: string) => managerRef.current?.cancelGallery(id),
  }
}
```

Note: The `useEffect` with `await import` above needs adjustment — use a sync pattern instead:

```tsx
useEffect(() => {
  if (!managerRef.current) return

  const unsubscribe = storage.onChanged((changes) => {
    if (changes.queue) managerRef.current?.processQueue()
  })
  return unsubscribe
}, [])
```

(Import `storage` at the top of the file.)

- [ ] **Step 4: Wire everything in App.tsx**

`src/dashboard/App.tsx`:
```tsx
import { useState } from 'react'
import { storage } from '@shared/storage'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import MainArea from './components/MainArea'
import SettingsModal from './components/SettingsModal'
import { useQueue, useHistory, useSettings } from './hooks/useStorage'
import { useImageLimits } from './hooks/useImageLimits'
import { useDownloadEngine } from './hooks/useDownloadEngine'

export default function App() {
  const queue = useQueue()
  const history = useHistory()
  const settings = useSettings()
  const limits = useImageLimits()
  const engine = useDownloadEngine(settings)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const selectedItem = [...queue, ...history].find(item => item.id === selectedId) ?? null
  const imageTasks = selectedId ? engine.getImageTasks(selectedId) : []
  const banner = selectedId ? engine.getBanner(selectedId) : null

  const handleRemove = async (id: string) => {
    engine.cancel(id)
    const updated = queue.filter(item => item.id !== id)
    await storage.setQueue(updated)
    if (selectedId === id) setSelectedId(null)
  }

  return (
    <div className="flex h-screen flex-col bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <Header
        imageLimitsCurrent={limits.current}
        imageLimitsTotal={limits.total}
        onOpenSettings={() => setShowSettings(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          queue={queue}
          history={history}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRemove={handleRemove}
        />
        <MainArea
          selectedItem={selectedItem}
          imageTasks={imageTasks}
          banner={banner}
          onPause={() => selectedId && engine.pause(selectedId)}
          onResume={() => selectedId && engine.resume(selectedId)}
          onRetryFailed={() => selectedId && engine.retryFailed(selectedId)}
          onCancel={() => selectedId && engine.cancel(selectedId)}
          onDismissBanner={() => {}}
        />
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
```

- [ ] **Step 5: Add tab close warning**

Add to `App.tsx`, inside the component:

```tsx
useEffect(() => {
  const handler = (e: BeforeUnloadEvent) => {
    const isDownloading = queue.some(item => item.status === 'downloading')
    if (isDownloading) {
      e.preventDefault()
      e.returnValue = 'Downloads are in progress. Are you sure you want to leave?'
    }
  }
  window.addEventListener('beforeunload', handler)
  return () => window.removeEventListener('beforeunload', handler)
}, [queue])
```

- [ ] **Step 6: Build and test full flow**

```bash
npm run build
```

1. Load extension
2. Open gallery page → click "Add to Queue"
3. Open Dashboard → verify gallery appears in sidebar
4. Click gallery → verify download starts, progress updates
5. Test Pause/Resume/Retry Failed/Cancel
6. Verify ZIP download triggers on completion

- [ ] **Step 7: Commit**

```bash
git add src/dashboard/
git commit -m "feat: wire download engine to dashboard with hooks and full UI integration"
```

---

### Task 19: Final Polish

**Files:**
- Various minor fixes across existing files

- [ ] **Step 1: Run full type check**

```bash
npx tsc --noEmit
```

Fix any remaining type errors.

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Fix any failing tests.

- [ ] **Step 3: Build production bundle**

```bash
npm run build
```

Verify no build errors.

- [ ] **Step 4: Manual end-to-end test**

1. Load extension in Chrome
2. Navigate to E-Hentai gallery → "Add to Queue" button visible
3. Click button → badge shows count
4. Open Dashboard → gallery in queue
5. Download starts → per-image progress visible
6. Pause → all threads stop
7. Resume → download continues
8. Complete → ZIP downloads → gallery moves to History
9. Settings → change thread count → save → verify applied
10. Dark mode → toggle system theme → verify UI follows

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: fix type errors and polish for initial release"
```
