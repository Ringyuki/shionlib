import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { shionlibRequest } from '@/utils/request'
import { useRouter } from '@/i18n/navigation.client'
import { Button } from '@/components/shionui/Button'
import { CheckCheck } from 'lucide-react'

export const ReadAll = () => {
  const t = useTranslations('Components.Message.Message.ReadAll')
  const router = useRouter()
  const [marking, setMarking] = useState<'read' | 'unread' | null>(null)

  const handleMarkAll = async (status: 'read' | 'unread') => {
    try {
      setMarking(status)
      await shionlibRequest().post(`/message/all/${status}`)
      router.refresh()
    } catch {
    } finally {
      setMarking(null)
    }
  }

  return (
    <div className="flex items-center justify-end gap-2 mr-1 my-1">
      <Button
        size="sm"
        appearance="soft"
        intent="warning"
        onClick={() => handleMarkAll('read')}
        loading={marking === 'read'}
        renderIcon={<CheckCheck />}
      >
        {t('markAllRead')}
      </Button>
    </div>
  )
}
