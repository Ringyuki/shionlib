import { friendLinks } from '@/config/friend-links/links'
import { FriendLinkCard } from './FriendLinkCard'
import { Masonry } from '@/components/common/shared/Masonry'

export const Links = () => {
  return (
    <Masonry columnCountBreakpoints={{ default: 1, sm: 2, md: 3, lg: 4 }}>
      {friendLinks.map(link => (
        <div key={link.id} className="break-inside-avoid">
          <FriendLinkCard link={link} />
        </div>
      ))}
    </Masonry>
  )
}
