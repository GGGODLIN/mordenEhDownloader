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
    } catch {}
  },

  async deleteImage(galleryId: string, fileName: string): Promise<void> {
    try {
      const dir = await getGalleryDir(galleryId, false)
      await dir.removeEntry(fileName)
    } catch {}
  },
}
