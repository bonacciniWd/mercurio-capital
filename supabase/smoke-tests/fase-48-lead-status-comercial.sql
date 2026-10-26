-- Executar em banco de teste após 20261023000001. Tudo é revertido ao final.
begin;

insert into auth.users (id) values ('00000000-0000-4000-8000-000000000001');
insert into public.simulacao_leads_publicos (id, nome_completo, created_at)
values ('00000000-0000-4000-8000-000000000101', 'Smoke simulação', now());
insert into public.cpc_leads_publicos (id, nome_completo, created_at)
values ('00000000-0000-4000-8000-000000000102', 'Smoke CPC', now());

-- Os grants abaixo atendem somente ao esquema mínimo do banco de teste isolado.
grant select on public.simulacao_leads_publicos, public.cpc_leads_publicos,
  public.v_admin_simulacao_leads_publicos to authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'admin', true);
select set_config('request.jwt.claim.admin_nivel', 'full', true);
set local role authenticated;

do $$
declare
  v_status text;
  v_historico integer;
begin
  select status_comercial into v_status from public.v_admin_leads_publicos
    where id = 'simulacao:00000000-0000-4000-8000-000000000101';
  if v_status <> 'novo' then raise exception 'estado inicial incorreto'; end if;

  select status_comercial into v_status from public.admin_set_lead_status_comercial(
    'simulacao:00000000-0000-4000-8000-000000000101', 'em_contato', 'novo');
  if v_status <> 'em_contato' then raise exception 'primeira transição falhou'; end if;

  select count(*) into v_historico from public.lead_status_comercial_historico;
  if v_historico <> 1 then raise exception 'histórico não registrado'; end if;

  begin
    perform public.admin_set_lead_status_comercial(
      'simulacao:00000000-0000-4000-8000-000000000101', 'qualificado', 'novo');
    raise exception 'conflito não foi detectado';
  exception when serialization_failure then null;
  end;

  select status_comercial into v_status from public.admin_set_lead_status_comercial(
    'simulacao:00000000-0000-4000-8000-000000000101', 'qualificado', 'em_contato');
  if v_status <> 'qualificado' then raise exception 'segunda transição falhou'; end if;

  select status_comercial into v_status from public.admin_set_lead_status_comercial(
    'simulacao:00000000-0000-4000-8000-000000000101', 'novo', 'qualificado');
  if v_status <> 'novo' then raise exception 'reversão falhou'; end if;

  select status_comercial into v_status from public.admin_set_lead_status_comercial(
    'cpc:00000000-0000-4000-8000-000000000102', 'em_contato', 'novo');
  if v_status <> 'em_contato' then raise exception 'CPC não atualizado'; end if;

  begin
    perform public.admin_set_lead_status_comercial('cpc:invalido', 'em_contato', 'novo');
    raise exception 'ID inválido foi aceito';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.admin_set_lead_status_comercial(
      'cpc:00000000-0000-4000-8000-000000000102', 'outro', 'em_contato');
    raise exception 'estado inválido foi aceito';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

select set_config('request.jwt.claim.admin_nivel', 'juridico', true);
do $$
begin
  begin
    perform public.admin_set_lead_status_comercial(
      'cpc:00000000-0000-4000-8000-000000000102', 'qualificado', 'em_contato');
    raise exception 'jurídico alterou o estado';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
