export class ShionlibBizError extends Error {
  code: number
  digest?: string
  constructor(code: number, message: string) {
    super(`${message}(${code})`)
    this.code = code
    this.name = 'ShionlibBizError'
    this.digest = createPublicErrorDigest(code, message)
  }
}

const PUBLIC_ERROR_DIGEST_PREFIX = 'shion-public:v1:'
export const createPublicErrorDigest = (code: number, message: string): string =>
  `${PUBLIC_ERROR_DIGEST_PREFIX}${code}:${encodeURIComponent(message)}`
export const parsePublicErrorDigest = (
  digest?: string,
): { code: number; message: string } | undefined => {
  if (!digest || !digest.startsWith(PUBLIC_ERROR_DIGEST_PREFIX)) return undefined

  const payload = digest.slice(PUBLIC_ERROR_DIGEST_PREFIX.length)
  const separatorIndex = payload.indexOf(':')
  if (separatorIndex <= 0) return undefined

  const code = Number(payload.slice(0, separatorIndex))
  if (!Number.isFinite(code)) return undefined

  const encodedMessage = payload.slice(separatorIndex + 1)
  if (!encodedMessage) return undefined

  try {
    return { code, message: decodeURIComponent(encodedMessage) }
  } catch {
    return undefined
  }
}
