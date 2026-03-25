export interface SponsorConfig {
  sponsor: {
    enabled: boolean
    provider: string
    callbackBaseUrl: string
    idatariver: {
      baseUrl: string
      developerSecret: string
      projectId: string
    }
  }
}
