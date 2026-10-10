import { useRef } from 'react'
import { createBrowserApi } from '~/shared/api/browser-client'
import type { PictureUpload, UploadOutcome } from '~/shared/editor'
import { refusalFrom, useRefusalText } from '~/shared/route/refusal'
import { percentSent } from './media'
import { uploadDocumentPicture } from './media.use-cases'

export function useDocumentPicture(): PictureUpload {
  const text = useRefusalText()
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  return (file, onProgress) => {
    const sent = queue.current.then(async (): Promise<UploadOutcome> => {
      const api = createBrowserApi(location.origin, (bytes, total) =>
        onProgress(percentSent(bytes, total)),
      )
      try {
        const { key, width, height } = await uploadDocumentPicture(api, file)
        return { ok: true, picture: { src: key, width, height } }
      } catch (error) {
        console.error(error)
        return { ok: false, reason: text(refusalFrom(error)) }
      }
    })
    queue.current = sent
    return sent
  }
}
