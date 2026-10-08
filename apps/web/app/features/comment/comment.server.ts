import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { idParam } from '~/shared/route/params'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import { pageSize, userPageSize } from './comment'
import {
  commentEditCommand,
  commentLikeCommand,
  commentPostCommand,
  commentRemovalCommand,
  threadOrderFrom,
} from './comment.schema'
import {
  editComment,
  loadComments,
  loadUserComments,
  postComment,
  removeComment,
  toggleLike,
} from './comment.use-cases'

export async function commentsLoader(args: LoaderFunctionArgs) {
  const gameId = idParam(args.params.id)
  const page = requestedPage(args.request)
  const order = threadOrderFrom(new URL(args.request.url).searchParams.get('order'))
  const comments = await routeLoader(args, api => loadComments(api, gameId, page, order))
  keepWithinPages(args.request, comments.total, pageSize)
  return comments
}

export async function userCommentsLoader(args: LoaderFunctionArgs) {
  const userId = idParam(args.params.id)
  const page = requestedPage(args.request)
  const comments = await routeLoader(args, api => loadUserComments(api, userId, page))
  keepWithinPages(args.request, comments.total, userPageSize)
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
