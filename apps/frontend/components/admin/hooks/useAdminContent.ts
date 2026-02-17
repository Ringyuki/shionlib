'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AdminGameListResult,
  AdminGameListQuery,
  AdminCharacterListResult,
  AdminCharacterListQuery,
  AdminDeveloperListResult,
  AdminDeveloperListQuery,
} from '@/interfaces/admin/content.interface'
import { shionlibRequest } from '@/utils/request'

export function useAdminGameList(query: AdminGameListQuery = {}) {
  const [data, setData] = useState<AdminGameListResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (query.page) params.set('page', query.page.toString())
      if (query.limit) params.set('pageSize', query.limit.toString())
      if (query.search) params.set('search', query.search)
      if (query.sortBy) params.set('sortBy', query.sortBy)
      if (query.sortOrder) params.set('sortOrder', query.sortOrder)
      if (query.status !== undefined) params.set('status', query.status.toString())

      const queryString = params.toString()
      const url = `/admin/content/games${queryString ? `?${queryString}` : ''}`
      const res = await shionlibRequest().get<AdminGameListResult>(url)
      setData(res.data)
    } catch (error) {
      console.error('Failed to fetch game list:', error)
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [query.page, query.limit, query.search, query.sortBy, query.sortOrder, query.status])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, refetch: fetchData }
}

export async function updateGameStatus(gameId: number, status: number): Promise<void> {
  await shionlibRequest().patch<void>(`/admin/content/games/${gameId}/status`, {
    data: { status },
  })
}

export async function updateGameScalar(
  gameId: number,
  payload: Record<string, any>,
): Promise<void> {
  await shionlibRequest().patch<void>(`/admin/content/games/${gameId}/edit/scalar`, {
    data: payload,
  })
}

export async function deleteGame(gameId: number): Promise<void> {
  await shionlibRequest().delete<void>(`/admin/content/games/${gameId}`)
}

export async function addGameToRecentUpdate(gameId: number): Promise<void> {
  await shionlibRequest().put<void>(`/admin/content/games/${gameId}/recent-update`)
}

export async function removeGameFromRecentUpdate(gameId: number): Promise<void> {
  await shionlibRequest().delete<void>(`/admin/content/games/${gameId}/recent-update`)
}

export function useAdminCharacterList(query: AdminCharacterListQuery = {}) {
  const [data, setData] = useState<AdminCharacterListResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (query.page) params.set('page', query.page.toString())
      if (query.limit) params.set('pageSize', query.limit.toString())
      if (query.search) params.set('search', query.search)
      if (query.sortBy) params.set('sortBy', query.sortBy)
      if (query.sortOrder) params.set('sortOrder', query.sortOrder)

      const queryString = params.toString()
      const url = `/admin/content/characters${queryString ? `?${queryString}` : ''}`
      const res = await shionlibRequest().get<AdminCharacterListResult>(url)
      setData(res.data)
    } catch (error) {
      console.error('Failed to fetch character list:', error)
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [query.page, query.limit, query.search, query.sortBy, query.sortOrder])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, refetch: fetchData }
}

export function useAdminDeveloperList(query: AdminDeveloperListQuery = {}) {
  const [data, setData] = useState<AdminDeveloperListResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (query.page) params.set('page', query.page.toString())
      if (query.limit) params.set('pageSize', query.limit.toString())
      if (query.search) params.set('search', query.search)
      if (query.sortBy) params.set('sortBy', query.sortBy)
      if (query.sortOrder) params.set('sortOrder', query.sortOrder)

      const queryString = params.toString()
      const url = `/admin/content/developers${queryString ? `?${queryString}` : ''}`
      const res = await shionlibRequest().get<AdminDeveloperListResult>(url)
      setData(res.data)
    } catch (error) {
      console.error('Failed to fetch developer list:', error)
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [query.page, query.limit, query.search, query.sortBy, query.sortOrder])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, refetch: fetchData }
}
