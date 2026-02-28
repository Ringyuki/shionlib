import type { AuthSessionPayload } from '@/interfaces/auth/auth-session.interface'

export type RefreshResult = {
  setCookies: string[]
  session: AuthSessionPayload | null
}
export type ServerRequestContext = {
  cookieHeader: string
  realIp?: string
  userAgent?: string
}
