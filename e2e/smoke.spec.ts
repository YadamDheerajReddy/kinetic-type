import { expect, test } from '@playwright/test'

test('loads the idle screen and can start a typing session', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Kinetic Type/i })).toBeVisible()

  const startButton = page.getByRole('button', { name: /start session/i })
  await expect(startButton).toBeEnabled({ timeout: 10_000 }) // worker connects async

  await startButton.click()
  await expect(page.getByLabel('Typing stage')).toBeVisible()
})
