export interface SignResInterface {
  token: string
  tokenExp: Date | null
  refreshToken: string
  refreshTokenExp: Date
  sessionId: number
  familyId: string
}
