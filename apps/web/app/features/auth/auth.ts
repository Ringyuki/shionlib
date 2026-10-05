export const authViews = ['sign-in', 'sign-up', 'forgot-password'] as const

export type AuthView = (typeof authViews)[number]

export const authViewParam = 'auth'

export const codeLength = 6

export const codeResendSeconds = 60

export function remainingSeconds(sentAt: number | undefined, now: number): number {
  if (sentAt === undefined) {
    return 0
  }
  return Math.max(0, codeResendSeconds - Math.floor((now - sentAt) / 1000))
}
