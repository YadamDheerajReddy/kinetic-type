import { expect, test } from '@playwright/test'

test('loads the domain select screen and can start a typing session', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Kinetic Type/i })).toBeVisible()

  const proseCard = page.getByRole('button', { name: /prose mode/i })
  await expect(proseCard).toBeVisible({ timeout: 10_000 }) // worker connects async

  await proseCard.click()
  await expect(page.getByLabel('Typing stage')).toBeVisible()
})
