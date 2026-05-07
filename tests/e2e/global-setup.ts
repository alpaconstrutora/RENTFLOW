import { test as setup, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'

const SESSION_PATH = path.join('tests', 'e2e', '.auth', 'session.json')
const TEST_PASSWORD = 'E2eTestPwd!2026'

setup('autenticar usuário de teste', async ({ page, context }) => {
  const supabaseUrl  = process.env.E2E_SUPABASE_URL!
  const serviceKey   = process.env.E2E_SUPABASE_SERVICE_KEY!
  const anonKey      = process.env.E2E_SUPABASE_ANON_KEY!
  const testEmail    = process.env.E2E_TEST_EMAIL!
  const baseURL      = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

  if (!supabaseUrl || !serviceKey || !anonKey || !testEmail) {
    throw new Error('Preencha E2E_SUPABASE_URL, E2E_SUPABASE_SERVICE_KEY, E2E_SUPABASE_ANON_KEY e E2E_TEST_EMAIL no .env.test')
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Garantir que usuário existe com email confirmado
  const { data: { users } } = await admin.auth.admin.listUsers()
  let userId = users.find(u => u.email === testEmail)?.id
  if (!userId) {
    const { data: { user } } = await admin.auth.admin.createUser({
      email: testEmail,
      email_confirm: true,
    })
    userId = user!.id
  }

  // Definir senha para o usuário de teste
  await admin.auth.admin.updateUserById(userId, {
    password: TEST_PASSWORD,
    email_confirm: true,
  })

  // Fazer login com senha (sem fluxo de email)
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { session }, error } = await anonClient.auth.signInWithPassword({
    email: testEmail,
    password: TEST_PASSWORD,
  })
  if (error || !session) throw new Error(`Login falhou: ${error?.message}`)

  // Injetar sessão nos cookies do contexto do browser
  // @supabase/ssr armazena a sessão no cookie sb-{project-ref}-auth-token
  // Chunks de 3600 bytes para respeitar limite de 4096 bytes por cookie
  const projectRef  = supabaseUrl.replace('https://', '').split('.')[0]
  const cookieName  = `sb-${projectRef}-auth-token`
  const sessionJSON = JSON.stringify(session)
  const CHUNK_SIZE  = 3600

  const chunks: string[] = []
  for (let i = 0; i < sessionJSON.length; i += CHUNK_SIZE) {
    chunks.push(sessionJSON.slice(i, i + CHUNK_SIZE))
  }

  const cookiesToSet = chunks.length === 1
    ? [{ name: cookieName, value: chunks[0] }]
    : chunks.map((chunk, i) => ({ name: `${cookieName}.${i}`, value: chunk }))

  for (const c of cookiesToSet) {
    await context.addCookies([{
      ...c,
      domain: 'localhost',
      path: '/',
      sameSite: 'Lax' as const,
    }])
  }

  // Navegar e verificar autenticação
  await page.goto(`${baseURL}/dashboard`)
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })

  // Salvar estado (cookies + localStorage) para reuso nos testes
  fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true })
  await context.storageState({ path: SESSION_PATH })
})
