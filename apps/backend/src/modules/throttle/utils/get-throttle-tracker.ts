type RequestLike = {
  ip?: string
  headers?: Record<string, string | string[] | undefined>
}

const getHeaderValue = (value?: string | string[]) => {
  if (Array.isArray(value)) return value[0]
  return value
}

export const getThrottleTracker = (req?: RequestLike) => {
  const xRealIp = getHeaderValue(req?.headers?.['x-real-ip'])?.trim()
  if (xRealIp) return xRealIp

  const cfConnectingIp = getHeaderValue(req?.headers?.['cf-connecting-ip'])?.trim()
  if (cfConnectingIp) return cfConnectingIp

  const xForwardedFor = getHeaderValue(req?.headers?.['x-forwarded-for'])?.split(',')[0]?.trim()
  if (xForwardedFor) return xForwardedFor

  return req?.ip || ''
}
