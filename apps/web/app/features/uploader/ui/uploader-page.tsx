import { Grid, PageHeader, Result, Stack } from '@hina-ui/react'
import { Upload } from 'lucide-react'
import { Link } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import type { ResourceViewer } from '~/features/resource'
import { sitePaths } from '~/features/shell'
import { Button } from '~/shared/ui/button'
import type { UploaderContent } from '../uploader'
import { useLiveRefresh } from '../use-live-refresh'
import { useTransfers } from '../use-transfers'
import { Account } from './account'
import { UploadList } from './upload-list'

type UploaderPageProps = {
  content: UploaderContent | null
  viewer: ResourceViewer | null
}

export function UploaderPage({ content, viewer }: UploaderPageProps) {
  const t = useTranslations('uploader')
  const locale = useLocale()
  return (
    <Stack gap="lg">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          content !== null && (
            <Button asChild>
              <Link to={sitePaths(locale).upload}>
                <Upload aria-hidden />
                {t('upload')}
              </Link>
            </Button>
          )
        }
      />
      {content === null ? (
        <Result
          status="info"
          title={t('signIn')}
          actions={<Button loginRequired>{t('signInAction')}</Button>}
        />
      ) : (
        <Workspace content={content} viewer={viewer} />
      )}
    </Stack>
  )
}

function Workspace({
  content,
  viewer,
}: {
  content: UploaderContent
  viewer: ResourceViewer | null
}) {
  const transfers = useTransfers(content)
  const { allowance, summary } = content
  useLiveRefresh(summary.processing > 0)
  return (
    <Grid className="items-start gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <UploadList content={content} transfers={transfers} viewer={viewer} />
      <Account allowance={allowance} summary={summary} className="xl:sticky xl:top-6" />
    </Grid>
  )
}
