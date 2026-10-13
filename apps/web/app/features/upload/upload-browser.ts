import { createBrowserApi } from '~/shared/api/browser-client'
import { uploadChunk } from '~/shared/api/chunk'
import { readLocal, writeLocal } from '~/shared/storage/local-storage'
import { browserHashWorker } from './file-hasher'
import { clientStorageKey, uploadStorageKey } from './upload'
import { UploadManager } from './upload-manager'
import { clientFrom, savedStateFrom } from './upload.schema'

function browserClient(): string {
  const known = readLocal(clientStorageKey, clientFrom)
  if (known !== '') {
    return known
  }
  const client = crypto.randomUUID()
  writeLocal(clientStorageKey, client)
  return client
}

export function createUploadManager(viewer: number): UploadManager {
  const key = uploadStorageKey(viewer)
  return new UploadManager({
    api: createBrowserApi(),
    client: browserClient(),
    send: uploadChunk,
    hashWorker: browserHashWorker,
    storage: {
      read: () => readLocal(key, savedStateFrom),
      write: state => writeLocal(key, state),
    },
    lock: (name, task) =>
      navigator.locks.request(name, { ifAvailable: true }, async lock => {
        if (lock === null) {
          return false
        }
        await task()
        return true
      }),
    later: (task, milliseconds) => void setTimeout(task, milliseconds),
    now: () => Date.now(),
    random: () => Math.random(),
    newId: () => crypto.randomUUID(),
  })
}
