export interface OidcConfig {
  oidc: {
    issuer: string
    clientId: string
    clientSecret: string
    redirectUri: string
    scopes: string
  }
}
