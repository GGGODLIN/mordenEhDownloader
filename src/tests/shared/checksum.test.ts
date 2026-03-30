import { describe, it, expect } from 'vitest'
import { getSha1Checksum } from '@shared/checksum'

describe('getSha1Checksum', () => {
  it('"hello world" produces correct SHA-1', async () => {
    const encoder = new TextEncoder()
    const data = encoder.encode('hello world').buffer
    const result = await getSha1Checksum(data as ArrayBuffer)
    expect(result).toBe('2aae6c35c94fcfb415dbe95f408b9ce91ee846ed')
  })
})
