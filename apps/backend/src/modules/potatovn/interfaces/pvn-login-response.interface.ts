export interface PvnLoginResponse {
  user: {
    id: number
    userName: string
  }
  token: string
  /** Unix timestamp (seconds) */
  expire: number
}
