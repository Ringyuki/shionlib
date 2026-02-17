export interface Aria2Settings {
  protocol: 'http' | 'https'
  host: string
  port: number
  path: string
  auth_secret: string
  downloadPath: string
}

export type TestStatus = 'idle' | 'testing' | 'success' | 'error'
