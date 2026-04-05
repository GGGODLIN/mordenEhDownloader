let notified = false
let titleFlashTimer: ReturnType<typeof setInterval> | null = null
let recoveryTimer: ReturnType<typeof setInterval> | null = null
let originalTitle = ''
let onRecoveredCallback: (() => void) | null = null

function playBeep(): void {
  try {
    const ctx = new AudioContext()
    const tones = [800, 600, 800]
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      gain.gain.value = 0.5
      const start = ctx.currentTime + i * 0.25
      osc.start(start)
      osc.stop(start + 0.15)
    })
    setTimeout(() => ctx.close(), tones.length * 250 + 200)
  } catch {}
}

function startTitleFlash(): void {
  if (titleFlashTimer) return
  originalTitle = document.title
  let toggle = false
  titleFlashTimer = setInterval(() => {
    document.title = toggle ? originalTitle : '⚠ IP BANNED — Download Paused'
    toggle = !toggle
  }, 1000)
}

function stopTitleFlash(): void {
  if (!titleFlashTimer) return
  clearInterval(titleFlashTimer)
  titleFlashTimer = null
  document.title = originalTitle
}

function startRecoveryPolling(): void {
  if (recoveryTimer) return

  recoveryTimer = setInterval(async () => {
    try {
      const res = await fetch('https://e-hentai.org/home.php', { credentials: 'include' })
      const text = await res.text()
      if (!text.includes('Your IP address has been temporarily banned')) {
        stopRecoveryPolling()
        clearBanFlag()
        onRecoveredCallback?.()
      }
    } catch {}
  }, 5_000)
}

function stopRecoveryPolling(): void {
  if (!recoveryTimer) return
  clearInterval(recoveryTimer)
  recoveryTimer = null
}

export function setOnRecovered(cb: () => void): void {
  onRecoveredCallback = cb
}

export function recordBan(): void {
  if (notified) return

  notified = true
  chrome.notifications.create('ip-ban-alert', {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon-notification.png'),
    title: 'E-Hentai Downloader',
    message: 'IP 被暫時封鎖，下載已暫停。請稍後再試。',
    silent: true,
  })
  playBeep()
  startTitleFlash()
  startRecoveryPolling()
}

export function clearBanFlag(): void {
  notified = false
  stopTitleFlash()
  stopRecoveryPolling()
}
