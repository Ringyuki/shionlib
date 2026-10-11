import { Disc, File, FileArchive, FileText, Folder, FolderOpen, Image, Music } from 'lucide-react'
import type { Listed } from '../inspection'

const className = 'text-muted size-4 shrink-0'

export function EntryIcon({ entry, open }: { entry: Listed; open: boolean }) {
  const props = { className, 'aria-hidden': true } as const
  switch (entry.kind) {
    case 'folder':
      return open ? <FolderOpen {...props} /> : <Folder {...props} />
    case 'archive':
      return <FileArchive {...props} />
    case 'disc':
      return <Disc {...props} />
    case 'track':
      return <Music {...props} />
    default:
      break
  }
  if (entry.preview === 'text') {
    return <FileText {...props} />
  }
  return entry.preview === 'image' ? <Image {...props} /> : <File {...props} />
}
