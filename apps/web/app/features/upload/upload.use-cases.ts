import type { ApiClient } from '~/shared/api/client'
import { constraints } from '~/shared/api/generated/constraints'
import type { Schema } from '~/shared/api/types'
import type { FileIdentity, Picture, Upload, UploadSession, UploadTarget } from './upload'
import { renewalsPerHold } from './upload'
import { retrying } from './upload-failure'
import type { FailureReport } from './upload-report'
import { restoreState, savedSessions } from './upload-restore'
import type { SavedState } from './upload.schema'

type FileEntry = Schema<'DownloadFileUploadInput'>

const holdsPerCall = constraints.HoldUploadsInputBody.upload_session_ids.maxItems

function by(client: string) {
  return { 'X-Upload-Client': client }
}

export async function syncSessions(
  api: ApiClient,
  client: string,
  held: readonly number[],
): Promise<Picture> {
  const header = by(client)
  let renewEvery: number | undefined
  for (let start = 0; start < held.length; start += holdsPerCall) {
    const hold = await api.post('/uploads/large/hold', {
      params: { header },
      body: { upload_session_ids: held.slice(start, start + holdsPerCall) },
    })
    renewEvery = (hold.ttl_seconds * 1000) / renewalsPerHold
  }
  const ongoing = (await api.get('/uploads/large/ongoing', { params: { header } })) ?? []
  return { ongoing, renewEvery }
}

export async function restoreUploads(
  api: ApiClient,
  client: string,
  saved: SavedState,
  signal: AbortSignal,
  random: () => number,
) {
  const quiet = { wait: () => undefined, resume: () => undefined, random }
  const picture = await retrying(
    signal,
    () => syncSessions(api, client, savedSessions(saved)),
    quiet,
  ).catch(() => undefined)
  return picture === undefined
    ? undefined
    : { state: restoreState(saved, picture.ongoing), renewEvery: picture.renewEvery }
}

export async function openSession(
  api: ApiClient,
  client: string,
  file: FileIdentity,
): Promise<UploadSession> {
  const opened = await api.post('/uploads/large/init', {
    params: { header: by(client) },
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

export async function completeSession(
  api: ApiClient,
  client: string,
  session: number,
  digest: string,
) {
  await api.patch('/uploads/large/{id}/complete', {
    params: { path: { id: session }, header: by(client) },
    body: { file_sha256: digest },
  })
}

export async function reportFailure(api: ApiClient, client: string, report: FailureReport) {
  await api.post('/uploads/failures', { params: { header: by(client) }, body: report })
}

export async function discardSession(api: ApiClient, client: string, session: number) {
  await api.delete('/uploads/large/{id}', {
    params: { path: { id: session }, header: by(client) },
  })
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
    case 'compose':
      await api.put(`/composition/{id}/${target.role}`, {
        params: { path: { id: target.compositionId } },
        body: inputOf(uploads),
      })
      return
    case 'rebuild':
      await api.post('/game/download-source/{resourceId}/composition', {
        params: { path: { resourceId: target.resourceId } },
        body: { ...inputOf(uploads), patch_version: target.patchVersion, note: target.note },
      })
      return
    case 'orphan':
    case 'heldElsewhere':
      return
  }
}

function inputOf(uploads: readonly Upload[]) {
  const [upload] = uploads
  const name = upload?.name?.trim() ?? ''
  return {
    upload_session_id: upload?.session?.id ?? 0,
    file_name: name === '' ? (upload?.file.name ?? '') : name,
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
