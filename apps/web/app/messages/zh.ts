import favorite from '~/features/favorite/messages/zh.json'
import game from '~/features/game/messages/zh.json'
import viewer from '~/features/viewer/messages/zh.json'
import site from './site/zh.json'

export const messages = { favorite, game, site, viewer }

export type Messages = typeof messages
