import { randomBytes, createHash } from 'crypto'
import argon2 from 'argon2'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'

export const generateOpaque = (): string => {
  return base64url(randomBytes(32)) // 256-bit
}

export const calcPrefix = (opaque: string): string => {
  const sha = createHash('sha256').update(opaque).digest()
  return base64url(sha).slice(0, 16)
}

export const hashOpaque = async (opaque: string, pepper: string) => {
  return argon2.hash(opaque + pepper, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })
}

export const verifyOpaque = async (hash: string, opaque: string, pepper: string) => {
  return argon2.verify(hash, opaque + pepper)
}

export const formatRefreshToken = (prefix: string, opaque: string, version: string): string => {
  return `${version}.${prefix}.${opaque}`
}

export const parseRefreshToken = (
  token: string,
  version: string,
): { version: string; prefix: string; opaque: string } => {
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== version)
    throw new ShionBizException(
      ShionBizCode.AUTH_INVALID_REFRESH_TOKEN,
      'shion-biz.AUTH_INVALID_REFRESH_TOKEN',
    )
  const [, prefix, opaque] = parts
  if (!prefix || !opaque)
    throw new ShionBizException(
      ShionBizCode.AUTH_INVALID_REFRESH_TOKEN,
      'shion-biz.AUTH_INVALID_REFRESH_TOKEN',
    )
  return { version: parts[0], prefix, opaque }
}

const base64url = (buf: Buffer) => {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
