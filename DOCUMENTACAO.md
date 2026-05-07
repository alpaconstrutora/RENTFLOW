# RentFlow — Documentação Técnica do Sistema

**Versão:** 1.0
**Data de geração:** 2026-05-05
**Stack:** Next.js 16.2.2 (App Router) + React 19 + Supabase (Postgres + Auth + RLS) + TypeScript

---

## 1. Visão Geral

RentFlow é uma plataforma B2B de gestão financeira de imóveis para locação. Cobre o ciclo completo: cadastro de imóveis e inquilinos → assinatura de contratos → geração automática mensal de aluguéis → conciliação no fluxo de caixa → reajustes anuais → motor tributário (IBS/CBS) → relatórios e declaração anual.

### Princípios arquiteturais

1. **Banco como única fonte de verdade** — toda regra de integridade vive em RPCs PL/pgSQL com `SECURITY DEFINER`, não no app.
2. **Server Components + Server Actions** — zero estado em cliente para dados; UI é hidratada do servidor.
3. **Optimistic locking via `xmin`** — nunca `updated_at`. Edições conflitantes falham explicitamente.
4. **`user_today()` em vez de `new Date()`** — tudo respeita o timezone do usuário (perfil).
5. **Imutabilidade de auditoria** — transações nunca são deletadas; apenas canceladas (`status = 'cancelled'`) ou ajustadas via `parent_transaction_id`.

---

## 2. Estrutura de Pastas

```
src/app/
├── layout.tsx                     # Root layout
├── page.tsx                       # Landing
├── login/                         # Auth via Supabase
├── auth/
│   ├── callback/route.ts          # OAuth callback
│   └── signout/route.ts
└── dashboard/
    ├── layout.tsx                 # Sidebar + main
    ├── Navigation.tsx             # Menu de 8 itens
    ├── page.tsx                   # Painel Resumo (KPIs)
    ├── actions.ts                 # Server actions globais (transações)
    ├── fluxo/                     # Fluxo de Caixa
    ├── imoveis/                   # Portfólio + detalhe
    ├── inquilinos/                # Cadastro PF/PJ
    ├── contratos/                 # Contratos de Locação
    ├── impostos/                  # Motor IBS/CBS
    ├── relatorios/                # Relatórios mensais
    ├── recibo/[transactionId]/    # Recibo PDF imprimível
    └── configuracoes/             # Perfil + tax_config

supabase/migrations/               # Schema versionado (29 migrations)
utils/supabase/                    # Clients (server / browser)
```

---

## 3. Modelo de Dados

### 3.1 Tabelas principais

| Tabela          | Propósito                                                                  |
| --------------- | -------------------------------------------------------------------------- |
| `profiles`      | Dados do usuário (timezone, plano trial/basic/pro)                         |
| `properties`    | Imóveis (residencial/comercial, vacant/rented, valor de compra)            |
| `tenants`       | Inquilinos PF e PJ (endereço, RG, profissão, fiador)                        |
| `leases`        | Contratos de locação (rent_value, due_day, start/end_date, billing_start)  |
| `rent_history`  | Histórico de reajustes (previous → new value, índice usado)                |
| `transactions`  | Receitas e despesas (auto-geradas e manuais) com xmin lock                  |
| `categories`    | Sistema + customizadas por usuário (income/expense)                        |
| `tax_config`    | Alíquotas IBS/CBS por usuário, isenção, dedução residencial                |
| `domain_events` | Audit log append-only (source: system/user/job)                            |
| `job_runs`      | Histórico de execuções dos cron jobs (advisory lock + status)              |

### 3.2 View canônica

```sql
CREATE VIEW transactions_view AS
  SELECT
    t.*,
    (t.amount + COALESCE(t.addition_amount,0) - COALESCE(t.discount_amount,0)) AS net_amount,
    t.xmin::text AS xmin,
    p.name  AS property_name,
    ten.name AS tenant_name
  FROM transactions t
  LEFT JOIN properties p   ON t.property_id = p.id
  LEFT JOIN leases     l   ON t.lease_id    = l.id
  LEFT JOIN tenants    ten ON l.tenant_id   = ten.id
  WHERE t.status != 'cancelled';
```

