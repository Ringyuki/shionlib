import type { ReactNode } from 'react'
import type { Profile } from '../profile'
import { ProfileHeader } from './profile-header'
import { ProfileTabs } from './profile-tabs'

type ProfilePageProps = {
  profile: Profile
  own: boolean
  children: ReactNode
}

export function ProfilePage({ profile, own, children }: ProfilePageProps) {
  return (
    <ProfileTabs profile={profile} header={<ProfileHeader profile={profile} own={own} />}>
      {children}
    </ProfileTabs>
  )
}
