import { Bell } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { sidebarItems } from '../constants/sidebar'
import { Card, CardContent } from '@/components/shionui/Card'
import { Item } from './Item'

export const Sidebar = () => {
  const t = useTranslations('Components.Message.Sidebar.Sidebar')
  return (
    <div className="w-full md:w-64 shrink-0 h-fit md:sticky top-18 md:top-24">
      <h1 className="text-2xl flex items-center gap-2">
        <Bell className="size-4.5" />
        {t('title')}
      </h1>
      <Card className="mt-4 py-0">
        <CardContent className="p-2">
          <div className="flex flex-col gap-2">
            {sidebarItems.map(item => (
              <Item key={item.id} item={item} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
