'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  Users,
  ChevronLeft,
  MessageSquare,
  ShieldAlert,
  Biohazard,
  Gamepad2,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/shionui/Sidebar'

interface SidebarItem {
  key: string
  icon: React.ElementType
  href: string
}

const sidebarItems: SidebarItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, href: '/admin' },
  { key: 'users', icon: Users, href: '/admin/users' },
  { key: 'games', icon: Gamepad2, href: '/admin/games' },
  { key: 'comments', icon: MessageSquare, href: '/admin/comments' },
  { key: 'reports', icon: ShieldAlert, href: '/admin/reports' },
  { key: 'malwareScans', icon: Biohazard, href: '/admin/malware-scans' },
  // { key: 'characters', icon: Users, href: '/admin/characters' },
  // { key: 'developers', icon: Building2, href: '/admin/developers' },
  // { key: 'settings', icon: Settings, href: '/admin/settings' },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('Admin.Sidebar')

  const isActive = (href: string) => {
    const fullPath = `/${locale}${href}`
    if (href === '/admin') {
      return pathname === fullPath
    }
    return pathname.startsWith(fullPath)
  }

  return (
    <Sidebar collapsible="icon" className="border-r-0 z-1">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {sidebarItems.map(item => {
                const Icon = item.icon
                const active = isActive(item.href)

                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton asChild isActive={active} tooltip={t(item.key)}>
                      <Link href={`/${locale}${item.href}`}>
                        <Icon />
                        <span>{t(item.key)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-gray-200 dark:border-gray-800">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t('backToSite')}>
              <Link href={`/${locale}`}>
                <ChevronLeft />
                <span>{t('backToSite')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
