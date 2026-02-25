import { GameHeader } from '@/interfaces/game/game.interface'
import { User } from '@/interfaces/user/user.interface'
import { SerializedEditorState } from 'lexical'

export enum WalkthroughStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  HIDDEN = 'HIDDEN',
  DELETED = 'DELETED',
}

export interface Walkthrough {
  id: number
  game: Pick<GameHeader, 'id' | 'title_jp' | 'title_zh' | 'title_en'>
  title: string
  html: string
  content?: SerializedEditorState
  created: Date
  updated: Date
  edited: boolean
  status: WalkthroughStatus
  creator: Pick<User, 'id' | 'name' | 'avatar'>
}

export interface WalkthroughListItem extends Omit<Walkthrough, 'html' | 'content' | 'game'> {}
