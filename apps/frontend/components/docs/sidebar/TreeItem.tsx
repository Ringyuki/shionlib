import { FileItem } from '@/components/shionui/animated/Files'
import { TreeNode } from '@/interfaces/contents/tree-node.interface'
import { useRouter } from '@/i18n/navigation.client'
import { useTranslations } from 'next-intl'
import { useSelectedLayoutSegment } from 'next/navigation'
import { cn } from '@/utils/cn'

interface TreeItemProps {
  item: TreeNode
}

export const TreeItem = ({ item }: TreeItemProps) => {
  const router = useRouter()
  const t = useTranslations('Docs')
  const segment = useSelectedLayoutSegment()
  const isActive = segment === item.path

  return (
    <FileItem
      className={cn('cursor-pointer', isActive && 'text-primary')}
      key={item.name}
      onClick={() => router.push(`/docs/${item.path}`)}
    >
      {t(`${item.path.replace('/', '.')}`)}
    </FileItem>
  )
}
