import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { idParam } from '~/shared/route/params'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import {
  commentAnchor,
  focusKey,
  pageSize,
  searchOfFocused,
  userPageSize,
  type CommentPlace,
} from './comment'
import {
  commentEditCommand,
  commentLikeCommand,
  commentPinCommand,
  commentPostCommand,
  commentRemovalCommand,
  focusFrom,
  threadOrderFrom,
} from './comment.schema'
import {
  editComment,
  loadComments,
  loadUserComments,
  pinComment,
  postComment,
  removeComment,
  toggleLike,
} from './comment.use-cases'

export function commentsLoader(args: LoaderFunctionArgs) {
  return threadsLoader(args, { kind: 'game', id: idParam(args.params.id) })
}

export function resourceCommentsLoader(args: LoaderFunctionArgs) {
  return threadsLoader(args, { kind: 'resource', id: idParam(args.params.id) })
}

async function threadsLoader(args: LoaderFunctionArgs, place: CommentPlace) {
  const { url } = args
  const page = requestedPage(url)
  const order = threadOrderFrom(url.searchParams.get('order'))
  const focus = focusFrom(url.searchParams.get(focusKey))
  const comments = await routeLoader(args, api => loadComments(api, place, page, order, focus))
  if (focus !== undefined) {
    const search = searchOfFocused(url.search, comments.page)
    throw redirect(`${url.pathname}${search}#${commentAnchor(focus)}`)
  }
  keepWithinPages(args.url, comments.total, pageSize)
  return comments
}

export async function userCommentsLoader(args: LoaderFunctionArgs) {
  const userId = idParam(args.params.id)
  const page = requestedPage(args.url)
  const comments = await routeLoader(args, api => loadUserComments(api, userId, page))
  keepWithinPages(args.url, comments.total, userPageSize)
  return comments
}

export async function commentPostAction(args: ActionFunctionArgs) {
  const post = await readCommand(args, commentPostCommand)
  return routeAction(args, api => postComment(api, post))
}

export async function commentEditAction(args: ActionFunctionArgs) {
  const edit = await readCommand(args, commentEditCommand)
  return routeAction(args, api => editComment(api, edit))
}

export async function commentRemovalAction(args: ActionFunctionArgs) {
  const removal = await readCommand(args, commentRemovalCommand)
  return routeAction(args, api => removeComment(api, removal))
}

export async function commentLikeAction(args: ActionFunctionArgs) {
  const like = await readCommand(args, commentLikeCommand)
  return routeAction(args, api => toggleLike(api, like))
}

export async function commentPinAction(args: ActionFunctionArgs) {
  const pin = await readCommand(args, commentPinCommand)
  return routeAction(args, api => pinComment(api, pin))
}
