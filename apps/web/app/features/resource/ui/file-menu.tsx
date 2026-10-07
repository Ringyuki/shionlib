import { DropdownMenu } from '@hina-ui/react'
import { Ellipsis } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import type { ResourceFile } from '../resource'
import { FileDialogs, type FileDialog } from './file-dialogs'
import { FileItems } from './file-items'

export function FileMenu({ file, removable }: { file: ResourceFile; removable: boolean }) {
  const t = useTranslations('resource')
  const [opened, setOpened] = useState<FileDialog | undefined>(undefined)
  return (
    <>
      <DropdownMenu
        label={t('fileActions')}
        align="end"
        content={<FileItems file={file} removable={removable} onPick={setOpened} />}
      >
        <Button
          variant="ghost"
          tone="neutral"
          size="sm"
          iconOnly
          aria-label={t('fileActions')}
          icon={<Ellipsis />}
        />
      </DropdownMenu>
      <FileDialogs file={file} opened={opened} onOpenedChange={setOpened} />
    </>
  )
}
