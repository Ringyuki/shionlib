import { AuthConfig } from '../interfaces/auth.interface'
import { withDefault } from '../../utils/env.util'

export default (): AuthConfig => ({
  token: {
    secret: withDefault('TOKEN_SECRET', ''),
    expiresIn: withDefault('TOKEN_EXPIRES_IN_SEC', ''),
  },
  refresh_token: {
    shortWindowSec: withDefault('REFRESH_TOKEN_SHORT_WINDOW_SEC', ''),
    longWindowSec: withDefault('REFRESH_TOKEN_LONG_WINDOW_SEC', ''),
    pepper: withDefault('REFRESH_TOKEN_PEPPER', ''),
    rotationGraceSec: withDefault('REFRESH_TOKEN_ROTATION_GRACE_SEC', 100),
    algorithmVersion: withDefault('REFRESH_TOKEN_ALOGRITHM_VERSION', 'slrt1'),
  },
  webauthn: {
    rpId: withDefault('WEBAUTHN_RP_ID', 'localhost'),
    rpName: withDefault('WEBAUTHN_RP_NAME', 'Shionlib'),
    origins: withDefault('WEBAUTHN_ORIGINS', ['http://localhost:3000'], raw =>
      raw
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
    ),
    timeoutMs: withDefault('WEBAUTHN_TIMEOUT_MS', 60000),
    challengeTtlSec: withDefault('WEBAUTHN_CHALLENGE_TTL_SEC', 300),
  },
})
