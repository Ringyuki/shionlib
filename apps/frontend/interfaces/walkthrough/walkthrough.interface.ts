import { GameHeader, Language } from '@/interfaces/game/game.interface'
import { User } from '@/interfaces/user/user.interface'
import { SerializedEditorState } from 'lexical'

export enum WalkthroughStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  HIDDEN = 'HIDDEN',
  DELETED = 'DELETED',
}

export type WalkthroughLang = Extract<Language, 'en' | 'zh' | 'zh-hant' | 'jp'>

export interface Walkthrough {
  id: number
  game: Pick<GameHeader, 'id' | 'title_jp' | 'title_zh' | 'title_en'>
  title: string
  html: string
  lang?: WalkthroughLang | null
  content?: SerializedEditorState
  created: Date
  updated: Date
  edited: boolean
  status: WalkthroughStatus
  creator: Pick<User, 'id' | 'name' | 'avatar'>
}

export interface WalkthroughListItem extends Omit<Walkthrough, 'html' | 'content' | 'game'> {}
