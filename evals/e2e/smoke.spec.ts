// Smoke path: set up a book, post one expense with Quick Entry, see it in the journal and the trial balance.
// The UI runs in English (locale en-US). Money is typed with the book country's separators (United States).
import { expect, test } from '@playwright/test'

const PIN = '123456'

test('setup, PIN, Quick Entry, journal, trial balance', async ({ page }) => {
  await page.goto('/')

  // Setup: country, currency, you (with PIN), family, accounts, summary.
  await page.getByRole('button', { name: 'Register' }).click()
  await page.getByPlaceholder('Search').first().fill('United States')
  await page.getByText('United States', { exact: true }).first().click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click() // currency follows the country
  await page.locator('#name').fill('Anna')
  await page.getByRole('textbox', { name: 'PIN' }).first().fill(PIN)
  await page.getByRole('textbox', { name: 'PIN' }).last().fill(PIN)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.locator('#group').fill('Smith Family')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('radio', { name: /Recommended/ }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Smith Family')).toBeVisible()
  await page.getByRole('button', { name: 'Set up' }).click()
  await expect(page.getByText('Your book is ready.')).toBeVisible()

  // The app locks on reload: pick the member and enter the PIN.
  await page.reload()
  await expect(page.getByText('Who is using the book?')).toBeVisible()
  await page.getByRole('button', { name: /Anna/ }).click()
  await page.getByRole('textbox', { name: 'PIN' }).fill(PIN)
  await expect(page.getByRole('button', { name: 'Quick Entry' }).first()).toBeVisible()

  // Quick Entry: an expense of 25.50 from the wallet to groceries.
  await page.getByRole('button', { name: 'Quick Entry' }).first().click()
  await page.getByLabel('Amount').fill('25.50')
  const dialog = page.getByRole('dialog', { name: 'Quick Entry' })
  await dialog.getByRole('combobox', { name: 'Expense account' }).fill('Groceries')
  await page.getByRole('option', { name: /Groceries/ }).first().click()
  await dialog.getByLabel('Description').fill('Weekly shop')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toBeHidden()

  // Journal: the entry is there with its number and amount.
  await page.getByRole('link', { name: 'General Journal' }).click()
  await expect(page.getByText('Weekly shop')).toBeVisible()
  await expect(page.getByText('25.50').first()).toBeVisible()

  // Reports: the trial balance totals match (debit = credit).
  await page.getByRole('link', { name: 'Reports' }).click()
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible()
  await page.getByRole('tab', { name: 'Trial Balance' }).click()
  await expect(page.getByRole('row', { name: /Groceries/ })).toBeVisible()
  const row = (name: RegExp) => page.getByRole('row', { name })
  await expect(row(/^Groceries/)).toContainText('25.50')
  await expect(row(/^Wallet/)).toContainText('25.50')
  // Grand total: debit = credit, in turnover and in balance.
  await expect(row(/^Grand total/).getByRole('cell')).toHaveText(['Grand total', '25.50', '25.50', '25.50', '25.50'])
})

// Grants (ADR-0007): a member without the accounts grant cannot add accounts until the admin grants it.
test('a member sees "New account" only after the admin grants accounts', async ({ page }) => {
  const signIn = async (name: RegExp) => {
    await page.goto('/')
    await page.getByRole('button', { name }).click()
  }

  // Admin adds Ben in Settings > Members.
  await signIn(/Anna/)
  await page.getByRole('textbox', { name: 'PIN' }).fill(PIN)
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('tab', { name: 'Members' }).click()
  await page.getByRole('button', { name: 'Add member' }).click()
  await page.getByLabel('Name').fill('Ben')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('button', { name: 'Edit member: Ben' })).toBeVisible()

  // Ben has no PIN yet: his first sign-in sets one. He has no grants, so there is no "New account".
  await signIn(/Ben/)
  await page.getByRole('textbox').first().fill(PIN)
  await page.getByRole('textbox').last().fill(PIN)
  await page.getByRole('link', { name: 'Chart of Accounts' }).first().click()
  await expect(page.getByRole('heading', { name: 'Chart of Accounts' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'New account' })).toHaveCount(0)

  // The admin grants Ben the accounts area; Ben now sees the button.
  await signIn(/Anna/)
  await page.getByRole('textbox', { name: 'PIN' }).fill(PIN)
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('tab', { name: 'Members' }).click()
  await page.getByRole('button', { name: 'Edit member: Ben' }).click()
  await page.getByRole('checkbox', { name: 'Accounts' }).check()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog', { name: 'Edit member' })).toBeHidden()

  await signIn(/Ben/)
  await page.getByRole('textbox', { name: 'PIN' }).fill(PIN)
  await page.getByRole('link', { name: 'Chart of Accounts' }).first().click()
  await expect(page.getByRole('button', { name: 'New account' })).toBeVisible()
})

// useKept: an open Quick Entry dialog and its draft belong to the member. After the idle lock another member signs
// in (Anna's screen is unmounted); when Anna signs in again the dialog and the draft come back from the kept state.
test('an open Quick Entry draft comes back when its member signs in again', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: /Anna/ }).click()
  await page.getByRole('textbox', { name: 'PIN' }).fill(PIN)
  await page.getByRole('button', { name: 'Quick Entry' }).first().click()
  await page.getByRole('dialog', { name: 'Quick Entry' }).getByLabel('Description').fill('half typed')

  await page.clock.runFor('06:00') // past the 5 minute idle limit
  await expect(page.getByText('Locked after being idle')).toBeVisible()
  await page.getByText('Switch member').click()
  await page.getByRole('button', { name: /Ben/ }).click()
  await page.getByRole('textbox', { name: 'PIN' }).fill(PIN)
  await expect(page.getByRole('button', { name: 'Quick Entry' }).first()).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Quick Entry' })).toBeHidden()

  await page.getByRole('button', { name: /Ben/ }).first().click() // the member menu in the sidebar
  await page.getByRole('menuitem', { name: 'Switch member' }).click()
  await page.getByRole('button', { name: /Anna/ }).click()
  await page.getByRole('textbox', { name: 'PIN' }).fill(PIN)

  await expect(page.getByRole('dialog', { name: 'Quick Entry' }).getByLabel('Description')).toHaveValue('half typed')
})
