export type DownloadProxyTicketPayload = {
  v: 1
  sid: string
  fid: number
  n: string
  exp: number
  mc: number
  p: string
}

export type IssueDownloadProxyUrlInput = {
  fileId: number
  fileName: string
  originUrl: string
  expiresIn: number
}
