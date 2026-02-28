import { hasLocale } from 'next-intl'
import { routing } from '@/i18n/routing'
import { notFound } from 'next/navigation'
import { UserProfile as UserProfileType } from '@/interfaces/user/user.interface'
import { shionlibRequest } from '@/utils/request'
import { HomeTabsNav } from '@/components/user/home/HomeTabsNav'
import { createGenerateMetadata } from '@/libs/seo/metadata'
import { ProfileBanner } from '@/components/user/home/profile/ProfileBanner'

async function getUser(id: string) {
  const data = await shionlibRequest().get<UserProfileType>(`/user/${id}`)
  return data.data
}

interface UserLayoutProps {
  children: React.ReactNode
  params: Promise<{
    locale: string
    id: string
  }>
}

export default async function UserLayout({ children, params }: Readonly<UserLayoutProps>) {
  const { locale, id } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  const user = await getUser(id)
  if (!user) {
    notFound()
  }
  return (
    <div className="my-4 w-full flex flex-col gap-6">
      <ProfileBanner user={user} />
      <HomeTabsNav user={user} />
      {children}
    </div>
  )
}

export const generateMetadata = createGenerateMetadata(async ({ id }: { id: string }) => {
  const user = await getUser(id)
  return {
    title: user!.name,
    path: `/user/${id}`,
    robots: {
      index: false,
      follow: false,
    },
  }
})
