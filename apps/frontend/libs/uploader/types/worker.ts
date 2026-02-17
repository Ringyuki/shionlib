type HashWorkerProgressMessage = {
  type: 'hash-progress'
  bytesHashed: number
  totalBytes: number
}

type HashWorkerCompleteMessage = {
  type: 'hash-complete'
  digest: string
}

type HashWorkerErrorMessage = {
  type: 'hash-error'
  error: {
    name: string
    message: string
  }
}

export type HashWorkerResponse =
  | HashWorkerProgressMessage
  | HashWorkerCompleteMessage
  | HashWorkerErrorMessage

export type HashWorkerRequest =
  | {
      type: 'hash'
      file: File
      step: number
    }
  | {
      type: 'abort'
    }

export type ChunkHashWorkerRequest =
  | {
      type: 'chunk-hash'
      id: number
      buffer: ArrayBuffer
    }
  | {
      type: 'abort'
    }

type ChunkHashWorkerCompleteMessage = {
  type: 'chunk-hash-complete'
  id: number
  digest: string
}

type ChunkHashWorkerErrorMessage = {
  type: 'chunk-hash-error'
  id: number
  error: {
    name: string
    message: string
  }
}

export type ChunkHashWorkerResponse = ChunkHashWorkerCompleteMessage | ChunkHashWorkerErrorMessage
