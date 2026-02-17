export interface B2Auth {
  accountId: string
  authorizationToken: string
  apiInfo: ApiInfo
}

export interface ApiInfo {
  storageApi: ApiInfoStorageApi
}

export interface ApiInfoStorageApi {
  absoluteMinimumPartSize: number
  allowed: {
    buckets: Array<{
      id: string
      name: string
    }>
    namePrefix: string
  }
  apiUrl: string
  downloadUrl: string
  recommendedPartSize: number
  s3ApiUrl: string
}

export interface B2DownloadAuth {
  authorizationToken: string
}