**Invariante #13:** toda leitura de transações **deve** passar por `transactions_view`. A tabela `transactions` tem `SELECT` revogado de `authenticated`.

### 3.3 Constraints críticas

- `uq_lease_billing_month` — UNIQUE INDEX em `(lease_id, billing_month) WHERE is_auto_generated = true` → idempotência do cron.
- `check_income_requires_lease` — toda receita exige `lease_id`.
- `check_recurrence_group` — recorrência exige `recurrence_group_id`.

### 3.4 Row Level Security

Todas as tabelas (exceto `categories.is_system = true`) têm a policy:
```sql
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())
```
Isolamento total por usuário; nada vaza entre tenants.

---

## 4. Páginas e Funcionalidades

### 4.1 Painel Resumo (`/dashboard`)

KPIs server-rendered:
- **DRE do mês** — receitas pagas − despesas pagas (com `net_amount`)
- **YTD acumulado** — performance anual do exercício
- **Tempo Médio de Recebimento** — média de atraso em 12 meses
- **Inadimplência %** — `late ÷ esperado` no mês + janela rolling 30d
- **Taxa de vacância** — propriedades vagas ÷ total
- **Vencimentos D+7** — alertas de parcelas próximas
- **Contratos expirando em 30d**
- **Top 3 Yield** — maior `rent×12 ÷ purchase_value`
- **Alertas de Contratos** — vencimento + reajuste próximo (RPC `get_lease_alerts`)

### 4.2 Fluxo de Caixa (`/dashboard/fluxo`)

Tabela única consolidada com filtros server-side via URL params:
- `?ano=YYYY` — range de billing_month do ano (2010 → atual)
- `?mes=YYYY-MM` — competência específica
- `?imovel=<uuid>` · `?tipo=income|expense` · `?status=...`

**Colunas:** Operação · Cliente · Vencimento · Liquidação · Valor (com `net_amount` quando há ajuste) · Status · Ação.

**Ações por status:**
| Status     | Ações disponíveis                                                                  |
| ---------- | ---------------------------------------------------------------------------------- |
| pending    | Editar notas · Aplicar desconto/acréscimo · **Liquidar** (modal com data) · Cancelar |
| paid       | Recibo (income) · Ajuste (auto-gerada) · **Estornar** (volta para pending)         |
| late       | Mesmas ações de pending                                                            |
| cancelled  | Apenas badge "Baixa Nula"                                                          |

**Liquidar:** abre modal com campo de data pré-preenchido com `due_date`; permite registrar pagamento em data passada.

**Estornar:** RPC `revert_transaction_paid` zera `paid_date` e volta `status` para `pending`.

**Export CSV** — botão exporta todas as linhas da view filtrada.

### 4.3 Imóveis (`/dashboard/imoveis` + `/dashboard/imoveis/[id]`)

**Listagem:** thumbnail + endereço + status (Locado/Vago) + Aluguel/Yield anual + ROI Acumulado + ROI Anualizado.

**Cadastro/Edição:** modal com:
- Identificação (nome, tipo, status)
- Foto (upload Supabase Storage — bucket `property-photos`)
- Endereço estruturado (CEP, rua, número, bairro, cidade, estado)
- Financeiro (valor de compra, aluguel esperado, notas)

**Detalhe (`/imoveis/[id]`):** 4 KPIs (resultado YTD, ROI, yield, lucro total), painel do inquilino ativo, histórico de contratos, últimas 50 transações.

### 4.4 Inquilinos (`/dashboard/inquilinos`)

