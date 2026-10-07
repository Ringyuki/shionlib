import { Dialog, FileUpload, IconButton } from '@hina-ui/react'
import { Play } from 'lucide-react'
import { useState } from 'react'
import { useFormatter, useTranslations } from 'use-intl'
import { useUploads } from '~/features/upload'
import { Button } from '~/shared/ui/button'
import { useAttachFiles } from '../use-attach-files'

export function Reselect({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('uploader.transfers')
  const format = useFormatter()
  const attach = useAttachFiles()
  const { uploads } = useUploads()
  const [open, setOpen] = useState(false)
  const waiting = uploads.filter(upload => upload.phase.name === 'needsFile')
  return (
    <>
      {compact ? (
        <IconButton label={t('resume')} size="sm" onClick={() => setOpen(true)}>
          <Play />
        </IconButton>
      ) : (
        <Button size="sm" variant="soft" onClick={() => setOpen(true)}>
          {t('chooseAgain')}
        </Button>
      )}
      <Dialog
        title={t('chooseAgain')}
        description={t('chooseAgainHint', {
          names: format.list(waiting.map(upload => upload.file.name)),
        })}
        open={open}
        onOpenChange={setOpen}
        renderContent={({ close }) => (
          <FileUpload
            multiple
            list={false}
            value={[]}
            onValueChange={value => {
              attach(value)
              close()
            }}
          >
            {t('chooseAgainDrop')}
          </FileUpload>
        )}
      />
    </>
  )
}
