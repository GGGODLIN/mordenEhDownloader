# E-Hentai Downloader (Modern)

[English](#english) | [繁體中文](#繁體中文)

---

## English

A modern Chrome Extension (Manifest V3) for downloading E-Hentai galleries as ZIP files, featuring a React-based download dashboard.

Download logic ported from [ccloli/E-Hentai-Downloader](https://github.com/ccloli/E-Hentai-Downloader) (v1.36.1). This project reimplements the original userscript as a standalone Chrome Extension with a modern UI and improved architecture.

### Features

- **Content Script** — Adds an "Add to Queue" button and Pages Range input on E-Hentai/ExHentai gallery pages
- **Download Dashboard** — Manage all downloads in a dedicated tab with real-time progress
- **Multi-thread Download** — Parallel image downloading with configurable thread count
- **Download Queue** — Auto-start downloads, queue management with configurable concurrent galleries
- **OPFS Storage** — Images stored on disk (not in memory) for low memory footprint and crash recovery
- **7-Layer Error Handling** — 403 detection, IP ban, image limits, checksum verification, watchdog, speed detection, periodic retry
- **ZIP Packing** — JSZip with duplicate filename handling and configurable directory structure
- **Dark/Light Theme** — Follows system preference automatically
- **Settings** — Thread count, retry count, filename templates, speed detection, warnings, and more

### Installation

1. Download `eh-downloader-v2.0.0.zip` from [Releases](https://github.com/GGGODLIN/mordenEhDownloader/releases)
2. Unzip the file
3. Open `chrome://extensions/`
4. Enable **Developer Mode** (top-right toggle)
5. Click **Load unpacked** → select the `dist/` folder inside the unzipped directory
6. Click the extension icon to open the Dashboard

### How to Use

1. Open an E-Hentai or ExHentai gallery page
2. You'll see an **"Add to Queue"** button below the gallery info
3. Optionally set a **Pages Range** (e.g. `1-10,!5,20-30/2`)
4. Click the button — the gallery is added to the download queue
5. Open the **Dashboard** (click the extension icon) to monitor progress
6. Downloads start automatically and save as ZIP when complete

### How It Works

This extension does NOT use the official archive download, so it won't spend your GPs or credits directly. It fetches all pages of the gallery, extracts image URLs, downloads them via `fetch` (CORS bypassed by extension `host_permissions`), stores them in OPFS (Origin Private File System), and packs them into a ZIP file.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Build | Vite + CRXJS |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS |
| Image Storage | OPFS |
| ZIP | JSZip |
| Download | chrome.downloads API |

### Build from Source

```bash
git clone https://github.com/GGGODLIN/mordenEhDownloader.git
cd mordenEhDownloader
npm install
npm run build
```

The built extension will be in `dist/`.

### Should Be Noticed

- This extension is NOT provided by the official E-Hentai. Using automated tools may trigger throttle limits or account bans. **USE AT YOUR OWN RISK.**
- For large galleries, consider using torrents if available for a more stable experience.
- See [E-Hentai Image Viewing Limits](https://github.com/ccloli/E-Hentai-Downloader/wiki/E%E2%88%92Hentai-Image-Viewing-Limits) for details on how image limits work.
- Chrome (or Chromium-based browsers) only. Firefox is not supported at this time.

### Credits

- Original userscript: [ccloli/E-Hentai-Downloader](https://github.com/ccloli/E-Hentai-Downloader) by [864907600cc](https://github.com/ccloli)
- [JSZip](https://github.com/Stuk/jszip) for ZIP generation

### License

MIT

---

## 繁體中文

現代化的 Chrome Extension（Manifest V3），用於下載 E-Hentai 畫廊為 ZIP 檔案，內建 React 下載管理面板。

下載邏輯移植自 [ccloli/E-Hentai-Downloader](https://github.com/ccloli/E-Hentai-Downloader)（v1.36.1）。本專案將原始油猴腳本重新實作為獨立的 Chrome Extension，採用現代化 UI 與改良架構。

### 功能特色

- **Content Script** — 在 E-Hentai/ExHentai 畫廊頁面加入「加入佇列」按鈕和頁面範圍輸入框
- **下載面板** — 在專屬分頁中管理所有下載，即時顯示進度
- **多執行緒下載** — 並行下載圖片，可設定執行緒數量
- **下載佇列** — 自動開始下載，支援設定同時下載的畫廊數量
- **OPFS 儲存** — 圖片存在磁碟（非記憶體），低記憶體佔用且支援斷點續傳
- **7 層錯誤處理** — 403 偵測、IP 封鎖、圖片配額、校驗碼驗證、看門狗、速度偵測、週期性重試
- **ZIP 打包** — 使用 JSZip，自動處理重複檔名，可設定資料夾結構
- **深色/淺色主題** — 自動跟隨系統設定
- **設定面板** — 執行緒數、重試次數、檔名模板、速度偵測、警告等

### 安裝方式

1. 從 [Releases](https://github.com/GGGODLIN/mordenEhDownloader/releases) 下載 `eh-downloader-v2.0.0.zip`
2. 解壓縮檔案
3. 開啟 `chrome://extensions/`
4. 開啟右上角的**開發人員模式**
5. 點擊**載入未封裝項目** → 選擇解壓後的 `dist/` 資料夾
6. 點擊 Extension 圖示開啟下載面板

### 使用方式

1. 開啟 E-Hentai 或 ExHentai 的畫廊頁面
2. 在畫廊資訊下方會看到 **「Add to Queue」** 按鈕
3. 可選擇設定**頁面範圍**（例如 `1-10,!5,20-30/2`）
4. 點擊按鈕 — 畫廊加入下載佇列
5. 開啟**下載面板**（點擊 Extension 圖示）監控進度
6. 下載自動開始，完成後儲存為 ZIP

### 運作原理

本 Extension 不使用官方的 Archive 下載功能，因此不會直接消耗你的 GP 或 Credits。它會抓取畫廊的所有分頁，解析圖片網址，透過 `fetch`（Extension 的 `host_permissions` 繞過 CORS）下載圖片，存入 OPFS（Origin Private File System），最後打包成 ZIP 檔案。

### 技術架構

| 層級 | 技術 |
|------|------|
| 建置工具 | Vite + CRXJS |
| 介面 | React 18 + TypeScript |
| 樣式 | Tailwind CSS |
| 圖片儲存 | OPFS |
| ZIP 打包 | JSZip |
| 下載觸發 | chrome.downloads API |

### 從原始碼建置

```bash
git clone https://github.com/GGGODLIN/mordenEhDownloader.git
cd mordenEhDownloader
npm install
npm run build
```

建置完成的 Extension 在 `dist/` 資料夾。

### 注意事項

- 本 Extension 並非 E-Hentai 官方提供。使用自動化工具可能觸發流量限制或帳號封鎖。**風險自負。**
- 大型畫廊建議優先使用 Torrent 下載，體驗更穩定。
- 關於圖片配額的詳細規則，請參閱 [E-Hentai Image Viewing Limits](https://github.com/ccloli/E-Hentai-Downloader/wiki/E%E2%88%92Hentai-Image-Viewing-Limits)。
- 僅支援 Chrome（或 Chromium 系瀏覽器），目前不支援 Firefox。

### 致謝

- 原始油猴腳本：[ccloli/E-Hentai-Downloader](https://github.com/ccloli/E-Hentai-Downloader)，作者 [864907600cc](https://github.com/ccloli)
- [JSZip](https://github.com/Stuk/jszip) 用於 ZIP 生成

### 授權

MIT
