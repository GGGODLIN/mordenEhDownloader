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
  nl: string | null
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
  delayRequest: number
  dirNameTemplate: string
  fileNameTemplate: string
  numberImages: boolean
  numberSeparator: string
  numberRealIndex: boolean
  checksum: boolean
  forceResized: boolean
  forceAsLoggedIn: boolean
  originalDownloadDomain: string
  saveGalleryInfo: boolean
  compressionLevel: number
  replaceWithFullWidth: boolean
  autoDownloadOnCancel: boolean
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
