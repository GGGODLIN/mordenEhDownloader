import type { ClassifiedError } from '@shared/types'
import {
  ACCESS_DENIED_BYTE_SIZES,
  LIMITS_EXCEEDED_BYTE_SIZES,
  LIMITS_EXCEEDED_STRINGS,
  IMAGE_MIME_TYPES,
} from '@shared/constants'

export function classifyImageResponse(
  status: number,
  body: string | null,
  contentType: string,
  byteLength: number,
): ClassifiedError | null {
  if (byteLength === 0) {
    return {
      type: 'empty_response',
      message: 'Empty response body',
      shouldRetry: true,
      shouldPauseAll: false,
      forceRetry: false,
    }
  }

  if ((ACCESS_DENIED_BYTE_SIZES as readonly number[]).includes(byteLength)) {
    return {
      type: 'access_denied',
      message: 'Access denied',
      shouldRetry: false,
      shouldPauseAll: false,
      forceRetry: true,
    }
  }

  const isText = body !== null && body.length > 0
  const isLimitsByteSize = (LIMITS_EXCEEDED_BYTE_SIZES as readonly number[]).includes(byteLength)
  const isLimitsText = isText && LIMITS_EXCEEDED_STRINGS.some(s => body.includes(s))
  if (isLimitsByteSize || isLimitsText) {
    return {
      type: 'limits_exceeded',
      message: 'Image limits exceeded',
      shouldRetry: false,
      shouldPauseAll: true,
      forceRetry: false,
    }
  }

  if (isText && body.includes('temporarily banned')) {
    return {
      type: 'ip_banned',
      message: 'IP temporarily banned',
      shouldRetry: false,
      shouldPauseAll: true,
      forceRetry: false,
    }
  }

  if (isText && body.includes('account has been suspended')) {
    return {
      type: 'account_suspended',
      message: 'Account has been suspended',
      shouldRetry: false,
      shouldPauseAll: true,
      forceRetry: false,
    }
  }

  if (status !== 200) {
    return {
      type: 'http_error',
      message: `HTTP error: ${status}`,
      shouldRetry: status !== 404,
      shouldPauseAll: false,
      forceRetry: false,
    }
  }

  const mimeBase = contentType.split(';')[0].split('/')[1] ?? contentType.split(';')[0]
  const mimeType = contentType.split(';')[0].split('/')[0]
  const isValidMime = (IMAGE_MIME_TYPES as readonly string[]).includes(mimeType) ||
    (IMAGE_MIME_TYPES as readonly string[]).includes(mimeBase)
  if (!isValidMime) {
    return {
      type: 'wrong_mime',
      message: `Wrong MIME type: ${contentType}`,
      shouldRetry: true,
      shouldPauseAll: false,
      forceRetry: false,
    }
  }

  return null
}
