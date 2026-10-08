import { expect, test } from '@playwright/test'

test('tells what became public lately and leads to it', async ({ page }) => {
  await page.goto('/zh')
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '动态' }).click()
  await expect(page).toHaveURL(/\/zh\/activity$/)
  const feed = page.getByRole('list', { name: '动态' })
  const commented = feed.getByRole('listitem').filter({ hasText: '评论了' }).first()
  await expect(commented.getByRole('link', { name: 'e2e_user' })).toHaveAttribute(
    'href',
    /^\/zh\/user\/\d+$/,
  )
  await expect(
    commented.getByRole('link', { name: '常轨脱离Creative Re:Re:call' }),
  ).toHaveAttribute('href', /^\/zh\/game\/1\/comments#comment-\d+$/)
})

test('narrows the feed to one kind and says when there is nothing', async ({ page }) => {
  await page.goto('/zh/activity')
  await page.getByRole('button', { name: '评论', exact: true }).click()
  await expect(page).toHaveURL(/\/zh\/activity\?kind=comments$/)
  await expect(page.getByRole('list', { name: '动态' }).getByText('评论了').first()).toBeVisible()

  await page.getByRole('button', { name: '攻略', exact: true }).click()
  await expect(page).toHaveURL(/\/zh\/activity\?kind=walkthroughs$/)
  await expect(page.getByText('暂无新攻略。')).toBeVisible()
})
