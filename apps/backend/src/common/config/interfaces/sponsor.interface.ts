export interface SponsorConfig {
  sponsor: {
    enabled: boolean
    provider: string
    idatariver: {
      baseUrl: string
      developerSecret: string
      projectId: string
    }
  }
}
