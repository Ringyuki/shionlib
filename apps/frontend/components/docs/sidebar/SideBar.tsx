'use client'

import { DocsDirectory } from './Directory'
import { TreeNode } from '@/interfaces/contents/tree-node.interface'
import { FolderIcon } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

interface DocsSideBarProps {
  tree: TreeNode
}

export const DocsSideBar = ({ tree }: DocsSideBarProps) => {
  const t = useTranslations('Components.Docs.SideBar')
  return (
    <div className="w-64 flex flex-col gap-2 sticky md:top-24 top-18">
      <Link
        href="/docs"
        className="flex items-center gap-2 font-semibold hover:opacity-80 transition-opacity"
      >
        <FolderIcon className="size-4.5" />
        <span className="text-sm">{t('title')}</span>
      </Link>
      <DocsDirectory tree={tree} />
    </div>
  )
}
