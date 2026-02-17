import { LargeFileUploadApi } from './api'

export type UploaderOptions = {
  api?: LargeFileUploadApi
  desiredChunkSize?: number
  concurrency?: number
  retry?: {
    retries: number
    baseDelayMs: number
    maxDelayMs: number
  }
  smallFileThreshold?: number
}
