# Modern E-Hentai Downloader Dashboard — Design Spec

## Overview

A Chrome Extension (Manifest V3) that replaces the existing E-Hentai Downloader userscript with a modern download dashboard. The download mechanism is ported from the original script; the UI and interaction model are redesigned from scratch.

### Core Flow

1. User browses an E-Hentai gallery page
2. Content Script injects an "Add to Queue" button + Pages Range input
3. User clicks the button — gallery info is sent to the Background service worker
4. Background writes to `chrome.storage.local` and updates the badge
5. Dashboard tab (always open) picks up the new queue item and starts downloading

## Architecture

```
Content Script (E-Hentai gallery page)
  → Injects "Add to Queue" button + Pages Range input
  → Parses gallery metadata from DOM
  → Sends message to Background

Background Service Worker
  → Receives messages from Content Script
  → Writes queue items to chrome.storage.local
  → Updates extension badge (queue count)
  → Lightweight coordination only — no downloading

Dashboard Page (chrome-extension://xxx/dashboard.html)
  → React 18 + TypeScript + Tailwind CSS
  → Performs all downloading (fetch with host_permissions bypasses CORS)
  → Stores images to OPFS (Origin Private File System)
  → Packs ZIP with JSZip, triggers download via chrome.downloads API
```

### Why Dashboard-Centric

The Dashboard tab handles all downloads directly. No offscreen documents, no service worker lifecycle issues. The tab must stay open during downloads — a warning is shown when the user tries to close it.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Build | Vite |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS |
| State | React state + chrome.storage.local |
| Image storage | OPFS (Origin Private File System) |
| ZIP | JSZip |
| Download trigger | chrome.downloads API |
| Theme | System preference (dark/light) via `prefers-color-scheme` |

## Project Structure

