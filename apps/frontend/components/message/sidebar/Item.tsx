'use client'

import { SidebarItem } from '../constants/sidebar'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/shionui/Button'
import { useTranslations } from 'next-intl'
import { cn } from '@/utils/cn'
import { useSelectedLayoutSegment } from 'next/navigation'
import { useMemo } from 'react'

interface ItemProps {
  item: SidebarItem
}

export const Item = ({ item }: ItemProps) => {
  const t = useTranslations('Components.Message.Sidebar.Item')
  const segment = useSelectedLayoutSegment()

  const active = useMemo(() => {
    const linkSegment = item.link.replace('/message', '').replace('/', '') || null
    return segment === linkSegment
  }, [segment, item.link])
  return (
    <Link href={item.link}>
      <Button
        intent="neutral"
        appearance="ghost"
        className={cn(
          'w-full justify-start text-base font-normal',
          active && 'bg-primary/10 hover:bg-primary/10! text-primary',
        )}
        renderIcon={item.icon}
      >
        {t(item.title)}
      </Button>
    </Link>
  )
}
