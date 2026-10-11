import { DataList, Empty } from '@hina-ui/react'
import { Upload as UploadIcon } from 'lucide-react'
import { Link } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { sitePaths } from '~/features/shell'
import { listStart } from '~/shared/http/paging'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { Button } from '~/shared/ui/button'
import { entryList } from '~/shared/ui/entry-link'
import { uploadsPageSize, type Uploads } from '../profile'
import { UploadRow } from './upload-row'

export function UploadList({ uploads }: { uploads: Uploads }) {
  const t = useTranslations('profile.uploads')
  const locale = useLocale()
  const pages = usePageTurn()
  return (
    <DataList
      label={t('label')}
      id={listStart}
      className={entryList.frame}
      items={uploads.items}
      itemKey="id"
      divided={false}
      itemClass={entryList.item}
      minHeight={0}
      manual
      pagination
      total={uploads.total}
      page={uploads.page}
      pageSize={uploadsPageSize}
      onPageChange={pages.turnTo}
      loading={pages.turning}
      renderEmpty={() => (
        <Empty
          title={t(uploads.own ? 'emptyOwn' : 'empty')}
          size="sm"
          actions={
            uploads.own && (
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
      {({ item }) => <UploadRow upload={item} />}
    </DataList>
  )
}
