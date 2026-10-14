import { createTranslator } from 'use-intl/core'
import { clipped, shareImage, type HeadTexts, type PageHead } from '~/shared/seo/seo'
import { profilePath, type Profile, type ProfileTab } from './profile'

export function profileHead(
  profile: Profile,
  texts: HeadTexts,
  tab: ProfileTab = 'uploads',
): PageHead {
  const { locale, messages } = texts
  const t = createTranslator({ locale, messages, namespace: 'profile.seo' })
  const bio = profile.bio?.trim() ?? ''
  const lead = t('lead', { name: profile.name, count: profile.resource_count })
  return {
    title: tab === 'uploads' ? profile.name : `${profile.name} ${messages.profile.tabs[tab]}`,
    description: clipped(bio === '' ? lead : `${lead}${bio}`),
    image: shareImage(`/user/${profile.id}`, profile.name),
    kind: 'profile',
    indexable: tab === 'uploads',
    structured: at => [
      {
        '@type': 'ProfilePage',
        dateCreated: profile.created,
        mainEntity: {
          '@type': 'Person',
          name: profile.name,
          url: at(profilePath(locale, profile.id)),
          ...(bio === '' ? {} : { description: bio }),
        },
      },
    ],
  }
}
