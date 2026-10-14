import type { ApiClient } from '~/shared/api/client'
import { fileBody } from '~/shared/api/file-body'
import type { Link } from './admin-friend-link'
import type { LinkChange } from './admin-friend-link.schema'

export type Listing = {
  links: Link[]
}

export async function loadLinks(api: ApiClient): Promise<Listing> {
  return { links: (await api.get('/admin/friend-links')) ?? [] }
}

export async function changeLink(api: ApiClient, change: LinkChange): Promise<null> {
  switch (change.action) {
    case 'create': {
      const { name, url, description, visible, logo } = change
      await api.post('/admin/friend-links', {
        body: { name, url, description, visible, ...(logo === null ? {} : { logo }) },
      })
      return null
    }
    case 'update': {
      const { id, name, url, description, visible, logo } = change
      await api.patch('/admin/friend-links/{id}', {
        params: { path: { id } },
        body: { name, url, description, visible, logo },
      })
      return null
    }
    case 'visible':
      await api.patch('/admin/friend-links/{id}', {
        params: { path: { id: change.id } },
        body: { visible: change.visible },
      })
      return null
    case 'remove':
      await api.delete('/admin/friend-links/{id}', { params: { path: { id: change.id } } })
      return null
    case 'reorder':
      await api.put('/admin/friend-links/order', { body: { ids: change.ids } })
      return null
  }
}

export async function uploadLogo(api: ApiClient, logo: File): Promise<string> {
  const uploaded = await api.put('/uploads/small/friend-link/logo', fileBody('file', logo))
  return uploaded.key
}
