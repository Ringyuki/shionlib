export type DownloadProxyTicketPayload = {
  /**
   * Version of the ticket payload
   */
  v: 3
  /**
   * Session ID
   * @description The session ID is used to identify the session of the download, stored in the worker's memory
   * @example '123e4567-e89b-12d3-a456-426614174000'
   */
  sid: string
  /**
   * File ID
   * @description The file ID is used to identify the file to be downloaded
   * @example 1
   */
  fid: number
  /**
   * File name
   * @description The file name is used to identify the file to be downloaded
   * @example 'game.7z'
   */
  n: string
  /**
   * Expiration time
   */
  exp: number
  /**
   * Maximum concurrent connections
   */
  mc: number
  /**
   * B2 bucket name
   */
  b: string
  /**
   * B2 file key
   */
  k: string
  /**
   * B2 download authorization token
   */
  a: string
  /**
   * B2 native download URL
   * @example 'https://f005.backblazeb2.com'
   */
  u: string
  /**
   * Game ID
   * @description The game ID associated with this download, used for analytics
   * @example 42
   */
  gid: number
}

export type IssueDownloadProxyUrlInput = {
  fileId: number
  fileName: string
  bucketName: string
  fileKey: string
  authorizationToken: string
  downloadUrl: string
  expiresIn: number
  gameId: number
}