Cadastro PF e PJ com tabs distintas:
- **PF:** nome, RG, CPF, nacionalidade, data nasc., estado civil, profissão, renda mensal
- **PJ:** razão social, CNPJ
- **Endereço:** CEP, rua, número, bairro, cidade, estado
- **Foto** + **Fiador** (nome + documento)
- **Observações**

**Exclusão:** RPC bloqueia se houver contrato ativo (integridade fiscal).

### 4.5 Contratos (`/dashboard/contratos` + `/dashboard/contratos/[leaseId]`)

**Listagem:** propriedade · inquilino · valor + reajuste previsto · vigência · ações (Reajustar / PDF / Distrato / Excluir).

**Criação (`createLeaseAction`):**
- Vincula imóvel vago + inquilino + valor + dia vencto + datas
- **Cláusula de reajuste anual** (índice IGPM/IPCA/INCC/LIVRE + periodicidade)
- **billing_start_date** opcional (carência) — só gera parcelas a partir desta data
- Detecta retroatividade e oferece **backfill** de meses anteriores (RPC `backfill_lease_history`)
- Emite `domain_event contract_created`

**Edição (`updateLeaseAction`):**
- Aba **Reajuste:** novo valor + % calculadora · grava em `rent_history` · recalcula `next_adjustment_date`
- Aba **Cláusula Contratual:** end_date, billing_start_date (RPC cancela parcelas pendentes anteriores), periodicidade, índice

**PDF do Contrato:** página `/contratos/[leaseId]` renderiza contrato de locação completo de 8 cláusulas com `window.print()`.

**Distrato:** marca lease inativo, opcionalmente cria multa rescisória, emite `contract_terminated`.

**"Faturar Portfólio" (`triggerBillingEngineAction`):** dispara `generate_monthly_rents` + `generate_recurring_expenses` com advisory lock.

### 4.6 Impostos (`/dashboard/impostos` + `/dashboard/impostos/declaracao`)

**Configuração (`tax_config`):** alíquota IBS (default 0.65%) + CBS (default 0.90%) + dedução residencial (50%) + isenções.

**Motor:** ao liquidar uma receita (`status = 'paid'`), a RPC `apply_tax_on_payment` calcula a retenção e cria automaticamente uma **Despesa Pendente** com a base do imposto (residencial recebe dedução).

**Declaração Anual:** página `/impostos/declaracao?ano=YYYY` consolida receitas, despesas, base de cálculo IBS+CBS, ranking por imóvel, dados dos inquilinos.

### 4.7 Relatórios (`/dashboard/relatorios` + `/dashboard/relatorios/[month]`)

Lista de meses com transações, link para detalhe mensal (DRE + transações + export).

### 4.8 Configurações (`/dashboard/configuracoes`)

Perfil (nome, telefone, timezone, documento), upload de avatar, edição de `tax_config`.

---

## 5. Server Actions (resumo)

### `dashboard/actions.ts`
- `updateTransactionWithOptimisticLock(id, status, xmin, overridePaidDate?)` — atualiza status via RPC `update_transaction_optimistic`. Se `paid`, dispara motor tributário.
- `createAdjustmentTransaction(parentId, amount, notes)` — cria transação com `parent_transaction_id` (auto-gerada paga é imutável).
- `editTransactionFieldsAction(id, xmin, notes, categoryId, scope, groupId)` — edita notas/categoria. Escopo `this`/`all` para séries recorrentes.
- `applyTransactionAdjustmentAction(id, xmin, discount, addition, notes)` — aplica desconto/multa preservando valor original.

### `dashboard/contratos/actions.ts`
- `createLeaseAction` · `updateLeaseAction` · `runBackfillAction` · `deleteLeaseAction` · `distratoAction`
- `triggerBillingEngineAction` — RPA mensal manual (advisory lock)
- `cancelTransactionAction` (`cancel_transaction_safe` RPC)
- `revertTransactionAction` (`revert_transaction_paid` RPC)

### `dashboard/inquilinos/actions.ts`
- `createTenantAction` · `updateTenantAction` · `deleteTenantAction`

