import { PaginatedMeta } from '@/interfaces/api/shionlib-api-res.interface'
import { Developer } from '@/interfaces/developer/developer.interface'
import { DeveloperItem } from './DeveloperItem'
import { Masonry } from '@/components/common/shared/Masonry'
import { ExtraQuery, Pagination } from '@/components/common/content/Pagination'
import { Empty } from '@/components/common/content/Empty'

interface DevelopersProps {
  developers: Developer[]
  meta: PaginatedMeta
  extraQuery: ExtraQuery
}

export const Developers = ({ developers, meta, extraQuery }: DevelopersProps) => {
  return (
    <div className="flex flex-col gap-4">
      {developers.length > 0 ? (
        <>
          <Masonry columnCountBreakpoints={{ default: 1, sm: 3, md: 4, lg: 4 }}>
            {developers.map(developer => (
              <div key={developer.id} className="break-inside-avoid">
                <DeveloperItem developer={developer} />
              </div>
            ))}
          </Masonry>
          <Pagination
            currentPage={meta.currentPage}
            totalPages={meta.totalPages}
            extraQuery={extraQuery}
          />
        </>
      ) : (
        <Empty />
      )}
    </div>
  )
}
