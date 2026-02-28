export type RefreshResult = {
  setCookies: string[]
}
export type ServerRequestContext = {
  cookieHeader: string
  realIp?: string
  userAgent?: string
}
