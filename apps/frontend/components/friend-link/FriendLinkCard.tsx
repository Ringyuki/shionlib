import { Card, CardContent } from '@/components/shionui/Card'
import { FriendLink } from '@/interfaces/friend-link/link.interface'
import { FadeImage } from '../common/shared/FadeImage'
import Link from 'next/link'

interface FriendLinkCardProps {
  link: FriendLink
}

export const FriendLinkCard = ({ link }: FriendLinkCardProps) => {
  return (
    <Card className="py-0">
      <Link
        href={link.url}
        target="_blank"
        className="hover:bg-card-hover transition-colors duration-200"
      >
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="w-12 h-12 overflow-hidden rounded-full bg-muted">
            <FadeImage src={link.logo} alt={link.name} width={48} height={48} fill={false} />
          </div>
          <h1 className="text-2xl font-semibold">{link.name}</h1>
          <p className="text-sm text-muted-foreground">{link.description}</p>
        </CardContent>
      </Link>
    </Card>
  )
}
