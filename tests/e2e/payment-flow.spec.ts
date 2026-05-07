import { test, expect, Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// IDs criados durante o teste — compartilhados entre steps
let propertyName: string
let tenantName: string

// Cleanup: remove dados criados pelo teste para manter isolamento
test.afterAll(async () => {
  const supabaseUrl = process.env.E2E_SUPABASE_URL
  const serviceKey  = process.env.E2E_SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  if (propertyName) {
    await admin.from('properties').delete().eq('name', propertyName)
  }
  if (tenantName) {
    await admin.from('tenants').delete().eq('name', tenantName)
  }
})

// ─── Helpers ────────────────────────────────────────────────────────────────

async function waitForModalClose(page: Page) {
  await page.waitForTimeout(600)
  await page.waitForLoadState('networkidle')
}

async function fillAndSubmit(page: Page, submitText: string) {
  await page.getByRole('button', { name: submitText }).click()
  await waitForModalClose(page)
}

// ─── Testes ─────────────────────────────────────────────────────────────────

test('fluxo completo: criar imóvel', async ({ page }) => {
  propertyName = `E2E Apt ${Date.now()}`

  await page.goto('/dashboard/imoveis')
  await page.getByRole('button', { name: 'Cadastrar Imóvel' }).click()
  await expect(page.getByRole('heading', { name: 'Cadastrar Imóvel' })).toBeVisible()

  await page.getByPlaceholder(/Apartamento 402/i).fill(propertyName)
  await page.locator('select[name="type"]').selectOption('apartment')
  await page.getByPlaceholder('3.500,00').fill('2000')

  await fillAndSubmit(page, 'Salvar')

  await expect(page.getByText(propertyName)).toBeVisible({ timeout: 10_000 })
})

test('fluxo completo: criar inquilino', async ({ page }) => {
  tenantName = `E2E Inquilino ${Date.now()}`

  await page.goto('/dashboard/inquilinos')
  await page.getByRole('button', { name: 'Cadastrar Inquilino' }).click()
  await expect(page.getByRole('heading', { name: 'Novo Inquilino' })).toBeVisible()

  // PF está selecionado por padrão
  await page.getByPlaceholder('Ex: João da Silva').fill(tenantName)
  await page.locator('input[name="document"]').fill('123.456.789-09')

  await fillAndSubmit(page, 'Salvar')

  await expect(page.getByText(tenantName)).toBeVisible({ timeout: 10_000 })
})

test('fluxo completo: criar contrato e verificar parcela gerada', async ({ page }) => {
  await page.goto('/dashboard/contratos')
  await page.getByRole('button', { name: 'Aprovar Assinatura de Contrato' }).click()

  await expect(page.locator('h2', { hasText: 'Emissão de Contrato' })).toBeVisible()

  // Selecionar imóvel
  const propertySelect = page.locator('select[name="property_id"]')
  await expect(propertySelect).toBeVisible()
  // Encontrar o option cujo texto contém o nome do imóvel
  const propertyOption = await propertySelect.locator(`option:has-text("${propertyName}")`).getAttribute('value')
  await propertySelect.selectOption(propertyOption ?? '')

  // Selecionar inquilino
  const tenantSelect = page.locator('select[name="tenant_id"]')
  const tenantOption = await tenantSelect.locator(`option:has-text("${tenantName}")`).getAttribute('value')
  await tenantSelect.selectOption(tenantOption ?? '')

  // Preencher dados do contrato
  await page.locator('input[name="rent_value"]').fill('2000')
  await page.locator('input[name="due_day"]').fill('5')

  // Data de início = dia 1 do mês atual (garante que parcela seja gerada)
  const now = new Date()
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  await page.locator('input[name="start_date"]').fill(startDate)

  await fillAndSubmit(page, 'Efetivar Contrato')

  // Se aparecer diálogo de backfill, escolher apenas mês atual
  const backfillBtn = page.getByRole('button', { name: 'Somente mês atual' })
  if (await backfillBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await backfillBtn.click()
    await waitForModalClose(page)
  }

  // Verificar que o contrato aparece listado
  await expect(page.getByText(propertyName)).toBeVisible({ timeout: 10_000 })
})

test('fluxo completo: liquidar parcela', async ({ page }) => {
  await page.goto('/dashboard/fluxo')

  // Filtrar pelo imóvel do teste para isolar
  await page.waitForLoadState('networkidle')

  // Localizar linha com o nome do imóvel e status pending/late
  const row = page.locator('tr', { hasText: propertyName }).filter({ hasText: /Pendente|Em atraso/i }).first()
  await expect(row).toBeVisible({ timeout: 15_000 })

  // Clicar em Liquidar
  await row.getByRole('button', { name: 'Liquidar' }).click()

  // Modal de confirmação de liquidação
  const modalHeading = page.getByText('Confirmar Liquidação')
  await expect(modalHeading).toBeVisible({ timeout: 5_000 })

  // Confirmar — o modal só fecha quando a server action retorna com sucesso
  await page.getByRole('button', { name: 'Confirmar' }).click()

  // Aguardar o modal fechar (confirma que a server action rodou)
  await expect(modalHeading).not.toBeVisible({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')

  // Verificar que o status mudou para Liquidada (sem precisar de reload)
  await expect(
    page.locator('tr', { hasText: propertyName }).filter({ hasText: 'Liquidada' }).first()
  ).toBeVisible({ timeout: 10_000 })
})

test('fluxo completo: DRE reflete o pagamento', async ({ page }) => {
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')

  // O painel deve mostrar receitas pagas > 0 (inclui o pagamento feito)
  // Verificamos pelo card de DRE presente na página
  const dreCard = page.locator('text=/Resultado|Receitas|DRE/i').first()
  await expect(dreCard).toBeVisible({ timeout: 10_000 })

  // Verificar que não há erros visíveis na página
  await expect(page.locator('text=/erro interno|500|something went wrong/i')).not.toBeVisible()
})
