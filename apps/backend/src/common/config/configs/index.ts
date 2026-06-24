import appConfig from './app.config'
import authConfig from './auth.config'
import databaseConfig from './database.config'
import llmsConfig from './llms.config'
import oidcConfig from './oidc.config'
import potatovnConfig from './potatovn.config'
import sponsorConfig from './sponsor.config'

export default [
  appConfig,
  authConfig,
  databaseConfig,
  llmsConfig,
  oidcConfig,
  potatovnConfig,
  sponsorConfig,
]

export * from './app.config'
export * from './auth.config'
export * from './database.config'
export * from './llms.config'
export * from './oidc.config'
export * from './potatovn.config'
export * from './sponsor.config'
