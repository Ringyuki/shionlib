import { OidcConfig } from '../interfaces/oidc.interface'
import { withDefault } from '../../utils/env.util'

export default (): OidcConfig => ({
  oidc: {
    issuer: withDefault('OIDC_ISSUER', 'http://localhost:5010/oidc'),
    clientId: withDefault('OIDC_CLIENT_ID', 'shionlib'),
    clientSecret: withDefault('OIDC_CLIENT_SECRET', ''),
    allowedOrigins: withDefault('OIDC_ALLOWED_ORIGINS', ['http://localhost:3000'], raw =>
      raw
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean),
    ),
    scopes: withDefault('OIDC_SCOPES', 'openid profile email'),
  },
})
