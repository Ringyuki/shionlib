import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/shionui/Drawer'
import { useTranslations } from 'next-intl'
import { History } from './History'
import { EditRecordItem as EditRecordItemInterface } from '@/interfaces/user/edits.interface'
import { PaginatedMeta } from '@/interfaces/api/shionlib-api-res.interface'

interface HistoryDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  histories: EditRecordItemInterface[]
  pagination: PaginatedMeta
  onPageChange: (page: number) => void
  loading?: boolean
}

export const HistoryDrawer = ({
  open,
  onOpenChange,
  histories,
  pagination,
  onPageChange,
  loading = false,
}: HistoryDrawerProps) => {
  const t = useTranslations('Components.Game.EditHistory')
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('title')}</DrawerTitle>
        </DrawerHeader>
        <div className="pb-4 overflow-y-auto">
          <History
            histories={histories}
            pagination={pagination}
            onPageChange={onPageChange}
            className="max-w-7xl px-3 mx-auto"
            loading={loading}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
