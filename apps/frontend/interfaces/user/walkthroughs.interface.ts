import { GameData } from '@/interfaces/game/game.interface'
import { WalkthroughListItem } from '@/interfaces/walkthrough/walkthrough.interface'

export interface UserWalkthroughItem extends WalkthroughListItem {
  game: Pick<
    GameData,
    'id' | 'title_jp' | 'title_zh' | 'title_en' | 'intro_jp' | 'intro_zh' | 'intro_en' | 'covers'
  >
}
