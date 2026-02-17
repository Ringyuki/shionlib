'use client'

import { exportFile, importFile } from '@lexical/file'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { DownloadIcon, UploadIcon } from 'lucide-react'

import { Button } from '@/components/shionui/Button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shionui/Tooltip'
import { useTranslations } from 'next-intl'

export function ImportExportPlugin() {
  const t = useTranslations('Components.Editor.Actions')
  const [editor] = useLexicalComposerContext()
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            appearance={'ghost'}
            onClick={() => importFile(editor)}
            title="Import"
            aria-label="Import editor state from JSON"
            size={'sm'}
            className="p-2"
          >
            <UploadIcon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('importContent')}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            appearance={'ghost'}
            onClick={() =>
              exportFile(editor, {
                fileName: `${t('exportFilePrefix')} ${new Date().toISOString()}`,
                source: t('exportSource'),
              })
            }
            title="Export"
            aria-label="Export editor state to JSON"
            size={'sm'}
            className="p-2"
          >
            <DownloadIcon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('exportContent')}</TooltipContent>
      </Tooltip>
    </>
  )
}
