import type { ApiClient } from '~/shared/api/client'
import {
  pageSize,
  userPageSize,
  type CommentPlace,
  type Comments,
  type ThreadOrder,
  type UserComments,
} from './comment'
import type {
  CommentEdit,
  CommentLike,
  CommentPin,
  CommentPost,
  CommentRemoval,
} from './comment.schema'

export async function loadComments(
  api: ApiClient,
  place: CommentPlace,
  page: number,
  order: ThreadOrder,
  focus?: number,
): Promise<Comments> {
  const query = { page, pageSize, order, ...(focus === undefined ? {} : { focus }) }
  const found =
    place.kind === 'game'
      ? await api.get('/comment/game/{game_id}', {
          params: { path: { game_id: place.id }, query },
        })
      : await api.get('/comment/resource/{resource_id}', {
          params: { path: { resource_id: place.id }, query },
        })
  return {
    place,
    pinned: found.meta.pinned ?? undefined,
    threads: found.items ?? [],
    total: found.meta.totalItems,
    count: found.meta.comments,
    page: found.meta.currentPage,
    order,
  }
}

export async function countComments(api: ApiClient, gameId: number): Promise<number> {
  const found = await api.get('/comment/game/{game_id}', {
    params: { path: { game_id: gameId }, query: { page: 1, pageSize: 1 } },
  })
  return found.meta.comments
}

export async function loadUserComments(
  api: ApiClient,
  userId: number,
  page: number,
): Promise<UserComments> {
  const found = await api.get('/user/datas/{id}/comments', {
    params: { path: { id: userId }, query: { page, pageSize: userPageSize } },
  })
  return { items: found.items ?? [], total: found.meta.totalItems, page }
}

export async function postComment(api: ApiClient, post: CommentPost): Promise<number> {
  const body = {
    content: post.content,
    ...(post.parentId === undefined ? {} : { parent_id: post.parentId }),
  }
  const created =
    post.place.kind === 'game'
      ? await api.post('/comment/game/{game_id}', {
          params: { path: { game_id: post.place.id } },
          body,
        })
      : await api.post('/comment/resource/{resource_id}', {
          params: { path: { resource_id: post.place.id } },
          body,
        })
  return created.id
}

export async function pinComment(api: ApiClient, pin: CommentPin): Promise<void> {
  const params = { path: { comment_id: pin.commentId } }
  if (pin.pinned) {
    await api.put('/comment/{comment_id}/pin', { params })
  } else {
    await api.delete('/comment/{comment_id}/pin', { params })
  }
}

export async function editComment(api: ApiClient, edit: CommentEdit): Promise<void> {
  await api.patch('/comment/{comment_id}', {
    params: { path: { comment_id: edit.commentId } },
    body: { content: edit.content },
  })
}

export async function removeComment(api: ApiClient, removal: CommentRemoval): Promise<void> {
  await api.delete('/comment/{comment_id}', { params: { path: { comment_id: removal.commentId } } })
}

export async function toggleLike(api: ApiClient, like: CommentLike): Promise<void> {
  await api.post('/comment/{comment_id}/like', { params: { path: { comment_id: like.commentId } } })
}
