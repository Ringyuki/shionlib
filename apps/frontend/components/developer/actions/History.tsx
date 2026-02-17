'use client'

import { History as HistoryIcon } from 'lucide-react'
import { Button } from '@/components/shionui/Button'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { shionlibRequest } from '@/utils/request'
import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import { EditRecordItem } from '@/interfaces/user/edits.interface'
import { HistoryContent } from '@/components/game/edit-history/HistoryContent'
import { PaginatedMeta } from '@/interfaces/api/shionlib-api-res.interface'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'

interface HistoryProps {
  developer_id: number
}

const getHistories = async (developer_id: number, page: number = 1) => {
  const response = await shionlibRequest().get<PaginatedResponse<EditRecordItem>>(
    `/edit/developer/${developer_id}/history`,
    {
      params: {
        page,
      },
    },
  )
  return response.data
}

export const History = ({ developer_id }: HistoryProps) => {
  const t = useTranslations('Components.Developer.Actions.history')

  const [loading, setLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [histories, setHistories] = useState<EditRecordItem[]>([])
  const [pagination, setPagination] = useState<PaginatedMeta>({
    totalItems: 0,
    itemCount: 0,
    itemsPerPage: 0,
    totalPages: 0,
    currentPage: 1,
  })

  const getData = async (page?: number, open?: boolean) => {
    try {
      setLoading(true)
      const res = await getHistories(developer_id, page)
      if (!res?.items.length) {
        // toast.error(t('noHistory'))
        sileo.error({ title: t('noHistory') })
        return
      }
      setHistories(res.items)
      setPagination(res.meta)
      if (open) setHistoryOpen(true)
    } catch {
    } finally {
      setLoading(false)
    }
  }
  const handleOpen = async () => {
    await getData(1, true)
  }

  const handlePageChange = async (page: number) => {
    await getData(page)
  }
  return (
    <>
      <Button
        intent="secondary"
        appearance="outline"
        renderIcon={<HistoryIcon className="size-4" />}
        onClick={handleOpen}
        loading={loading}
      >
        {t('history')}
      </Button>

      <HistoryContent
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        histories={histories}
        pagination={pagination}
        onPageChange={handlePageChange}
        loading={loading}
      />
    </>
  )
}
