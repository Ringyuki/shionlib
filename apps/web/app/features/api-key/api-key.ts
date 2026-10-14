import type { ApiData, Schema } from '~/shared/api/types'

export type Keys = ApiData<'/user/api-keys', 'get'>

export type Key = Schema<'ApiKeyDTO'>

export type Issued = Schema<'IssuedKeyDTO'>

export const openApiDoc = { category: 'dev', name: 'open-api' } as const

export function canCreate(keys: Pick<Keys, 'keys' | 'limit' | 'enabled'>): boolean {
  return keys.enabled && (keys.keys ?? []).length < keys.limit
}
