import { Tag } from '@hina-ui/react'
import type { GameHeader } from '../game'
import { PlatformTag } from './platform-tag'

export function GameChips({ game }: { game: GameHeader }) {
  return (
    <>
      {(game.platform ?? []).map(platform => (
        <PlatformTag key={platform} platform={platform} />
      ))}
      {game.type !== null && game.type !== '' && (
        <Tag size="sm" variant="outline">
          {game.type}
        </Tag>
      )}
    </>
  )
}
