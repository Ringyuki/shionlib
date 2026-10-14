import type { Schema } from '~/shared/api/types'

export type Link = Schema<'FriendLinkAdminDTO'>

export type LinkValues = {
  name: string
  url: string
  description: string
  logo: string | null
  visible: boolean
}

export const blankLink: LinkValues = {
  name: '',
  url: '',
  description: '',
  logo: null,
  visible: true,
}

export function valuesOf(link: Link): LinkValues {
  return {
    name: link.name,
    url: link.url,
    description: link.description,
    logo: link.logo,
    visible: link.visible,
  }
}

export function inOrder(links: Link[], ids: number[]): Link[] {
  if (ids.length !== links.length) {
    return links
  }
  return ids.flatMap(id => links.filter(link => link.id === id))
}
