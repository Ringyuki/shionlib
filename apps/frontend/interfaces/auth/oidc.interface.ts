export interface OidcIdentityItem {
  id: number
  provider: string
  email_at_link: string | null
  created: string
}

export interface OidcIdentitiesResponse {
  items: OidcIdentityItem[]
  can_unlink: boolean
}
