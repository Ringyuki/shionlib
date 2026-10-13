import type { Schema } from '~/shared/api/types'

export type Passkey = Schema<'PasskeyDTO'>

export type Identity = Schema<'OidcIdentityDTO'>

export type Identities = Schema<'OidcIdentitiesDTO'>

export type PotatoBinding = Schema<'PotatoVNBindingDTO'>

export type Security = { passkeys: Passkey[] }

export type LinkResult = { linked: boolean; reason: string | undefined }

export type Connections = {
  identities: Identities
  potato: PotatoBinding | null
  linkResult: LinkResult | undefined
}

export type PasskeyProblem = 'unsupported' | 'cancelled'

export type SentCodes = { currentId?: string; newId?: string; sentTo?: string }

export const linkedParam = 'oidc_linked'

export const linkErrorParam = 'oidc_error'

export const knownLinkErrors = ['link_conflict', 'link_auth', 'email_unverified'] as const

export type KnownLinkError = (typeof knownLinkErrors)[number]

export function knownLinkError(reason: string | undefined): KnownLinkError | undefined {
  return knownLinkErrors.find(known => known === reason)
}
