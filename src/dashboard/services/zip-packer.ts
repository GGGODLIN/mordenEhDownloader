import JSZip from 'jszip'
import { storageManager } from './storage-manager'
import { REGEX } from '@shared/constants'

export interface PackOptions {
  galleryId: string
  dirName: string
  fileName: string
  nameMapping: Map<string, string> | null
  onProgress: (percent: number) => void
  infoText?: string
  compressionLevel?: number
}

export async function packAndDownload(options: PackOptions): Promise<void> {
  const { galleryId, dirName, fileName, nameMapping, onProgress, infoText, compressionLevel } = options

  const imageFiles = await storageManager.listImages(galleryId)
  const zip = new JSZip()

  const useRoot = dirName === '/' || REGEX.slashOnly.test(dirName)
  const folder = useRoot ? zip : zip.folder(dirName)!

  if (infoText) {
    folder.file('info.txt', infoText)
  }

  for (let i = 0; i < imageFiles.length; i++) {
    const storedName = imageFiles[i]
    const data = await storageManager.readImage(galleryId, storedName)
    const originalName = storedName.replace(/^\d{5}_/, '')
    const actualName = nameMapping?.get(storedName) ?? originalName
    folder.file(actualName, data)
    onProgress(Math.round(((i + 1) / imageFiles.length) * 50))
  }

  const level = compressionLevel ?? 0
  const generateOptions = level > 0
    ? { type: 'blob' as const, compression: 'DEFLATE' as const, compressionOptions: { level } }
    : { type: 'blob' as const, compression: 'STORE' as const }

  const blob = await zip.generateAsync(
    generateOptions,
    (meta) => {
      onProgress(50 + Math.round(meta.percent / 2))
    },
  )

  const blobUrl = URL.createObjectURL(blob)

  await chrome.downloads.download({
    url: blobUrl,
    filename: fileName,
    saveAs: true,
  })

  setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000)

  await storageManager.deleteGallery(galleryId)
}
