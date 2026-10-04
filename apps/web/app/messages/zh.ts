import auth from '~/features/auth/messages/zh.json'
import favorite from '~/features/favorite/messages/zh.json'
import game from '~/features/game/messages/zh.json'
import shell from '~/features/shell/messages/zh.json'
import site from './site/zh.json'

export const messages = { auth, favorite, game, shell, site }

export type Messages = typeof messages
