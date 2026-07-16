-- FASE 17 SMOKE — Kanban operacional, RBAC e histórico.
-- Usa propostas existentes com lock e rollback; nenhum dado fica persistido.

begin;

do $$
declare
  v_required text[] := array[
    'diligencia_juridica', 'protocolo_cartorio', 'exigencias_cartorio',
    'custas_cartorio', 'registro_af', 'pagamento_comissao', 'completo'
  ];
  v_value text;
begin
  foreach v_value in array v_required loop
    if not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'proposta_status' and e.enumlabel = v_value
    ) then
      raise exception 'FASE 17 FAIL: enum ausente: %', v_value;
    end if;
  end loop;
end
$$;

do $$
declare
  v_proposta_id uuid;
  v_admin_id uuid;
  v_partner_user_id uuid;
  v_partner_id uuid;
  v_team_user_id uuid;
  v_team_equipe_id uuid;
  v_status public.proposta_status;
  v_history_before int;
  v_history_after int;
  v_order public.proposta_status[] := array[
    'pre_analise', 'analise_juridica', 'analise_credito', 'analise_imovel',
    'comite', 'proposta_cliente', 'diligencia_juridica', 'emissao_contrato',
    'aguardando_assinatura', 'protocolo_cartorio', 'exigencias_cartorio',
    'custas_cartorio', 'registro_af', 'recurso_liberado',
    'pagamento_comissao', 'completo'
  ]::public.proposta_status[];
begin
  select u.id into v_admin_id
    from public.usuarios u where u.role = 'admin' and u.ativo limit 1;

  select p.id, p.partner_id, pt.usuario_id
    into v_proposta_id, v_partner_id, v_partner_user_id
    from public.propostas p
    join public.partners pt on pt.id = p.partner_id
   where pt.status = 'approved'
   order by p.created_at
   limit 1
   for update of p;

  select em.usuario_id, em.equipe_id
    into v_team_user_id, v_team_equipe_id
    from public.equipe_membros em
   where em.aceito_em is not null
   limit 1;

  if v_admin_id is null or v_proposta_id is null or v_team_user_id is null then
    raise exception 'FASE 17 FAIL: requer admin, proposta de partner aprovado e team_member aceito';
  end if;

  select count(*) into v_history_before
    from public.proposta_status_historico h where h.proposta_id = v_proposta_id;

  perform set_config('request.jwt.claim.aal', 'aal2', true);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_admin_id::text, 'role', 'authenticated', 'aal', 'aal2',
    'app_metadata', json_build_object('role', 'admin')
  )::text, true);

  foreach v_status in array v_order loop
    update public.propostas set status = v_status where id = v_proposta_id;
  end loop;

  select count(*) into v_history_after
    from public.proposta_status_historico h where h.proposta_id = v_proposta_id;
  if v_history_after <= v_history_before then
    raise exception 'FASE 17 FAIL: histórico não registrou sequência admin';
  end if;

  -- Partner mantém somente a passagem comercial explicitamente autorizada.
  update public.propostas set status = 'proposta_cliente' where id = v_proposta_id;
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_partner_user_id::text, 'role', 'authenticated', 'aal', 'aal2',
    'app_metadata', json_build_object(
      'role', 'partner', 'approved', true, 'partner_id', v_partner_id::text
    )
  )::text, true);
  update public.propostas set status = 'diligencia_juridica' where id = v_proposta_id;

  begin
    update public.propostas set status = 'analise_credito' where id = v_proposta_id;
    raise exception 'FASE 17 FAIL: partner moveu etapa sensível';
  exception when others then
    if sqlerrm not like 'status_transition_not_allowed_for_partner:%' then raise; end if;
  end;

  -- Team member não recebe permissão operacional nova.
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_admin_id::text, 'role', 'authenticated', 'aal', 'aal2',
    'app_metadata', json_build_object('role', 'admin')
  )::text, true);
  update public.propostas set status = 'simulacao' where id = v_proposta_id;

  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_team_user_id::text, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'team_member', 'equipe_id', v_team_equipe_id::text)
  )::text, true);
  update public.propostas set status = 'pre_analise' where id = v_proposta_id;

  begin
    update public.propostas set status = 'analise_juridica' where id = v_proposta_id;
    raise exception 'FASE 17 FAIL: team_member moveu etapa sensível';
  exception when others then
    if sqlerrm not like 'status_transition_not_allowed_for_team_member:%' then raise; end if;
  end;

  raise notice 'FASE 17 SMOKE: enum, admin, partner, team_member e histórico OK';
end
$$;

rollback;