import { DatabaseConfig } from '../interfaces/database.interface'
import { withDefault } from '../../utils/env.util'

export default (): DatabaseConfig => ({
  database: {
    url: withDefault('DATABASE_URL', ''),
    enable_backup: withDefault('ENABLE_BACKUP', false),
    backup_retention: withDefault('DATABASE_BACKUP_RETENTION', 5),
  },

  redis: {
    host: withDefault('REDIS_HOST', 'localhost'),
    port: withDefault('REDIS_PORT', 6379),
    password: withDefault('REDIS_PASSWORD', ''),
    keyPrefix: withDefault('REDIS_KEY_PREFIX', 'shionlib'),
    database: withDefault('REDIS_DB', 0),
  },
})
