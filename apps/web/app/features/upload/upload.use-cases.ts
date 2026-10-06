import type { ApiClient } from '~/shared/api/client'
import type { Schema } from '~/shared/api/types'
import type {
  FileIdentity,
  OngoingUpload,
  Upload,
  UploadSession,
  UploadState,
  UploadTarget,
} from './upload'
import { retrying } from './upload-failure'
import { restoreState } from './upload-restore'
import type { SavedState } from './upload.schema'

type FileEntry = Schema<'DownloadFileUploadInput'>

export async function loadOngoing(api: ApiClient): Promise<OngoingUpload[]> {
  return (await api.get('/uploads/large/ongoing')) ?? []
}

export async function restoreUploads(
  api: ApiClient,
  saved: SavedState,
  signal: AbortSignal,
  random: () => number,
): Promise<UploadState | undefined> {
  const quiet = { wait: () => undefined, resume: () => undefined, random }
  const ongoing = await retrying(signal, () => loadOngoing(api), quiet).catch(() => undefined)
  return ongoing === undefined ? undefined : restoreState(saved, ongoing)
}

export function loadAllowance(api: ApiClient) {
  return api.get('/uploads/quota')
}

export async function openSession(api: ApiClient, file: FileIdentity): Promise<UploadSession> {
  const opened = await api.post('/uploads/large/init', {
    body: { file_name: file.name, total_size: file.size },
  })
  return {
    id: opened.upload_session_id,
    chunkSize: opened.chunk_size,
    totalChunks: opened.total_chunks,
  }
}

export async function uploadedChunks(api: ApiClient, session: number): Promise<number[]> {
  const status = await api.get('/uploads/large/{id}/status', { params: { path: { id: session } } })
  return status.uploaded_chunks ?? []
}

export async function completeSession(api: ApiClient, session: number, digest: string) {
  await api.patch('/uploads/large/{id}/complete', {
    params: { path: { id: session } },
    body: { file_sha256: digest },
  })
}

export async function discardSession(api: ApiClient, session: number) {
  await api.delete('/uploads/large/{id}', { params: { path: { id: session } } })
}

export async function submitUploads(
  api: ApiClient,
  target: UploadTarget,
  uploads: readonly Upload[],
) {
  const files = uploads.flatMap(fileEntry)
  switch (target.kind) {
    case 'create':
      await api.post('/game/{id}/download-source', {
        params: { path: { id: target.gameId } },
        body: { ...target.resource, files },
      })
      return
    case 'append':
      await api.post('/game/download-source/{id}/files', {
        params: { path: { id: target.resourceId } },
        body: { files },
      })
      return
    case 'replace':
      await api.put('/game/download-source/file/{fileId}/reupload', {
        params: { path: { fileId: target.fileId } },
        body: { upload_session_id: files[0]?.upload_session_id ?? 0, reason: target.reason },
      })
      return
    case 'orphan':
      return
  }
}

function fileEntry(upload: Upload): FileEntry[] {
  if (upload.session === undefined) {
    return []
  }
  const name = upload.name?.trim()
  return [
    name === undefined || name === ''
      ? { upload_session_id: upload.session.id }
      : { upload_session_id: upload.session.id, file_name: name },
  ]
}
