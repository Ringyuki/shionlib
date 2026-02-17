export interface RefreshTokenPayloadInterface {
  sub: number // user id
  jti: string
  type: 'refresh'
}
