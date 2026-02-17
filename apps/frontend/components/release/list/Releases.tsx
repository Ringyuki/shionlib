import { ReleaseItem } from '@/interfaces/release/upload.interface'
import { PaginatedMeta } from '@/interfaces/api/shionlib-api-res.interface'
import { ReleaseCard } from '../ReleaseCrad'
import { Masonry } from '@/components/common/shared/Masonry'
import { Empty } from '@/components/common/content/Empty'
import { Pagination } from '@/components/common/content/Pagination'

interface ReleasesProps {
  releases: ReleaseItem[]
  meta: PaginatedMeta
}

export const Releases = ({ releases, meta }: ReleasesProps) => {
  return releases.length > 0 ? (
    <div className="flex flex-col gap-4">
      <Masonry columnCountBreakpoints={{ default: 1, sm: 2, md: 2, lg: 2 }}>
        {releases.map(release => (
          <div key={release.id} className="break-inside-avoid">
            <ReleaseCard release={release} />
          </div>
        ))}
      </Masonry>
      <Pagination className="mt-4" currentPage={meta.currentPage} totalPages={meta.totalPages} />
    </div>
  ) : (
    <Empty />
  )
}
