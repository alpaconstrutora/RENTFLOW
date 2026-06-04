-- Debug function to inspect contract instances bypassing RLS
create or replace function public.get_all_contract_instances_debug()
returns jsonb
language plpgsql
security definer
as $$
declare
  ret jsonb;
begin
  select jsonb_build_object(
    'leases', (select json_agg(t) from (select id, code, property_id, tenant_id, active from public.leases order by code desc limit 10) t),
    'instances', (select json_agg(t) from (select id, lease_id, status, generated_docx_path, created_at from public.contract_instances order by created_at desc limit 10) t)
  ) into ret;
  return ret;
end;
$$;

grant execute on function public.get_all_contract_instances_debug() to anon, authenticated;
