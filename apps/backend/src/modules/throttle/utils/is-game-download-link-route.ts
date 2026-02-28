type RequestLike = {
  method?: string
  path?: string
}

const GAME_DOWNLOAD_LINK_PATH_REGEX = /^\/game\/download\/\d+\/link\/?$/

export const isGameDownloadLinkRoute = (req?: RequestLike) => {
  if (!req?.path || req.method !== 'GET') return false
  return GAME_DOWNLOAD_LINK_PATH_REGEX.test(req.path)
}