```
mordenEhDownloader/
├── manifest.json
├── src/
│   ├── background/
│   │   └── index.ts
│   ├── content/
│   │   ├── index.ts
│   │   └── inject.css
│   ├── dashboard/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── store/
│   │   └── services/
│   └── shared/
│       ├── types.ts
│       ├── constants.ts
│       └── storage.ts
├── public/
│   └── icons/
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Content Script

### Injection Target

E-Hentai and ExHentai gallery pages (`/g/*`).

### UI Elements

- **"Add to Queue" button** — inserted below gallery metadata area
- **Pages Range input** — text input with placeholder `eg. -10,!8,12,14-20,30-40/2,70-`
- After clicking, the button briefly shows "Added" then resets

### Data Extracted from DOM

| Field | Source |
|-------|--------|
| gid | URL path segment |
| token | URL path segment |
| title | `#gn` textContent |
| subtitle | `#gj` textContent |
| category | `#gdc .cs` textContent |
| uploader | `#gdn` textContent |
| pageCount | `#gdd` (Length row) |
| fileSize | `#gdd` (File Size row) |
| thumbnailUrl | Gallery cover image |
| pagesRange | User input |

### Message Format

```typescript
chrome.runtime.sendMessage({
  type: 'ADD_TO_QUEUE',
  payload: QueueItem
})
```

## Dashboard UI Layout

```
┌──────────────────────────────────────────────────────┐
│  Header                                              │
│  [Logo/Title]                    [Image Limits] [Settings]│
├──────────┬───────────────────────────────────────────┤
│          │                                           │
│ Sidebar  │  Main Area                                │
│          │                                           │
│ Queue    │  Selected gallery detail view              │
│  - G1    │  ┌─────────────────────────────────┐      │
│  - G2    │  │ Title / Thumbnail / Metadata    │      │
│  - G3    │  │ Overall progress bar            │      │
│          │  │ [Pause] [Resume] [Retry] [Cancel]│     │
│ History  │  ├─────────────────────────────────┤      │
│  - G4    │  │ #1  image.jpg   ████░░  72%     │      │
│  - G5    │  │ #2  image.jpg   ██████  Done    │      │
│          │  │ #3  image.jpg   ░░░░░░  Pending │      │
│          │  │ ...                             │      │
│          │  └─────────────────────────────────┘      │
└──────────┴───────────────────────────────────────────┘
```

### Header

- Extension title/logo
- Image Limits display (fetched periodically from `e-hentai.org/home.php`)
- Settings button (opens modal)

### Sidebar

Two sections toggled via tabs:

- **Queue** — galleries with status `queued` | `downloading` | `paused` | `failed`
  - Each item shows: thumbnail, title, overall progress bar
  - Drag to reorder (changes priority)
  - Hover/right-click to remove
- **History** — galleries with status `completed`
  - Each item shows: thumbnail, title, completed date

### Main Area

Shown when a sidebar item is selected:

- Gallery metadata (title, subtitle, category, uploader, page count, file size)
- Thumbnail
- Overall progress bar with percentage
- Action buttons: Pause, Resume, Retry Failed, Cancel
- Per-image progress table:
  - Image index, file name, progress bar, speed (KB/s), status text
  - Status colors: green (done), yellow (warning/retrying), red (failed)

## Download Engine

```
DownloadEngine
├── QueueManager         — Queue scheduling, decides which galleries download
├── GalleryDownloader    — Single gallery download orchestration
│   ├── PageFetcher      — Fetch all page URLs (with pages range filtering)
│   ├── ImageFetcher     — Multi-thread parallel image downloading
│   └── ZipPacker        — Read from OPFS → streaming ZIP → chrome.downloads
└── StorageManager       — OPFS read/write/cleanup
```

### Single Gallery Download Flow

1. Fetch all gallery page URLs (supports pages range filtering)
2. Parse image URLs from each page (ported from original `getPageData`)
3. Multi-thread parallel image download via `fetch`
4. Each image downloaded → immediately written to OPFS → memory released
5. All images done → read from OPFS sequentially → JSZip streaming pack
6. `chrome.downloads.download()` triggers browser save dialog
7. Clean up OPFS files for this gallery

### Thread Pool

- Global thread pool (default 5 threads)
- Max concurrent galleries configurable (default 1, max 3)
- Multiple galleries share the thread pool evenly

### OPFS Storage

Images are stored in OPFS immediately after download to avoid memory accumulation. Benefits:

- Constant low memory usage regardless of gallery size
- Supports crash recovery (already-downloaded images persist on disk)
- Enables resumption after Dashboard tab is reopened

OPFS directory structure:

```
opfs-root/
└── {galleryId}/
    ├── 001.jpg
    ├── 002.png
    └── ...
```

### ZIP Packing

- Directory name template default: `/` (no folder created in ZIP)
- When `dirName` is `/` or empty → images placed at ZIP root
- When `dirName` is set → images placed inside the named folder
- File name template default: `{title}` → used as ZIP file name
- Template variables: `{gid}`, `{token}`, `{title}`, `{subtitle}`, `{category}`, `{uploader}`

## Error Handling (7 Layers)

All error handling from the original script is preserved, adapted for the Dashboard UI.

### Layer 1: Per-Image Auto Retry

- Each image tracks `retryCount`, max retries configurable (default 3)
- If image URL is known → retry image download directly
- If image URL is unknown → retry from page data parsing
- Re-entry guard via AbortController (replaces original `failedProcessing` flag)

### Layer 2: Watchdog Timer (Stall Detection)

- 30-second watchdog per image download
- Reset on every `progress` event from fetch
- No progress for 30s → abort + trigger retry
- Status: `Failed! (Stall Detected)`

### Layer 3: Speed Detection

- Calculate real-time speed from fetch progress events
- 3 seconds no progress → display `0 KB/s`
- Speed below threshold (default 5 KB/s) for N seconds (default 30s) → abort + retry
- Status: `Failed! (Low Speed)`

### Layer 4: Response Content Validation

Checked in order after download completes:

| Check | Detection | Action |
|-------|-----------|--------|
| Empty Response | `!response` | Retry |
| 403 Access Denied | `byteLength === 925` or `=== 28` | Force retry (ignores retry limit) |
| Image Limits / GP exhausted | Specific byte lengths or response text matching | **Auto-pause entire download**, show banner in Dashboard |
| IP Ban | Response contains "temporarily banned" | **Auto-pause**, show banner with expiry info |
| Account Suspended | Response contains "suspended" | Prompt to switch to resized images or cancel |
| Non-200 status | `status !== 200` | Retry (404 → force fail) |
| Wrong MIME type | Content-Type not image format | Retry |
| Checksum mismatch | SHA1 hash vs URL signature | Retry |

### Layer 5: Global Failure Check

When all images are processed (downloaded + failed = total):

- Has failures → show "Retry Failed" option in Dashboard
- User can retry or save partial download
- All succeeded → proceed to ZIP packing

### Layer 6: Periodic Retry

- When active downloads remain but some items have permanently failed
- Auto-retry all failed items every N seconds (default 60, configurable)
- Resets retryCount for all failed items

### Layer 7: Network-Level Errors

- Network error → status `Failed! (Network Error)` → enter retry flow
- Timeout (default 300s) → status `Failed! (Timed Out)` → enter retry flow

### UI Adaptation

Original script uses `alert()` and `confirm()` dialogs. New design replaces them with:

- **Banner** — for blocking issues (Image Limits exceeded, IP Ban) shown at top of Main Area
- **Toast** — for transient notifications (download complete, retry triggered)
- **Status text + color** — per-image status in progress table (green/yellow/red)

## Data Model

```typescript
interface QueueItem {
  id: string                     // `${gid}_${token}`
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

interface ImageTask {
  galleryId: string
  index: number
  realIndex: number
  pageUrl: string
  imageUrl: string | null
  imageName: string | null
  status: 'pending' | 'fetching' | 'hashing' | 'done' | 'failed'
  progress: number               // 0-1
  speed: number                  // KB/s
  retryCount: number
  error: string | null
}

interface Settings {
  threadCount: number            // default 5
  maxConcurrentGalleries: number // default 1
  retryCount: number             // default 3
  timeout: number                // default 300 (seconds)
  speedDetect: boolean           // default true
  speedMinKBs: number            // default 5
  speedExpiredSec: number        // default 30
  periodicRetrySec: number       // default 60
  dirNameTemplate: string        // default '/'
  fileNameTemplate: string       // default '{title}'
  numberImages: boolean          // default false
  checksum: boolean              // default true
  peakHoursWarning: boolean      // default true
  imageLimitsWarning: boolean    // default true
}

interface ImageLimits {
  current: number
  total: number
  isDonator: boolean
  isSuspended: boolean
  isIpBanned: boolean
  timestamp: number
}
```

### Storage Location

| Data | Location | Reason |
|------|----------|--------|
| `QueueItem[]` | `chrome.storage.local` | Shared across content script / background / dashboard |
| `ImageTask[]` | React state (in-memory) | High-frequency updates, not persisted |
| `Settings` | `chrome.storage.local` | Persistent configuration |
| `ImageLimits` | `chrome.storage.local` | Periodically updated, read everywhere |
| Image binary data | OPFS | Avoids memory pressure |
| Download history | `chrome.storage.local` | Completed gallery records |

## Settings Panel

Opened as a modal from the Dashboard header.

### Download Settings

| Setting | Control | Default |
|---------|---------|---------|
| Concurrent threads | number input | 5 |
| Concurrent galleries | number input | 1 |
| Retry count | number input | 3 |
| Request timeout (sec) | number input | 300 |
| Periodic retry interval (sec) | number input | 60 |
| Checksum verification | toggle | on |

### File Settings

| Setting | Control | Default |
|---------|---------|---------|
| ZIP directory name | text input | `/` (no folder) |
| ZIP file name | text input | `{title}` |
| Auto-number images | toggle | off |

Template variables shown below inputs: `{gid}`, `{token}`, `{title}`, `{subtitle}`, `{category}`, `{uploader}`

### Warning Settings

| Setting | Control | Default |
|---------|---------|---------|
| Peak Hours warning | toggle | on |
| Image Limits warning | toggle | on |
| Speed detection | toggle | on |
| Min speed threshold (KB/s) | number input | 5 |
| Low speed timeout (sec) | number input | 30 |

## Manifest V3 Configuration

```json
{
  "manifest_version": 3,
  "name": "E-Hentai Downloader",
  "version": "2.0.0",
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
    "service_worker": "src/background/index.ts"
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
    "default_popup": null
  }
}
```

## Theme

Follows system preference via `prefers-color-scheme` media query. Tailwind CSS `dark:` variant handles all dark mode styles. No manual toggle — automatically adapts.
