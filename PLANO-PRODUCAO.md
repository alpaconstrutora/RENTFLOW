# Plano de Produção — RentFlow

**Objetivo:** Tornar o sistema seguro, confiável e apto para uso real por clientes pagantes.

---

## Prioridades

| ID | Título | Risco | Esforço |
|---|---|---|---|
| P0.1 | Edge function URL via variável de ambiente | BLOQUEADOR | 30min |
| P0.2 | RLS: bloquear leitura cruzada entre tenants | CRÍTICO | 2h |
| P0.3 | Webhooks de pagamento (Stripe/Pix) | ALTO | 1 dia — ⏸ aguardando definição de gateway |
| P1.1 | PDF server-side (Puppeteer/WeasyPrint) | MÉDIO | 4h |
| P1.2 | `domain_events` → página de auditoria | MÉDIO | 3h |
| P1.3 | Versionamento de contrato (snapshot PDF) | MÉDIO | 4h |
| P2.1 | Testes E2E: fluxo de pagamento crítico | BAIXO | 1 dia |

---

## P0.1 — Edge Function URL via Variável de Ambiente

**Problema:** O cron job `generate-monthly-rents` chama a edge function com URL hardcoded `http://localhost:54321/...`. Em produção, isso falhará silenciosamente — o job_runs ficará `running` forever ou com `success` sem ter gerado nada.

**Solução:**
1. Mover a URL para `current_setting('app.edge_url', true)` — configurável por `ALTER DATABASE` ou Supabase env vars
2. Adicionar verificação: se `generate_monthly_rents` retornar 0 rows mas há contratos ativos → `status = 'warning'`
3. Criar RPC `verify_monthly_billing(p_month date)` para diagnóstico manual
4. Exibir alerta no Dashboard se o último job de faturamento falhou

**Arquivos:**
- `supabase/migrations/20260502000004_edge_url_config.sql` (NOVO)
- `src/app/dashboard/page.tsx` (alerta de job)

---

## P0.2 — RLS: Bloquear Leitura Cruzada entre Tenants (SaaS)

**Problema:** O sistema é multiusuário, mas não há garantia de que um usuário não possa ver dados de outro se burlasse o client-side. As políticas RLS existentes usam `auth.uid()` mas não foram auditadas de forma abrangente.

**Solução:**
1. Auditar todas as tabelas: `properties`, `leases`, `tenants`, `transactions`, `profiles`, `job_runs`, `domain_events`
2. Garantir que cada SELECT/INSERT/UPDATE/DELETE policy filtra por `user_id = auth.uid()`
3. Testar com dois usuários distintos via Supabase client

**Arquivos:**
- `supabase/migrations/20260502000005_rls_audit.sql` (NOVO)

---

## P0.3 — Webhooks de Pagamento (Stripe / Pix)

**Problema:** Hoje o usuário precisa marcar manualmente como "Liquidado". Em um sistema real, o pagamento chega via webhook (Stripe, Gerencianet/Pix) e deve ser reconciliado automaticamente.

**Solução:**
1. Edge function `payment-webhook` que recebe o evento
2. Chama `update_transaction_with_optimistic_lock` internamente
3. Registra `domain_events` com `source = 'webhook'`
4. Idempotência: verificar se o `external_payment_id` já foi processado

**Arquivos:**
- `supabase/functions/payment-webhook/index.ts` (NOVO)
- `supabase/migrations/20260502000006_external_payment_id.sql` (NOVO)

---

## P1.1 — PDF Server-Side

**Problema:** `window.print()` é inadequado para B2B. Não é automatizável, não funciona headless, e o layout depende do browser do usuário.

**Solução:**
1. Edge function `generate-pdf` usando Puppeteer (via Browserless) ou WeasyPrint
2. Retorna `application/pdf` com Content-Disposition: attachment
3. Substituir o botão "Imprimir" por "Baixar PDF"

**Arquivos:**
- `supabase/functions/generate-pdf/index.ts` (NOVO)

---

## P1.2 — `domain_events` → Página de Auditoria

**Problema:** `domain_events` é write-only. Não há interface para o usuário ver o histórico de eventos. Isso é crítico para disputas ("quando foi marcado como pago?", "quem cancelou?").

**Solução:**
1. Renomear conceitualmente para `audit_log` (ou manter nome, criar view)
2. Criar `/dashboard/configuracoes/auditoria` com listagem filtrada por entidade
3. Exibir: data, tipo, fonte, payload resumido

**Arquivos:**
- `src/app/dashboard/configuracoes/auditoria/page.tsx` (NOVO)

---

## P1.3 — Snapshot PDF de Contrato

**Problema:** Quando o usuário edita um contrato (valor, índice, datas), não há histórico da versão anterior. Se houver disputa legal, não há comprovante do estado original.

**Solução:**
1. Ao criar/assinar contrato, gerar PDF e armazenar no Supabase Storage
2. Tabela `lease_documents` com `lease_id`, `storage_path`, `version`, `created_at`
3. Aba "Documentos" no modal de edição de contrato

**Arquivos:**
- `supabase/migrations/20260502000007_lease_documents.sql` (NOVO)
- `src/app/dashboard/contratos/LeaseEditBtn.tsx` (nova aba)

---

## P2.1 — Testes E2E

**Problema:** Nenhum teste automatizado cobre o fluxo crítico de pagamento. Uma regressão em `update_transaction_with_optimistic_lock` ou na view `transactions_view` quebraria silenciosamente.

**Solução:**
1. Playwright E2E cobrindo:
   - Login → criar imóvel → criar inquilino → criar contrato → verificar parcela gerada → liquidar → verificar DRE
2. Rodar em CI (GitHub Actions) em cada PR

**Arquivos:**
- `tests/e2e/payment-flow.spec.ts` (NOVO)
- `.github/workflows/e2e.yml` (NOVO)

---

## Status

| ID | Status | Data |
|---|---|---|
| P0.1 | ✅ Implementado | 2026-05-06 |
| P0.2 | ✅ Implementado | 2026-05-06 |
| P0.3 | ⏸ Pausado | Aguardando definição de gateway |
| P1.1 | ✅ Implementado | 2026-05-06 |
| P1.2 | ✅ Implementado | 2026-05-06 |
| P1.3 | ✅ Implementado | 2026-05-06 |
| P2.1 | ✅ Implementado | 2026-05-06 |