### `dashboard/imoveis/actions.ts`
- `createPropertyAction` · `updatePropertyAction` · `deletePropertyAction`
- Upload de foto via Supabase Storage

### `dashboard/configuracoes/actions.ts`
- `updateProfileAction` (RPC `upsert_profile`) · `updateTaxConfigAction`

---

## 6. RPCs PL/pgSQL Críticas

| RPC                                | Propósito                                                                |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `user_today(uuid)`                 | Data corrente no timezone do usuário (NUNCA `new Date()`)                |
| `update_transaction_optimistic`    | Update com xmin lock — falha se houve concurrent modify                  |
| `apply_tax_on_payment`             | Atomic: cria despesa de IBS/CBS ao liquidar receita                      |
| `generate_monthly_rents`           | Insere parcelas do mês para todos leases ativos (idempotente)            |
| `generate_recurring_expenses`      | Mesma lógica para despesas recorrentes                                   |
| `backfill_lease_history`           | Cria parcelas retroativas (de billing_start_date até mês anterior)       |
| `update_billing_start_date`        | Atualiza data + cancela pendentes anteriores                             |
| `recalc_next_adjustment`           | Calcula próxima data de reajuste a partir de `adjustment_base_date`      |
| `recompute_statuses`               | Reconcilia status (paid/pending/late) por usuário                        |
| `get_lease_alerts`                 | Alertas combinados (vencimento + reajuste) para o painel                 |
| `delete_lease_safe`                | Exclui contrato + cancela parcelas auto pendentes                        |
| `cancel_transaction_safe`          | Cancela com checagem da Invariante #8 (paid auto = imutável)             |
| `revert_transaction_paid`          | Estorna paid → pending, limpa paid_date                                  |
| `try_acquire_job_lock` / `release` | Advisory lock por nome de job                                            |

---

## 7. Cron Jobs (pg_cron)

| Job                       | Cron        | O que faz                                                          |
| ------------------------- | ----------- | ------------------------------------------------------------------ |
| `update-late-status`      | `0 9 * * *` | pending → late quando `due_date < user_today`. Encerra leases vencidos. Emite `payment_late`. |
| `generate-monthly-rents`  | `0 10 1 * *`| Chama edge function que executa `generate_monthly_rents` + `generate_recurring_expenses` |

Ambos com advisory lock + `job_runs` para auditoria.

---

## 8. Invariantes do Sistema

| #  | Invariante                                                                                |
| -- | ----------------------------------------------------------------------------------------- |
| 1  | Transações nunca são deletadas — apenas canceladas (`status = 'cancelled'`)               |
| 4  | `paid_date` SEMPRE via `user_today(user_id)` — nunca `new Date()` JS                      |
| 8  | Auto-gerada com `status = paid` é imutável → ajustes via `parent_transaction_id`          |
| 11 | Todo job global usa advisory lock + registra em `job_runs`                                |
| 12 | Yield/ROI exigem `purchase_value > 0` (proteção div/0)                                    |
| 13 | Leitura de transações **somente** via `transactions_view` (RLS revoga `transactions`)     |

---

## 9. Eventos de Domínio (`domain_events`)

Append-only audit log. Emissores: `user`, `system`, `job`.

| event_type            | Emitido em                                  |
| --------------------- | ------------------------------------------- |
| `contract_created`    | createLeaseAction                           |
| `contract_terminated` | distratoAction                              |
| `payment_received`    | Liquidação manual ou ajuste                 |
| `payment_late`        | Cron `update-late-status` (D-1 do atraso)   |
| `backfill_generated`  | runBackfillAction                           |
| `job_failed`          | Cron em catch block                         |

---

## 10. Fluxos de Negócio Chave

### 10.1 Ciclo mensal de uma parcela

