import { Clock } from 'lucide-react'

interface GameReleaseTimeProps {
  release_date: Date
  release_date_tba: boolean
}

export const GameReleaseTime = ({ release_date, release_date_tba }: GameReleaseTimeProps) => {
  return (
    <div className="flex gap-2 items-center text-gray-500 font-light">
      <Clock className="size-4" />
      {release_date_tba || !release_date ? (
        <span>TBA</span>
      ) : (
        <span>{new Date(release_date).toLocaleDateString()?.replace(/\//g, '-')}</span>
      )}
    </div>
  )
}
