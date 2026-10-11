import { cn, Divider, Empty, Stack } from '@hina-ui/react'
import { useState, type ReactNode } from 'react'
import { useTranslations } from 'use-intl'
import type { Viewer } from '~/features/viewer'
import { frosted, PageBackdrop } from '~/shared/ui/backdrop'
import { backgroundFor, type Profile } from '../profile'
import { useProfileTabs } from '../use-profile-tabs'
import { EditProfileDialog } from './edit-profile-dialog'
import { ProfileHead } from './profile-head'
import { ProfileTabs } from './profile-tabs'

type ProfilePageProps = {
  profile: Profile
  viewer: Viewer | null
  children: ReactNode
}

export function ProfilePage({ profile, viewer, children }: ProfilePageProps) {
  const t = useTranslations('profile')
  const own = viewer?.id === profile.id
  const background = backgroundFor(profile, viewer)
  const tabs = useProfileTabs(profile, own)
  const [editing, setEditing] = useState(false)
  return (
    <>
      {background !== null && <PageBackdrop src={background} />}
      <Stack
        as="article"
        gap="none"
        aria-label={profile.name}
        className={cn(
          '-mx-4 overflow-hidden sm:-mx-6',
          'md:mx-auto md:w-full md:max-w-230 md:rounded-lg',
          background !== null && frosted,
        )}
      >
        <ProfileHead profile={profile} onEdit={own ? () => setEditing(true) : undefined} />
        {tabs.shown.length === 0 ? (
          <>
            <Divider className="mt-5" />
            <Empty title={t('nothing')} size="sm" className="py-10" />
          </>
        ) : (
          <ProfileTabs profile={profile} own={own} tabs={tabs}>
            {children}
          </ProfileTabs>
        )}
      </Stack>
      {own && <EditProfileDialog profile={profile} open={editing} onOpenChange={setEditing} />}
    </>
  )
}
