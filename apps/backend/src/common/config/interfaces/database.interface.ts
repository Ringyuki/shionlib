export interface DatabaseConfig {
  database: {
    url: string
    enable_backup: boolean
    backup_retention: number
  }
  redis: {
    host: string
    port: number
    password: string
    keyPrefix: string
    database: number
  }
}
