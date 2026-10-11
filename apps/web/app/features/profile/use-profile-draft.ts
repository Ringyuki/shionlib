import { useEffect, useRef } from 'react'
import { useOpenState } from '~/shared/ui/use-open-state'
import type { PictureKind, Profile } from './profile'
import { draftOf, editOf, isChanged, withoutPicture, type Removable } from './profile-draft'

export function useProfileDraft(open: boolean, profile: Profile) {
  const [base] = useOpenState(open, () => profile)
  const [draft, setDraft] = useOpenState(open, () => draftOf(profile))
  const held = useRef<string[]>([])
  useEffect(
    () => () => {
      held.current.forEach(url => URL.revokeObjectURL(url))
    },
    [],
  )
  const edit = editOf(draft, base)
  return {
    base,
    draft,
    edit,
    changed: isChanged(edit),
    setBio: (bio: string) => setDraft(current => ({ ...current, bio })),
    pick: (kind: PictureKind, file: File) => {
      const url = URL.createObjectURL(file)
      held.current.push(url)
      setDraft(current => ({ ...current, [kind]: { file, url } }))
    },
    remove: (kind: Removable) => setDraft(current => withoutPicture(current, kind, base)),
  }
}

export type ProfileDraft = ReturnType<typeof useProfileDraft>
