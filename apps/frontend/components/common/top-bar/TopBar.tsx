'use client'

import ThemeSwitcher from '@/components/common/top-bar/ThemeSwitcher'
import { TopBarAvatar } from '@/components/common/top-bar/Avatar'
import { useShionlibUserStore } from '@/store/userStore'
import { useAuthDialogStore } from '@/store/authDialogStore'
import { useState, useEffect } from 'react'
import { Button } from '@/components/shionui/Button'
import { useTranslations } from 'next-intl'
import { Skeleton } from '@/components/shionui/Skeleton'
import { SiteLogo } from '@/components/common/top-bar/SiteLogo'
import { Nav } from '@/components/common/top-bar/Nav'
import { MobileNav } from '@/components/common/top-bar/MobileNav'
import { navBarConfig } from '@/config/site/shionlib'
import { SearchTrigger } from '@/components/common/top-bar/SearchTrigger'
import { Message } from '@/components/common/top-bar/Message'
import { RandomGame } from '@/components/common/top-bar/Random'

const StartContent = () => {
  return (
    <>
      <div className="hidden topbar:flex items-center gap-8">
        <SiteLogo />
        <Nav items={navBarConfig.links} />
      </div>
      <div className="block topbar:hidden items-center gap-8">
        <MobileNav items={navBarConfig.links} />
      </div>
    </>
  )
}

const EndContent = () => {
  const { user } = useShionlibUserStore()
  const isLoggedIn = !!user?.id
  const t = useTranslations('Components.Common.User.LoginOrRegisteDialog')
  const { openAuthDialog } = useAuthDialogStore()

  const [isLoading, setIsLoading] = useState(true)
  useEffect(() => {
    setIsLoading(false)
  }, [user])

  return (
    <div className="max-h-full flex items-center gap-2">
      <RandomGame className="flex topbar:hidden" />
      <SearchTrigger />
      <ThemeSwitcher />
      {isLoading ? (
        <Skeleton className="w-[60px] h-[28px] rounded-md" />
      ) : isLoggedIn ? (
        <>
          <Message />
          <TopBarAvatar user={user} className="cursor-pointer" />
        </>
      ) : (
        <Button size="sm" onClick={() => openAuthDialog('login')}>
          {t('button')}
        </Button>
      )}
    </div>
  )
}

const ShionlibTopBar = () => {
  return (
    <div className="fixed inset-x-0 top-0 topbar:top-4 z-50 [body[data-scroll-locked]_&]:pr-[var(--removed-body-scroll-bar-size,0px)]">
      <div
        className="
        mx-auto w-full max-w-7xl px-6 h-16
        topbar:rounded-xl flex items-center justify-between
        dark:bg-[rgba(0,0,0,0.5)] bg-[rgba(255,255,255,0.7)] backdrop-blur-xl backdrop-saturate-[3.5]
      "
      >
        <StartContent />
        <EndContent />
      </div>
    </div>
  )
}
export default ShionlibTopBar
