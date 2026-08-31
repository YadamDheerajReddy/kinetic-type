import { expect, test } from '@playwright/test'

test('loads the Phase 0 architecture spike', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Kinetic Type/i })).toBeVisible()
  await expect(page.getByLabel('Typing stage architecture spike')).toBeVisible()
})
