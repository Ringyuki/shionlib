import type { Profile } from './profile'
import { removed, type ProfileEdit } from './profile.schema'

export type Picked = { file: File; url: string }

export type Draft = {
  bio: string
  avatar: Picked | undefined
  cover: Picked | null | undefined
  background: Picked | null | undefined
}

export type Removable = 'cover' | 'background'

type Base = Pick<Profile, 'bio' | 'cover' | 'background'>

export function draftOf(base: Pick<Base, 'bio'>): Draft {
  return { bio: base.bio ?? '', avatar: undefined, cover: undefined, background: undefined }
}

export function withoutPicture(draft: Draft, kind: Removable, base: Base): Draft {
  return { ...draft, [kind]: base[kind] === null ? undefined : null }
}

function pictureEdit(picked: Picked | null | undefined) {
  return picked === null ? removed : picked?.file
}

export function editOf(draft: Draft, base: Pick<Base, 'bio'>): ProfileEdit {
  return {
    bio: draft.bio.trim() === (base.bio ?? '').trim() ? undefined : draft.bio,
    avatar: draft.avatar?.file,
    cover: pictureEdit(draft.cover),
    background: pictureEdit(draft.background),
  }
}

export function isChanged(edit: ProfileEdit): boolean {
  return Object.values(edit).some(value => value !== undefined)
}

export function shownPicture(
  picked: Picked | null | undefined,
  current: string | null,
): string | undefined {
  return picked === null ? undefined : (picked?.url ?? current ?? undefined)
}
