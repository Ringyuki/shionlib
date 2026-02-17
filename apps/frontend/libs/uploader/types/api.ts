export interface InitResp {
  upload_session_id: number
  chunk_size: number
  total_chunks: number
  expires_at: string
}

export interface StatusResp {
  status: 'UPLOADING' | 'COMPLETED' | 'ABORTED'
  uploaded_chunks: number[]
  file_sha256: string
  total_size: number
  chunk_size: number
  total_chunks: number
  expires_at: string
}

export interface LargeFileUploadApi {
  init(
    params: {
      file_name: string
      total_size: number
      file_sha256: string
      chunk_size?: number
    },
    opts?: { signal?: AbortSignal },
  ): Promise<InitResp>
  status(id: number, opts?: { signal?: AbortSignal }): Promise<StatusResp>
  putChunk(
    id: number,
    index: number,
    blob: Blob,
    chunkSha256: string,
    opts?: { signal?: AbortSignal },
  ): Promise<{
    ok: true
    chunk_index: number
  }>
  complete(
    id: number,
    opts?: { signal?: AbortSignal },
  ): Promise<{
    ok: true
    path?: string
  }>
  abort(id: number, opts?: { signal?: AbortSignal }): Promise<void>
}
