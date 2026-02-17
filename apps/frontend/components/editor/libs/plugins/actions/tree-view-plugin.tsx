'use client'

import { JSX } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { TreeView } from '@lexical/react/LexicalTreeView'
import { NotebookPenIcon } from 'lucide-react'

import { Button } from '@/components/shionui/Button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/shionui/Dialog'
import { ScrollArea, ScrollBar } from '@/components/shionui/ScrollArea'
import { useTranslations } from 'next-intl'

export function TreeViewPlugin(): JSX.Element {
  const t = useTranslations('Components.Editor.Actions')
  const [editor] = useLexicalComposerContext()
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size={'sm'} appearance={'ghost'} className="p-2">
          <NotebookPenIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('treeView')}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="bg-card-soft border border-card-border text-foreground h-96 overflow-hidden rounded-lg p-2">
          <TreeView
            viewClassName="tree-view-output"
            treeTypeButtonClassName="debug-treetype-button"
            timeTravelPanelClassName="debug-timetravel-panel"
            timeTravelButtonClassName="debug-timetravel-button"
            timeTravelPanelSliderClassName="debug-timetravel-panel-slider"
            timeTravelPanelButtonClassName="debug-timetravel-panel-button"
            editor={editor}
          />
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
