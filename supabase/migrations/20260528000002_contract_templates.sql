-- Migração: Estrutura do Motor de Templates Jurídicos (Fase 1)
-- Criado em: 2026-05-28
-- Referência Sequencial: 20260528000002

-- 1. Tabela de Modelos de Contratos (Templates)
create table if not exists public.contract_templates (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    category text not null, -- 'locacao', 'prestacao_servicos', 'empreitada', 'nda', 'outros'
    docx_storage_path text not null,
    status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
    version text not null default '1.0.0',
    metadata jsonb default '{}'::jsonb not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabela de Definições de Variáveis Dinâmicas
create table if not exists public.contract_variables (
    id uuid primary key default gen_random_uuid(),
    template_id uuid references public.contract_templates(id) on delete cascade not null,
    code text not null, -- Ex: 'LOCATARIO_NOME'
    label text not null, -- Ex: 'Nome do Locatário'
    field_type text not null check (field_type in ('text', 'number', 'currency', 'percentage', 'date', 'cpf_cnpj', 'cep', 'phone', 'email', 'dropdown', 'dynamic_table')),
    is_required boolean not null default true,
    origin text not null default 'manual', -- 'manual', 'db_tenant_name', 'db_property_address', 'db_rent_value', etc.
    default_value text,
    validation_regex text,
    tooltip_help text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(template_id, code)
);

-- 3. Tabela de Instâncias de Contratos (Contratos Emitidos)
create table if not exists public.contract_instances (
    id uuid primary key default gen_random_uuid(),
    template_id uuid references public.contract_templates(id) on delete restrict not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    lease_id uuid references public.leases(id) on delete set null,
    property_id uuid references public.properties(id) on delete set null,
    tenant_id uuid references public.tenants(id) on delete set null,
    status text not null default 'draft' check (status in ('draft', 'ready', 'signed', 'archived')),
    generated_docx_path text,
    generated_pdf_path text,
    sha256_hash text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Tabela de Valores das Variáveis Preenchidos por Instância
create table if not exists public.contract_variable_values (
    id uuid primary key default gen_random_uuid(),
    instance_id uuid references public.contract_instances(id) on delete cascade not null,
    variable_id uuid references public.contract_variables(id) on delete cascade not null,
    value text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(instance_id, variable_id)
);

-- 5. Criação de Índices para Otimização de Performance
create index if not exists idx_contract_templates_user_id on public.contract_templates(user_id);
create index if not exists idx_contract_variables_template_id on public.contract_variables(template_id);
create index if not exists idx_contract_instances_user_id on public.contract_instances(user_id);
create index if not exists idx_contract_instances_template_id on public.contract_instances(template_id);
create index if not exists idx_contract_instances_lease_id on public.contract_instances(lease_id);
create index if not exists idx_contract_variable_values_instance_id on public.contract_variable_values(instance_id);

-- 6. Habilitar Row Level Security (RLS)
alter table public.contract_templates enable row level security;
alter table public.contract_variables enable row level security;
alter table public.contract_instances enable row level security;
alter table public.contract_variable_values enable row level security;

-- 7. Criação de Políticas RLS (Multi-tenant por user_id)

-- Políticas para contract_templates
create policy "Users can manage their own templates" 
    on public.contract_templates
    for all 
    using (auth.uid() = user_id);

-- Políticas para contract_variables
create policy "Users can manage their own template variables" 
    on public.contract_variables
    for all 
    using (
        exists (
            select 1 from public.contract_templates
            where contract_templates.id = contract_variables.template_id
            and contract_templates.user_id = auth.uid()
        )
    );

-- Políticas para contract_instances
create policy "Users can manage their own contract instances" 
    on public.contract_instances
    for all 
    using (auth.uid() = user_id);

-- Políticas para contract_variable_values
create policy "Users can manage their own contract values" 
    on public.contract_variable_values
    for all 
    using (
        exists (
            select 1 from public.contract_instances
            where contract_instances.id = contract_variable_values.instance_id
            and contract_instances.user_id = auth.uid()
        )
    );

-- 8. Concessão de Permissões de Acesso (Grants)
grant all on table public.contract_templates to authenticated;
grant all on table public.contract_variables to authenticated;
grant all on table public.contract_instances to authenticated;
grant all on table public.contract_variable_values to authenticated;
