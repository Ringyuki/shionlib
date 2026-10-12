import { Stack } from '@hina-ui/react'
import {
  ArrowLeft,
  BookOpen,
  FileCheck,
  Flag,
  Gamepad2,
  House,
  MessageCircle,
  RefreshCw,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'use-intl'
import { SidebarGroup, SidebarLink, sitePath } from '~/features/shell'
import { navigationOf, type NavEntry, type NavKey } from '../admin'
import { usePending } from '../use-admin-area'

const icons: Record<NavKey, LucideIcon> = {
  overview: House,
  reports: Flag,
  checks: FileCheck,
  comments: MessageCircle,
  walkthroughs: BookOpen,
  games: Gamepad2,
  users: Users,
  catalog: RefreshCw,
  ai: Sparkles,
  settings: Settings,
}

type AdminNavigationProps = {
  rail: boolean
}

export function AdminNavigation({ rail }: AdminNavigationProps) {
  const t = useTranslations('admin')
  const pending = usePending()
  const navigation = pending === undefined ? undefined : navigationOf(pending)
  const link = (entry: NavEntry) => (
    <SidebarLink
      key={entry.key}
      icon={icons[entry.key]}
      label={t(`nav.${entry.key}`)}
      to={entry.to}
      rail={rail}
      end={entry.end}
      count={entry.count}
      countLabel={t('pendingCount', { count: entry.count })}
      alert={entry.alert ? t('aiAlert') : undefined}
    />
  )
  return (
    <>
      <Stack gap="xs">
        <SidebarLink icon={ArrowLeft} label={t('back')} to={sitePath} rail={rail} end />
        {navigation?.lead.map(link)}
      </Stack>
      {navigation?.groups.map(group => (
        <SidebarGroup key={group.key} label={t(`group.${group.key}`)} rail={rail}>
          {group.entries.map(link)}
        </SidebarGroup>
      ))}
    </>
  )
}
