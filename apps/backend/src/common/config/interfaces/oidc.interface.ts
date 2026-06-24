export interface OidcConfig {
  oidc: {
    issuer: string
    clientId: string
    clientSecret: string
    allowedOrigins: string[]
    scopes: string
  }
}
