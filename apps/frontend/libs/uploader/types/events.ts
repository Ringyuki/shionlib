import { Phase } from './phase'

export type UploaderEvents =
  | { type: 'status'; phase: Phase }
  | { type: 'hash-progress'; bytesHashed: number; totalBytes: number }
  | {
      type: 'progress'
      bytesUploaded: number
      totalBytes: number
      speedBps: number
      etaSec: number | null
    }
  | { type: 'chunk'; index: number }
  | { type: 'retry'; index: number; attempt: number; delayMs: number }
  | { type: 'error'; error: unknown }
  | { type: 'done'; sessionId: number }
  | { type: 'file-mismatch'; sessionId: number }
