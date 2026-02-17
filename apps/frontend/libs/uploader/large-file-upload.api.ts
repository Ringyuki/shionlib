import { shionlibRequest } from '@/utils/request'
import { LargeFileUploadApi, InitResp, StatusResp } from './types/api'

export function createShionlibLargeFileUploadApi(prefix = '/uploads/large'): LargeFileUploadApi {
  const req = shionlibRequest()

  return {
    async init(params, opts) {
      const res = await req.post<InitResp>(`${prefix}/init`, {
        data: params,
        options: {
          signal: opts?.signal,
        },
      })
      return res.data!
    },

    async status(id, opts) {
      const res = await req.get<StatusResp>(`${prefix}/${id}/status`, {
        options: {
          signal: opts?.signal,
        },
      })
      return res.data!
    },

    async putChunk(id, index, blob, chunkSha256, opts) {
      const res = await req.put<{ ok: true; chunk_index: number }>(
        `${prefix}/${id}/chunks/${index}`,
        {
          options: {
            signal: opts?.signal,
            body: blob,
            headers: {
              'Content-Type': 'application/octet-stream',
              'chunk-sha256': chunkSha256,
            },
          },
        },
      )
      return res.data!
    },

    async complete(id, opts) {
      const res = await req.patch<{ ok: true; path?: string }>(`${prefix}/${id}/complete`, {
        options: {
          signal: opts?.signal,
        },
      })
      return res.data!
    },

    async abort(id, opts) {
      await req.delete(`${prefix}/${id}`, {
        options: {
          signal: opts?.signal,
        },
      })
    },
  }
}
