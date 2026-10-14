import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import { valuesOf, type AdminAd, type Filter } from './admin-ad'
import { changeAd, loadAds, uploadImage } from './admin-ad.use-cases'

const meta = (totalItems: number) => ({
  currentPage: 1,
  itemCount: 0,
  itemsPerPage: 20,
  totalItems,
  totalPages: 1,
})

const overview = { running: 2, week: { views: 10, clicks: 1 }, enabled: true }

const report = { total: { views: 0, clicks: 0 }, days: null, slots: null }

const ad: AdminAd = {
  id: 3,
  name: 'LoveNao',
  link: 'https://v2.lovenao.pro/',
  banner: 'spotlight/banner/l.webp',
  banner_adult: false,
  side_image: null,
  side_icon: null,
  side_adult: false,
  slots: ['game'],
  languages: ['zh'],
  weight: 5,
  enabled: true,
  status: 'running',
  start_at: null,
  end_at: null,
  week: { views: 0, clicks: 0 },
  created: '2026-10-01T00:00:00.000Z',
  updated: '2026-10-01T00:00:00.000Z',
}

const filter: Filter = { status: undefined, slot: undefined, ad: undefined, days: '30', page: 1 }

const paths = (requests: Request[]) =>
  requests.map(
    request => `${request.method} ${new URL(request.url).pathname}${new URL(request.url).search}`,
  )

describe('loadAds', () => {
  it('loads the page of ads with the overview and the opened ad with its report', async () => {
    const fake = fakeApi()
      .on('get', '/admin/ad/overview', overview)
      .on('get', '/admin/ad', { items: [ad], meta: meta(1) })
      .on('get', '/admin/ad/{id}', ad)
      .on('get', '/admin/ad/{id}/report', report)
    await expect(
      loadAds(fake.api, { ...filter, status: 'running', slot: 'game', ad: 3, days: '7' }, 20),
    ).resolves.toEqual({
      filter: { ...filter, status: 'running', slot: 'game', ad: 3, days: '7' },
      overview,
      ads: [ad],
      total: 1,
      opened: { ad, report },
    })
    expect(paths(fake.requests)).toEqual(
      expect.arrayContaining([
        'GET /admin/ad?page=1&pageSize=20&status=running&slot=game',
        'GET /admin/ad/3/report?days=7',
      ]),
    )
  })

  it('closes an ad that is gone', async () => {
    const fake = fakeApi()
      .on('get', '/admin/ad/overview', overview)
      .on('get', '/admin/ad', { items: null, meta: meta(0) })
      .fail('get', '/admin/ad/{id}', 404, { code: 580101, message: '广告不存在' })
      .fail('get', '/admin/ad/{id}/report', 404, { code: 580101, message: '广告不存在' })
    await expect(loadAds(fake.api, { ...filter, ad: 9 }, 20)).resolves.toMatchObject({
      ads: [],
      opened: undefined,
    })
  })
})

describe('changeAd', () => {
  it('turns an ad off by sending it back whole', async () => {
    const fake = fakeApi().on('get', '/admin/ad/{id}', ad).on('put', '/admin/ad/{id}', ad)
    await changeAd(fake.api, { action: 'enabled', id: 3, enabled: false })
    const sent = fake.requests.find(request => request.method === 'PUT')
    await expect(sent?.json()).resolves.toMatchObject({
      name: 'LoveNao',
      banner: 'spotlight/banner/l.webp',
      slots: ['game'],
      enabled: false,
    })
  })

  it('creates and deletes', async () => {
    const fake = fakeApi().on('post', '/admin/ad', ad).on('delete', '/admin/ad/{id}', undefined)
    await changeAd(fake.api, { action: 'create', values: valuesOf(ad) })
    await changeAd(fake.api, { action: 'remove', id: 3 })
    expect(paths(fake.requests)).toEqual(['POST /admin/ad', 'DELETE /admin/ad/3'])
  })
})

describe('uploadImage', () => {
  it('sends each kind of picture to its own upload', async () => {
    const fake = fakeApi()
      .on('put', '/uploads/small/ad/banner', { key: 'spotlight/banner/n.webp' })
      .on('put', '/uploads/small/ad/side-icon', { key: 'spotlight/icon/n.webp' })
    const image = new File(['x'], 'a.png', { type: 'image/png' })
    await expect(uploadImage(fake.api, 'banner', image)).resolves.toBe('spotlight/banner/n.webp')
    await expect(uploadImage(fake.api, 'side-icon', image)).resolves.toBe('spotlight/icon/n.webp')
  })
})
