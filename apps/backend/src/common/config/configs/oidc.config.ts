import { OidcConfig } from '../interfaces/oidc.interface'
import { withDefault } from '../../utils/env.util'

export default (): OidcConfig => ({
  oidc: {
    issuer: withDefault('OIDC_ISSUER', 'http://localhost:5010/oidc'),
    clientId: withDefault('OIDC_CLIENT_ID', 'shionlib'),
    clientSecret: withDefault('OIDC_CLIENT_SECRET', ''),
    redirectUri: withDefault('OIDC_REDIRECT_URI', 'http://localhost:3000/api/auth/oidc/callback'),
    scopes: withDefault('OIDC_SCOPES', 'openid profile email'),
  },
})
