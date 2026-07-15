import { expect, test } from '@playwright/test'
import { configureSupabaseRuntime, getE2ESupabaseConfig } from './supabaseTestConfig'

const config = getE2ESupabaseConfig()

test.describe('Public read-only Show link (real Supabase)', () => {
  test.skip(!config, 'SUPABASE_TEST_URL/SUPABASE_TEST_ANON_KEY not set — see .env.example')

  test('7. a Show has a permanent public read-only link that survives archive and stops working after delete', async ({ browser }) => {
    const editorContext = await browser.newContext()
    await configureSupabaseRuntime(editorContext.pages()[0] ?? (await editorContext.newPage()), config!)
    const editor = editorContext.pages()[0] ?? (await editorContext.newPage())
    await editorContext.grantPermissions(['clipboard-read', 'clipboard-write'])

    await editor.goto('/')
    await editor.getByRole('button', { name: 'Nuevo show' }).click()
    const name = `E2E Public ${Date.now()}`
    await editor.getByPlaceholder('Ej. TABU — Foro Indie Rocks').fill(name)
    await editor.getByRole('button', { name: 'Crear y abrir' }).click()
    await expect(editor.getByLabel('Nombre del show')).toHaveValue(name)

    await editor.getByRole('button', { name: 'Compartir' }).click()
    const publicUrl = await editor.evaluate(() => navigator.clipboard.readText())
    const hashPath = new URL(publicUrl).hash

    const publicContext = await browser.newContext()
    await configureSupabaseRuntime(publicContext.pages()[0] ?? (await publicContext.newPage()), config!)
    const publicPage = publicContext.pages()[0] ?? (await publicContext.newPage())
    await publicPage.goto(`/${hashPath}`)

    await expect(publicPage.getByRole('heading', { name })).toBeVisible()
    await expect(publicPage.getByText('Vista pública · solo lectura')).toBeVisible()
    await expect(publicPage.getByRole('button', { name: /nuevo show/i })).toHaveCount(0)
    await expect(publicPage.getByRole('button', { name: /archivar/i })).toHaveCount(0)
    await expect(publicPage.getByRole('button', { name: /eliminar/i })).toHaveCount(0)

    // Archive: the public link keeps working.
    await editor.getByRole('button', { name: 'Archivar' }).click()
    await publicPage.reload()
    await expect(publicPage.getByRole('heading', { name })).toBeVisible()
    await expect(publicPage.getByText('Archivado')).toBeVisible()

    // Delete (from the Shows list, Archivados tab): the public link stops resolving.
    await editor.goto('/#/shows')
    await editor.getByRole('button', { name: 'Archivados' }).click()
    await editor.getByRole('article').filter({ hasText: name }).getByRole('button', { name: 'Más acciones' }).click()
    await editor.getByRole('button', { name: 'Eliminar' }).click()

    await publicPage.reload()
    await expect(publicPage.getByText('Show no disponible')).toBeVisible()

    await editorContext.close()
    await publicContext.close()
  })
})
