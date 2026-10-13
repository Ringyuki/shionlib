import { test as setup } from '@playwright/test'
import { accounts, allAccounts, openSignIn, sessionFile, signIn } from './support/accounts'

for (const account of allAccounts) {
  setup(`signs in as ${account}`, async ({ page }) => {
    await openSignIn(page)
    await signIn(page, accounts[account])
    await page.context().storageState({ path: sessionFile(account) })
  })
}
