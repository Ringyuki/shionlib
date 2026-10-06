import { browserApiBase } from './browser'
import { jsonOf, sendWithSession } from './browser-client'
import { ApiError } from './error'
import type { paths } from './generated/openapi'
import type { ApiData, ApiPath } from './types'
import { toResponse } from './xhr'

const chunkPath = '/uploads/large/{id}/chunks/{index}' satisfies ApiPath<'put'>

type ChunkOperation = paths[typeof chunkPath]['put']

export type ChunkTarget = ChunkOperation['parameters']['path']

export type UploadedChunk = ApiData<typeof chunkPath, 'put'>

export type ChunkUpload = ChunkTarget & {
  content: Blob
  sha256: string
  signal?: AbortSignal
  onProgress?: (sent: number) => void
}

export async function uploadChunk(upload: ChunkUpload): Promise<UploadedChunk> {
  const hash: ChunkOperation['parameters']['header'] = { 'chunk-sha256': upload.sha256 }
  const headers = new Headers(hash)
  headers.set('content-type', 'application/octet-stream')
  const url =
    browserApiBase +
    chunkPath.replace('{id}', String(upload.id)).replace('{index}', String(upload.index))
  const response = await sendWithSession({
    method: 'PUT',
    url,
    headers,
    body: upload.content,
    signal: upload.signal,
    onUploadProgress: upload.onProgress,
  })
  const body = jsonOf(response)
  if (response.status < 200 || response.status >= 300) {
    throw ApiError.fromResponse(toResponse(response), body)
  }
  return (body as { data: UploadedChunk }).data
}
