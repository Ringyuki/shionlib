import { DatabaseConfig } from '../interfaces/database.interface'
import { withDefault } from '../../utils/env.util'

export default (): DatabaseConfig => ({
  database: {
    url: withDefault('DATABASE_URL', ''),
    enable_backup: withDefault('ENABLE_BACKUP', false),
    backup_retention_daily: withDefault('DATABASE_BACKUP_RETENTION_DAILY', 7),
    backup_retention_weekly: withDefault('DATABASE_BACKUP_RETENTION_WEEKLY', 4),
  },

  redis: {
    host: withDefault('REDIS_HOST', 'localhost'),
    port: withDefault('REDIS_PORT', 6379),
    password: withDefault('REDIS_PASSWORD', ''),
    keyPrefix: withDefault('REDIS_KEY_PREFIX', 'shionlib'),
    database: withDefault('REDIS_DB', 0),
  },
})
