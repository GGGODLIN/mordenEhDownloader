import { useState, useEffect } from 'react'
import type { ImageLimits } from '@shared/types'
import { REGEX } from '@shared/constants'
import { storage } from '@shared/storage'

export function useImageLimits(): ImageLimits {
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
      const data: ImageLimits = { current: 0, total: 0, isDonator: false, isSuspended: false, isIpBanned: false, timestamp: Date.now() }

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
    } catch {}
  }

  return limits
}
