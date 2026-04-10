'use client'

import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { useSelectedLayoutSegment } from 'next/navigation'
import { cn } from '@/utils/cn'
import {
  NavBarConfig,
  NavBarAdPopoverItem,
  NavBarLinkItem,
} from '@/interfaces/site/shion-lib-site-config.interface'
import { RandomGame } from './Random'
import { useLocale } from 'next-intl'
import { SupportedLocales } from '@/config/i18n/supported'
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
} from '@/components/shionui/NavigationMenu'
import { GradientText } from '@/components/shionui/GradientText'
import { GradientIcon } from '@/components/shionui/GradientIcon'
import { NavAdContent } from './NavAdContent'
import { useShionlibUserStore } from '@/store/userStore'

interface NavProps {
  items: NavBarConfig['links']
}

export const Nav = ({ items }: NavProps) => {
  const t = useTranslations('Components.Common.TopBar.NavBar')
  const segment = useSelectedLayoutSegment()
  const locale = useLocale() as SupportedLocales
  const isSponsor = useShionlibUserStore(state => state.user.is_sponsor)

  return (
    <nav className="flex items-center gap-0.5">
      <RandomGame />
      {items.map((item, index) => {
        if (item.excludeLocales?.includes(locale)) return null
        if (item.type === 'ad-popover') {
          if (isSponsor) return null
          return <NavAdPopoverItem key={`ad-${index}`} item={item} label={t(item.label)} />
        }

        const link = item as NavBarLinkItem
        const isActive = segment === link.href.replace(/^\//, '')
        return (
          <Link
            key={link.href}
            href={link.href}
            target={link.external ? '_blank' : undefined}
            data-active={isActive ? 'true' : 'false'}
            className={cn(
              'font-normal px-4 py-2 rounded-md cursor-pointer duration-200',
              link.external ? 'hover:opacity-70' : 'hover:bg-primary/5 hover:text-primary',
              isActive && 'bg-primary/10 hover:bg-primary/10 text-primary',
            )}
          >
            <span className="flex items-center gap-1">
              {link.icon && link.icon}
              {t(link.label)}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

const NavAdPopoverItem = ({ item, label }: { item: NavBarAdPopoverItem; label: string }) => {
  return (
    <NavigationMenu viewport={false}>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger
            className={cn(
              'font-normal px-4 py-2 rounded-md cursor-pointer duration-200',
              'bg-transparent! hover:bg-transparent! hover:opacity-70 focus:bg-transparent data-[state=open]:bg-transparent',
              'h-auto text-base font-normal transition-opacity duration-200',
            )}
          >
            <span className="flex items-center gap-1">
              {item.icon &&
                (item.gradientText ? (
                  <GradientIcon
                    icon={item.icon as React.ReactElement<SVGSVGElement>}
                    gradientId={`nav-gradient-${item.adPlacement.replace(/[^a-zA-Z0-9_-]/g, '-')}`}
                  />
                ) : (
                  item.icon
                ))}
              {item.gradientText ? <GradientText text={label} /> : label}
            </span>
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavAdContent placement={item.adPlacement} />
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}