1. **Dia 1, 10h** — cron `generate-monthly-rents` cria transações `pending` para todos leases ativos onde `COALESCE(billing_start_date, start_date) <= current_month`.
2. **Diariamente, 9h** — cron `update-late-status` marca como `late` quem passou de `due_date`.
3. **Usuário liquida** — abre modal com data (default = `due_date`), confirma, RPC `update_transaction_optimistic` move para `paid` + `apply_tax_on_payment` cria despesa de IBS/CBS.
4. **Histórico** — `domain_event payment_received` é gravado com timestamp e contexto.

### 10.2 Reajuste anual

1. Usuário entra na aba "Reajuste" do contrato → informa % ou novo valor (calculadora bidirecional).
2. `updateLeaseAction` atualiza `leases.rent_value`, grava linha em `rent_history`, chama `recalc_next_adjustment`.
3. Próximas parcelas geradas pelo cron já saem com o novo valor (idempotência via `uq_lease_billing_month`).

### 10.3 Carência ou atraso de entrega

- **Na criação:** preenche "Início das Parcelas" (`billing_start_date`) — nenhuma parcela é gerada antes.
- **Pós-contrato:** edita o campo via "Cláusula Contratual" → RPC `update_billing_start_date` atualiza + cancela pendentes anteriores em uma transação ACID.

### 10.4 Contrato retroativo

Ao criar um lease com `start_date` no passado, o sistema detecta e oferece um diálogo de **backfill**: gera todas as parcelas faltantes como `pending` em uma única operação (idempotente via UNIQUE constraint).

---

## 11. Convenções Operacionais

### Modelo do Next.js
- **Next.js 16.2.2** com `searchParams: Promise<...>` e `params: Promise<...>` em páginas async (breaking change vs versões anteriores).
- **App Router exclusivo** — sem pages dir.

### Datas
- **Sempre `user_today()`** no banco; nunca `new Date()` em server actions para datas de domínio.
- Datas de UI livres podem usar `new Date()` em client components.

### Edição de transações
- **Otimistic lock por xmin** — toda RPC de edição recebe `p_expected_xmin` e retorna erro se mudou.
- Edição de campo segue padrão: ler view → mostrar form → submit com xmin → RPC valida.

### Segurança
- RLS em todas as tabelas de domínio.
- RPCs com `SECURITY DEFINER` validam `auth.uid()` internamente.
- Storage com policies por usuário em `property-photos` e `tenant-photos`.

---

## 12. Migrations (29 arquivos)

Todas em `supabase/migrations/` com prefixo timestamp `YYYYMMDDHHMMSS_descricao.sql`.

**Marcos:**
- `20260406224013_schema.sql` — schema inicial completo (10 tabelas, RLS, RPCs base)
- `20260408000000_fix_invariants.sql` — Invariantes #1, #4, #8, #11, #13
- `20260413000000_tax_engine_rpc.sql` — Motor IBS/CBS
- `20260422000001_lease_contract_v2.sql` — Cláusula de reajuste + `next_adjustment_date`
- `20260424000003_properties_improvements.sql` — Endereço estruturado
- `20260425000000-002_tenants_*.sql` — Inquilinos PF/PJ + sprint 2 (foto/fiador) + sprint 3 (notes)
- `20260502000000_transactions_view_tenant_name.sql` — `tenant_name` na view
- `20260502000001_billing_start_date.sql` — Carência / atraso de entrega
- `20260502000002_revert_transaction_paid.sql` — RPC de estorno
- `20260502000003_drop_emergency_contact.sql` — Remove campos não utilizados

---

## 13. Próximos Pontos de Atenção

- **Edge function `generate-rents`** — apontada por cron mensal; URL precisa apontar para `https://[PROJECT].supabase.co` em produção (atualmente localhost).
- **Plano `trial` permite 999 imóveis** — ajustar antes de cobrar planos pagos.
- **CSV export** — atualmente client-side; considerar streaming server-side para >10k linhas.
- **Recibo PDF** — usa `window.print()`; considerar geração server-side com browser headless para anexar a e-mails.
