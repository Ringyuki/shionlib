import type { ApiClient } from '~/shared/api/client'
import { fileBody } from '~/shared/api/file-body'

export function uploadDocumentPicture(api: ApiClient, file: File) {
  return api.put('/uploads/small/richtext/image', fileBody('file', file))
}
