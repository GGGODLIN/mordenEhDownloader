import { describe, it, expect } from 'vitest'
import { classifyImageResponse } from '@services/error-classifier'

describe('classifyImageResponse', () => {
  it('returns empty_response when byteLength is 0', () => {
    const result = classifyImageResponse(200, null, 'image/jpeg', 0)
    expect(result?.type).toBe('empty_response')
    expect(result?.shouldRetry).toBe(true)
  })

  it('returns null for valid image response with null body', () => {
    const result = classifyImageResponse(200, null, 'image/jpeg', 50000)
    expect(result).toBeNull()
  })

  it('returns access_denied for byteLength 925', () => {
    const result = classifyImageResponse(200, null, 'image/jpeg', 925)
    expect(result?.type).toBe('access_denied')
    expect(result?.forceRetry).toBe(true)
  })

  it('returns access_denied for byteLength 28', () => {
    const result = classifyImageResponse(200, null, 'image/jpeg', 28)
    expect(result?.type).toBe('access_denied')
    expect(result?.forceRetry).toBe(true)
  })

  it('returns limits_exceeded for byteLength 142', () => {
    const result = classifyImageResponse(200, null, 'image/jpeg', 142)
    expect(result?.type).toBe('limits_exceeded')
    expect(result?.shouldPauseAll).toBe(true)
  })

  it('returns limits_exceeded when body contains limits string', () => {
    const result = classifyImageResponse(200, 'You have exceeded your image viewing limits', 'text/html', 999)
    expect(result?.type).toBe('limits_exceeded')
    expect(result?.shouldPauseAll).toBe(true)
  })

  it('returns limits_exceeded for "do not have sufficient GP to buy"', () => {
    const result = classifyImageResponse(200, 'do not have sufficient GP to buy', 'text/html', 999)
    expect(result?.type).toBe('limits_exceeded')
  })

  it('returns ip_banned when body contains "temporarily banned"', () => {
    const result = classifyImageResponse(200, 'You are temporarily banned', 'text/html', 999)
    expect(result?.type).toBe('ip_banned')
    expect(result?.shouldPauseAll).toBe(true)
  })

  it('returns account_suspended when body contains "account has been suspended"', () => {
    const result = classifyImageResponse(200, 'Your account has been suspended', 'text/html', 999)
    expect(result?.type).toBe('account_suspended')
    expect(result?.shouldPauseAll).toBe(true)
  })

  it('returns http_error for non-200 status', () => {
    const result = classifyImageResponse(500, 'Server Error', 'text/html', 999)
    expect(result?.type).toBe('http_error')
    expect(result?.shouldRetry).toBe(true)
  })

  it('returns http_error for 404 with shouldRetry false', () => {
    const result = classifyImageResponse(404, 'Not Found', 'text/html', 999)
    expect(result?.type).toBe('http_error')
    expect(result?.shouldRetry).toBe(false)
  })

  it('returns wrong_mime for non-image content type with text body', () => {
    const result = classifyImageResponse(200, 'some body content here', 'text/html', 999)
    expect(result?.type).toBe('wrong_mime')
    expect(result?.shouldRetry).toBe(true)
  })

  it('returns null for valid image response', () => {
    const result = classifyImageResponse(200, null, 'image/jpeg', 50000)
    expect(result).toBeNull()
  })

  it('returns null for valid image with png mime', () => {
    const result = classifyImageResponse(200, null, 'image/png', 12345)
    expect(result).toBeNull()
  })
})
