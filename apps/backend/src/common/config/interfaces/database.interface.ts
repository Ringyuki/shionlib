export interface DatabaseConfig {
  database: {
    url: string
    enable_backup: boolean
    backup_retention_daily: number
    backup_retention_weekly: number
  }
  redis: {
    host: string
    port: number
    password: string
    keyPrefix: string
    database: number
  }
}
