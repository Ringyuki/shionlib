import { Header } from '@/components/friend-link/Header'
import { createGenerateMetadata } from '@/libs/seo/metadata'
import { getTranslations } from 'next-intl/server'
import { Links } from '@/components/friend-link/Links'

export default function FriendLinkPage() {
  return (
    <div className="container mx-auto my-4">
      <Header />
      <Links />
    </div>
  )
}

export const generateMetadata = createGenerateMetadata(async () => {
  const t = await getTranslations('Components.FriendLink.Head')
  return {
    title: t('title'),
    description: t('description'),
    path: '/friend-link',
  }
})
