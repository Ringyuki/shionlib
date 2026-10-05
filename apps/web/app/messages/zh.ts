import auth from '~/features/auth/messages/zh.json'
import download from '~/features/download/messages/zh.json'
import favorite from '~/features/favorite/messages/zh.json'
import game from '~/features/game/messages/zh.json'
import resource from '~/features/resource/messages/zh.json'
import search from '~/features/search/messages/zh.json'
import shell from '~/features/shell/messages/zh.json'
import bbcode from './bbcode/zh.json'
import form from './form/zh.json'
import site from './site/zh.json'

export const messages = {
  auth,
  bbcode,
  download,
  favorite,
  form,
  game,
  resource,
  search,
  shell,
  site,
}

export type Messages = typeof messages
