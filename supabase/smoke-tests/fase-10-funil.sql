-- =============================================
-- SMOKE TEST FASE 10 — Funil de Parceiros + Webhook de Bounce
-- =============================================
-- Roda em transação reversível: nenhum dado fica persistido.
-- Uso: supabase db remote query --file supabase/smoke-tests/fase-10-funil.sql
-- ou:  psql "$DATABASE_URL" -f supabase/smoke-tests/fase-10-funil.sql

begin;

do $$
declare
  v_admin    uuid;
  v_usr      uuid := gen_random_uuid();
  v_partner  uuid;
  v_proposta uuid;
  v_invite1  uuid;
  v_invite2  uuid;
  v_invite3  uuid;
  v_funil    record;
  v_bounce   jsonb;
  v_invite_status text;
begin
  -- pega um admin existente para o JWT
  select id into v_admin from usuarios where role = 'admin' limit 1;
  if v_admin is null then
    raise exception 'precisa de pelo menos 1 admin no banco';
  end if;

  -- cria usuário sintético + partner pendente
  insert into auth.users (id, email, raw_app_meta_data, last_sign_in_at)
  values (v_usr, 'smoke-fase10-' || v_usr || '@mercurio.test',
          jsonb_build_object('role','partner'), now());

  insert into usuarios (id, email, nome_completo, role, ativo, ultimo_login_at)
  values (v_usr, 'smoke-fase10-' || v_usr || '@mercurio.test', 'Smoke Parceiro F10',
          'partner', true, now());

  insert into partners (usuario_id, status)
  values (v_usr, 'approved')
  returning id into v_partner;

  -- impersona admin para chamar as RPCs e ler o funil
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin::text,
                      'app_metadata', json_build_object('role','admin'))::text, true);

  -- 3 convites em estados diferentes
  insert into partner_invites (email, nome_completo, status, partner_id, usuario_id, created_by)
  values ('expira1-' || v_usr || '@test.com', 'Será Bounced', 'sent', v_partner, v_usr, v_admin)
  returning id into v_invite1;

  insert into partner_invites (email, nome_completo, status, partner_id, usuario_id, created_by)
  values ('aceito-' || v_usr || '@test.com', 'Aceito', 'accepted', v_partner, v_usr, v_admin)
  returning id into v_invite2;

  insert into partner_invites (email, nome_completo, status, partner_id, usuario_id, created_by)
  values ('revogado-' || v_usr || '@test.com', 'Revogado', 'revoked', v_partner, v_usr, v_admin)
  returning id into v_invite3;

  -- 1 documento → etapa "enviaram_docs"
  insert into partner_documentos (partner_id, tipo, storage_path, status)
  values (v_partner, 'contrato_social', 'smoke/test.pdf', 'pendente');

  -- 1 proposta → etapa "com_proposta"
  insert into propostas (
    partner_id, cliente_id, status, valor_solicitado, prazo_meses
  )
  select v_partner, c.id, 'simulada', 50000, 36
    from clientes c limit 1
  returning id into v_proposta;

  -- 1 comissão paga → etapa "com_comissao_paga"
  if v_proposta is not null then
    insert into comissoes (proposta_id, partner_id, percentual, valor, status, paga_em)
    values (v_proposta, v_partner, 2.5, 1250, 'paga', now());
  end if;

  -- ===== LEITURA DO FUNIL =====
  select * into v_funil from v_admin_funil_parceiros;
  raise notice 'funil → convidados=% ativaram=% docs=% aprovados=% propostas=% comissao=%',
    v_funil.convidados, v_funil.ativaram, v_funil.enviaram_docs,
    v_funil.aprovados, v_funil.com_proposta, v_funil.com_comissao_paga;

  if v_funil.convidados < 3 then
    raise exception 'funil convidados deveria ter >=3, veio %', v_funil.convidados;
  end if;
  if v_funil.aprovados < 1 then
    raise exception 'funil aprovados deveria ter >=1';
  end if;
  if v_funil.com_proposta < 1 then
    raise exception 'funil com_proposta deveria ter >=1';
  end if;
  if v_funil.com_comissao_paga < 1 then
    raise exception 'funil com_comissao_paga deveria ter >=1';
  end if;

  -- ===== WEBHOOK BOUNCE (service role) =====
  -- chama process_email_bounce como service_role
  set local role service_role;

  v_bounce := process_email_bounce(
    'smoke_evt_' || v_invite1,
    'sendgrid',
    'expira1-' || v_usr || '@test.com',
    'hard_bounce',
    '{}'::jsonb
  );
  raise notice 'bounce 1 → %', v_bounce;

  if (v_bounce->>'expired')::boolean is not true then
    raise exception 'esperado expired=true ao processar bounce';
  end if;

  -- idempotência: chamar de novo com o mesmo event_id não deve quebrar
  v_bounce := process_email_bounce(
    'smoke_evt_' || v_invite1,
    'sendgrid',
    'expira1-' || v_usr || '@test.com',
    'hard_bounce',
    '{}'::jsonb
  );
  if (v_bounce->>'duplicate')::boolean is not true then
    raise exception 'segunda chamada deveria ser duplicate=true';
  end if;

  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin::text,
                      'app_metadata', json_build_object('role','admin'))::text, true);

  -- valida que o convite virou expired
  select status into v_invite_status from partner_invites where id = v_invite1;
  if v_invite_status <> 'expired' then
    raise exception 'convite deveria estar expired, está %', v_invite_status;
  end if;

  -- valida que entrou no inbox
  if not exists (select 1 from email_bounces_inbox where event_id = 'smoke_evt_' || v_invite1) then
    raise exception 'evento não persistiu em email_bounces_inbox';
  end if;

  raise notice '✅ smoke fase 10 OK';
end $$;

rollback;
