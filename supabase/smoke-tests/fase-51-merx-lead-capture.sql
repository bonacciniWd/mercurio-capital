-- Executar em banco local de teste após as migrations MERX 20261029/20261030.
-- Usa apenas fixtures sintéticas; todas as alterações são revertidas.
begin;

insert into auth.users (id) values ('00000000-0000-4000-8000-000000000001');
insert into public.merx_leads_publicos (
  id, idempotency_key, nome_completo, cidade, email, telefone, interesse, pagina_origem
) values (
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000202',
  'Pessoa MERX Smoke', 'Curitiba', 'merx-smoke@example.test', '5541999990000',
  'construcao', '/'
);

do $$
begin
  if has_table_privilege('anon', 'public.merx_leads_publicos', 'select') then
    raise exception 'anon não deve ter SELECT direto em leads MERX';
  end if;
  if has_function_privilege('anon', 'public.rate_limit_consume_pair(text,text,integer,integer,interval)', 'execute') then
    raise exception 'anon não deve consumir rate limit';
  end if;
  if not has_function_privilege('service_role', 'public.rate_limit_consume_pair(text,text,integer,integer,interval)', 'execute') then
    raise exception 'service_role deve poder consumir rate limit';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'admin', true);
select set_config('request.jwt.claim.admin_nivel', 'full', true);
set local role authenticated;

do $$
declare
  v_status text;
  v_city text;
  v_interest text;
  v_status_id uuid;
  v_history integer;
begin
  select status_comercial, cidade, interesse into v_status, v_city, v_interest
    from public.v_admin_leads_publicos
    where id = 'merx:00000000-0000-4000-8000-000000000201';
  if v_status <> 'novo' or v_city <> 'Curitiba' or v_interest <> 'construcao' then
    raise exception 'lead MERX não está visível corretamente para admin';
  end if;

  select status_comercial into v_status from public.admin_set_lead_status_comercial(
    'merx:00000000-0000-4000-8000-000000000201', 'em_contato', 'novo'
  );
  if v_status <> 'em_contato' then raise exception 'atualização de status MERX falhou'; end if;
  select id into v_status_id from public.lead_status_comercial
    where merx_lead_id = '00000000-0000-4000-8000-000000000201';
  select count(*) into v_history from public.lead_status_comercial_historico
    where lead_status_id = v_status_id;
  if v_history <> 1 then raise exception 'histórico do status MERX não foi registrado'; end if;

  begin
    insert into public.lead_status_comercial (simulacao_lead_id, cpc_lead_id, merx_lead_id, status)
    values (null, null, '00000000-0000-4000-8000-000000000201', 'novo');
    raise exception 'status sem origem única foi aceito';
  exception when unique_violation or check_violation then null;
  end;
end;
$$;

reset role;
set local role service_role;
do $$
declare
  v_allowed boolean;
begin
  v_allowed := public.rate_limit_consume_pair(
    'merx-smoke::email', 'merx-smoke::ip', 1, 3, interval '60 minutes'
  );
  if v_allowed is distinct from true then raise exception 'primeira tentativa deveria passar'; end if;
  v_allowed := public.rate_limit_consume_pair(
    'merx-smoke::email', 'merx-smoke::ip', 1, 3, interval '60 minutes'
  );
  if v_allowed is distinct from false then raise exception 'limite por e-mail não foi aplicado'; end if;
end;
$$;

rollback;
