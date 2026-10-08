import { DataList, Empty } from '@hina-ui/react'
import { Upload as UploadIcon } from 'lucide-react'
import { Link } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { sitePaths } from '~/features/shell'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { Button } from '~/shared/ui/button'
import { uploadsPageSize, type Uploads } from '../profile'
import { UploadCard } from './upload-card'

type UploadListProps = {
  uploads: Uploads
  own: boolean
}

export function UploadList({ uploads, own }: UploadListProps) {
  const t = useTranslations('profile.uploads')
  const locale = useLocale()
  const pages = usePageTurn()
  return (
    <DataList
      label={t('label')}
      items={uploads.items}
      itemKey="id"
      layout="grid"
      gridMin="22rem"
      gridGap="md"
      manual
      pagination
      total={uploads.total}
      page={uploads.page}
      pageSize={uploadsPageSize}
      onPageChange={pages.turnTo}
      loading={pages.turning}
      renderEmpty={() => (
        <Empty
          title={t(own ? 'emptyOwn' : 'empty')}
          actions={
            own && (
              <Button asChild>
                <Link to={sitePaths(locale).upload}>
                  <UploadIcon aria-hidden />
                  {t('upload')}
                </Link>
              </Button>
            )
          }
        />
      )}
    >
      {({ item }) => <UploadCard upload={item} />}
    </DataList>
  )
}
