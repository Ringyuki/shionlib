export type RefreshResult = {
  setCookies: string[]
  accessTokenExp: number | null
}
export type ServerRequestContext = {
  cookieHeader: string
  realIp?: string
  userAgent?: string
}
