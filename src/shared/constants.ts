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
  delayRequest: 0,
  dirNameTemplate: '/',
  fileNameTemplate: '{title}',
  numberImages: false,
  numberSeparator: '：',
  numberRealIndex: false,
  checksum: true,
  forceResized: true,
  forceAsLoggedIn: false,
  originalDownloadDomain: '',
  saveGalleryInfo: true,
  compressionLevel: 0,
  replaceWithFullWidth: false,
  autoDownloadOnCancel: true,
  historyCheckDays: 30,
  historyMaxItems: 500,
  peakHoursWarning: true,
  imageLimitsWarning: true,
  slowMode: false,
  slowThreadCount: 1,
  slowMaxConcurrentGalleries: 1,
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
  CHECK_DUPLICATE: 'CHECK_DUPLICATE',
  OPEN_DASHBOARD: 'OPEN_DASHBOARD',
} as const
