import {
  Files,
  FolderItem,
  FolderTrigger,
  FolderPanel,
  SubFiles,
} from '@/components/shionui/animated/Files'
import { TreeNode } from '@/interfaces/contents/tree-node.interface'
import { useTranslations } from 'next-intl'
import { TreeItem } from './TreeItem'

interface DocsDirectoryProps {
  tree: TreeNode
}

export const DocsDirectory = ({ tree }: DocsDirectoryProps) => {
  const t = useTranslations('Docs.categories')
  const allFolderNames =
    tree.children?.filter(child => child.type === 'directory').map(child => child.name) ?? []
  return (
    <Files defaultOpen={allFolderNames}>
      {tree.children?.map(child => {
        if (child.type === 'directory') {
          return (
            <FolderItem key={child.name} value={child.name}>
              <FolderTrigger>{t(child.name)}</FolderTrigger>
              <FolderPanel>
                <SubFiles>
                  {child.children?.map(child => (
                    <TreeItem key={child.name} item={child} />
                  ))}
                </SubFiles>
              </FolderPanel>
            </FolderItem>
          )
        } else {
          return <TreeItem key={child.name} item={child} />
        }
      })}
    </Files>
  )
}
