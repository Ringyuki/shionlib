import type { ApiClient } from '~/shared/api/client'
import type { IssueLink } from './download.schema'

export async function issueDownloadLink(api: ApiClient, request: IssueLink) {
  return api.get('/game/download/{id}/link', {
    params: { path: { id: request.fileId }, query: { token: request.token } },
  })
}
