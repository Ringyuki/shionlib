import { hasLocale } from 'next-intl'
import { routing } from '@/i18n/routing'
import { notFound } from 'next/navigation'
import { UserProfile } from '@/components/user/home/profile/UserProfile'
import { UserProfile as UserProfileType } from '@/interfaces/user/user.interface'
import { shionlibRequest } from '@/utils/request'
import { HomeTabsNav } from '@/components/user/home/HomeTabsNav'
import { createGenerateMetadata } from '@/libs/seo/metadata'
import { FavoriteSidebar } from '@/components/user/home/favorites/FavoriteSidebar'
import { Favorite } from '@/interfaces/favorite/favorite.interface'

async function getUser(id: string) {
  const data = await shionlibRequest().get<UserProfileType>(`/user/${id}`)
  return data.data
}

async function getCurrentUser() {
  const data = await shionlibRequest({ forceNotThrowError: true }).get<UserProfileType>(`/user/me`)
  return data.data
}

async function getFavorites(id: string) {
  const data = await shionlibRequest().get<Favorite[]>(`/favorites`, {
    params: {
      user_id: id,
    },
  })
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
  const [user, currentUser, favorites] = await Promise.all([
    getUser(id),
    getCurrentUser(),
    getFavorites(id),
  ])
  if (!user) {
    notFound()
  }
  return (
    <div className="my-4 w-full">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            <UserProfile user={user} />
            <FavoriteSidebar userId={id} currentUser={currentUser} favorites={favorites ?? []} />
          </div>
        </div>
        <div className="space-y-6 lg:col-span-2">
          <HomeTabsNav user={user} />
          {children}
        </div>
      </div>
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
