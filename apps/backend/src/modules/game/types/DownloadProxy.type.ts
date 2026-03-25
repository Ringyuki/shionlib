export type DownloadProxyTicketPayload = {
  /**
   * Version of the ticket payload
   */
  v: 2
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
   * Original URL
   * @description The original URL is the URL of the file to be downloaded
   * @example 'https://cdn.example.com/files/game.7z?Authorization=token123'
   */
  p: string
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
  originUrl: string
  expiresIn: number
  gameId: number
}
