'use client'

import * as React from 'react'
import { useRouter, usePathname } from '@/i18n/navigation.client'
import { cn } from '@/utils/cn'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/shionui/Popover'
import { SiteLogo } from '@/components/common/top-bar/SiteLogo'
import { useTranslations } from 'next-intl'
import { useWindowSize } from 'react-use'
import { useEffect } from 'react'
import { NavBarConfig } from '@/interfaces/site/shion-lib-site-config.interface'

interface MobileNavProps {
  items: NavBarConfig['links']
}

export const MobileNav = ({ items }: MobileNavProps) => {
  const [open, setOpen] = React.useState(false)
  const t = useTranslations('Components.Common.TopBar.NavBar')
  const { width } = useWindowSize()
  const pathname = usePathname()

  useEffect(() => {
    const body = document.body
    setOpen(false)
    body.removeAttribute('data-scroll-locked')
    body.style.removeProperty('--removed-body-scroll-bar-size')
    body.style.removeProperty('overflow')
  }, [width])
  useEffect(() => {
    handleOpenChange(false)
  }, [pathname])

  const handleOpenChange = (open: boolean) => {
    setOpen(open)
    const body = document.body
    if (open) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      body.setAttribute('data-scroll-locked', 'true')
      body.style.setProperty('--removed-body-scroll-bar-size', `${scrollbarWidth}px`)
      body.style.setProperty('overflow', 'hidden')
    } else {
      body.removeAttribute('data-scroll-locked')
      body.style.removeProperty('--removed-body-scroll-bar-size')
      body.style.removeProperty('overflow')
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div className="items-center cursor-pointer text-foreground" onClick={() => setOpen(!open)}>
          <div className="relative flex h-8 w-4 items-center justify-center">
            <div className="relative size-4">
              <span
                className={cn(
                  'bg-foreground absolute left-0 block h-0.5 w-4 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                  open ? 'top-[0.4rem] -rotate-45' : 'top-1',
                )}
              />
              <span
                className={cn(
                  'bg-foreground absolute left-0 block h-0.5 w-4 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                  open ? 'top-[0.4rem] rotate-45' : 'top-2.5',
                )}
              />
            </div>
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          'no-scrollbar h-(--radix-popper-available-height) w-(--radix-popper-available-width) overflow-y-auto rounded-none border-none p-0 shadow-none',
          'dark:bg-[rgba(0,0,0,0.5)] bg-[rgba(255,255,255,0.7)] backdrop-blur-xl backdrop-saturate-[3.5]',
          'will-change-[transform,opacity] origin-top',
          'data-[state=open]:animate-mobile-nav-in data-[state=closed]:animate-mobile-nav-out',
        )}
        align="start"
        side="bottom"
        alignOffset={-16}
        sideOffset={14}
      >
        <div className="flex flex-col gap-12 overflow-auto px-6 py-6">
          <div className="flex flex-col gap-4">
            <div
              className={cn(
                'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
                open ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2',
              )}
              style={{ transitionDelay: open ? '100ms' : '0ms' }}
            >
              <SiteLogo size="2xl" />
            </div>
            <div
              className={cn(
                'text-muted-foreground text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
                open ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2',
              )}
              style={{ transitionDelay: open ? '150ms' : '0ms' }}
            >
              {t('menu')}
            </div>
            <div className="flex flex-col gap-3">
              <NavItem href="/" label={t('home')} />
              {items.map((item, index) => (
                <NavItem key={index} href={item.href} label={t(item.label)} />
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface NavItemProps {
  href: string
  label: string
}

const NavItem = ({ href, label }: NavItemProps) => {
  const router = useRouter()
  return (
    <div
      onClick={() => {
        router.push(href.toString())
      }}
      className={cn('text-xl font-medium cursor-pointer')}
    >
      {label}
    </div>
  )
}
