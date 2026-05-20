-- =============================================
-- FASE 14 — Hardening & LGPD
-- =============================================
-- Entrega:
--   1. Helpers de mascaramento de PII (mask_email, mask_cpf, mask_cnpj, mask_phone).
--   2. RPC lgpd_export_meus_dados(p_user_id) — admin ou o próprio usuário.
--   3. RPC lgpd_anonimizar_conta(p_user_id, p_motivo) — admin-only.
--      Preserva ledger/financeiro por compliance (retention 5 anos),
--      mas remove/anonimiza identificadores diretos.
--   4. Trigger opcional em audit_log para mascarar PII em payloads.
-- =============================================

-- =============================================
-- 1) HELPERS DE MASCARAMENTO
-- =============================================

create or replace function public.mask_email(p text)
returns text language sql immutable as $$
  select case
    when p is null then null
    when position('@' in p) = 0 then '***'
    else left(p, 1) || repeat('*', greatest(1, position('@' in p) - 2))
         || substring(p from position('@' in p))
  end;
$$;

create or replace function public.mask_cpf(p text)
returns text language sql immutable as $$
  select case
    when p is null then null
    when length(regexp_replace(p, '\D', '', 'g')) < 11 then '***'
    else '***.***.' || substring(regexp_replace(p, '\D', '', 'g') from 7 for 3) || '-**'
  end;
$$;

create or replace function public.mask_cnpj(p text)
returns text language sql immutable as $$
  select case
    when p is null then null
    when length(regexp_replace(p, '\D', '', 'g')) < 14 then '***'
    else '**.***.***/' || substring(regexp_replace(p, '\D', '', 'g') from 9 for 4) || '-**'
  end;
$$;

create or replace function public.mask_phone(p text)
returns text language sql immutable as $$
  select case
    when p is null then null
    when length(regexp_replace(p, '\D', '', 'g')) < 4 then '***'
    else repeat('*', length(regexp_replace(p, '\D', '', 'g')) - 4)
         || right(regexp_replace(p, '\D', '', 'g'), 4)
  end;
$$;

revoke all on function public.mask_email(text) from public;
revoke all on function public.mask_cpf(text) from public;
revoke all on function public.mask_cnpj(text) from public;
revoke all on function public.mask_phone(text) from public;
grant execute on function public.mask_email(text) to authenticated;
grant execute on function public.mask_cpf(text) to authenticated;
grant execute on function public.mask_cnpj(text) to authenticated;
grant execute on function public.mask_phone(text) to authenticated;


-- =============================================
-- 2) LGPD EXPORT — retorna jsonb com todos os dados do titular
-- =============================================

create or replace function public.lgpd_export_meus_dados(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
  v_result jsonb;
begin
  v_target := coalesce(p_user_id, auth.uid());
  if v_target is null then
    raise exception 'usuario nao identificado' using errcode = '42501';
  end if;
  -- Só admin pode exportar de outros
  if v_target <> auth.uid() and not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_result := jsonb_build_object(
    'gerado_em', now(),
    'titular_id', v_target,
    'usuario', (
      select to_jsonb(u) - 'created_at' - 'updated_at'
        from public.usuarios u where u.id = v_target
    ),
    'partner', (
      select to_jsonb(p)
        from public.partners p where p.usuario_id = v_target
    ),
    'partner_documentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pd.id, 'tipo', pd.tipo, 'storage_path', pd.storage_path,
        'validado', pd.validado, 'created_at', pd.created_at
      ))
        from public.partner_documentos pd
        join public.partners p on p.id = pd.partner_id
       where p.usuario_id = v_target
    ), '[]'::jsonb),
    'equipes_membro', coalesce((
      select jsonb_agg(jsonb_build_object(
        'equipe_id', em.equipe_id, 'papel', em.papel_equipe, 'aceito_em', em.aceito_em
      ))
        from public.equipe_membros em where em.usuario_id = v_target
    ), '[]'::jsonb),
    'cliente', (
      select to_jsonb(c) from public.clientes c where c.usuario_id = v_target
    ),
    'propostas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id, 'status', pr.status, 'created_at', pr.created_at,
        'valor_solicitado', pr.valor_solicitado
      ))
        from public.propostas pr
        join public.clientes c on c.id = pr.cliente_id
       where c.usuario_id = v_target
    ), '[]'::jsonb),
    'notificacoes_count', (
      select count(*) from public.notificacoes n where n.usuario_id = v_target
    ),
    'auditoria_count', (
      select count(*) from public.audit_log a where a.usuario_id = v_target
    )
  );

  -- Audit
  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (auth.uid(), 'lgpd_export', 'usuarios', v_target,
          jsonb_build_object('alvo', v_target));

  return v_result;
end;
$$;

revoke all on function public.lgpd_export_meus_dados(uuid) from public;
grant execute on function public.lgpd_export_meus_dados(uuid) to authenticated;


-- =============================================
-- 3) LGPD ANONIMIZAR CONTA (admin-only)
-- =============================================
-- Preserva registros financeiros / ledger / audit (compliance ~5 anos)
-- mas substitui identificadores diretos por placeholders determinísticos.
-- =============================================

create or replace function public.lgpd_anonimizar_conta(
  p_user_id uuid,
  p_motivo  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anon_id        text;
  v_anon_email     text;
  v_anon_nome      text;
  v_partner_id     uuid;
  v_cliente_id     uuid;
  v_propostas_ct   int := 0;
  v_docs_ct        int := 0;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'p_user_id obrigatorio';
  end if;

  v_anon_id    := substr(replace(p_user_id::text, '-', ''), 1, 12);
  v_anon_email := 'anon+' || v_anon_id || '@anonimizado.mercuriocapital.local';
  v_anon_nome  := 'Titular anonimizado ' || v_anon_id;

  -- usuarios
  update public.usuarios
     set nome_completo = v_anon_nome,
         email         = v_anon_email,
         telefone      = null,
         avatar_url    = null,
         ativo         = false
   where id = p_user_id;

  -- partners
  select id into v_partner_id from public.partners where usuario_id = p_user_id;
  if v_partner_id is not null then
    update public.partners
       set cpf                   = null,
           endereco_cep          = null,
           endereco_logradouro   = null,
           endereco_numero       = null,
           endereco_complemento  = null,
           endereco_bairro       = null,
           endereco_cidade       = null,
           endereco_estado       = null,
           dados_bancarios       = null,
           status                = 'suspended'
     where id = v_partner_id;

    select count(*) into v_docs_ct
      from public.partner_documentos where partner_id = v_partner_id;
  end if;

  -- clientes
  select id into v_cliente_id from public.clientes where usuario_id = p_user_id;
  if v_cliente_id is not null then
    update public.clientes
       set nome_completo  = v_anon_nome,
           cpf            = null,
           cnpj           = null,
           data_nascimento= null,
           estado_civil   = null,
           email          = v_anon_email,
           telefone       = null
     where id = v_cliente_id;

    select count(*) into v_propostas_ct
      from public.propostas where cliente_id = v_cliente_id;
  end if;

  -- notificacoes: limpar conteúdo
  update public.notificacoes
     set titulo   = '[anonimizado]',
         mensagem = '[anonimizado]',
         metadata = '{}'::jsonb
   where usuario_id = p_user_id;

  -- audit: registrar (não deletar histórico)
  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (auth.uid(), 'lgpd_anonimizar', 'usuarios', p_user_id,
          jsonb_build_object(
            'motivo', p_motivo,
            'partner_id', v_partner_id,
            'cliente_id', v_cliente_id,
            'propostas_preservadas', v_propostas_ct,
            'documentos_preservados', v_docs_ct
          ));

  return jsonb_build_object(
    'ok', true,
    'titular_id', p_user_id,
    'anon_email', v_anon_email,
    'partner_id', v_partner_id,
    'cliente_id', v_cliente_id,
    'propostas_preservadas', v_propostas_ct,
    'documentos_preservados', v_docs_ct,
    'executado_em', now()
  );
end;
$$;

revoke all on function public.lgpd_anonimizar_conta(uuid, text) from public;
grant execute on function public.lgpd_anonimizar_conta(uuid, text) to authenticated;


-- =============================================
-- 4) VIEW: solicitações LGPD (registro auditável)
-- =============================================

create or replace view public.v_admin_lgpd_solicitacoes
with (security_invoker = on) as
  select
    a.id,
    a.created_at,
    a.usuario_id     as executado_por,
    a.entidade_id    as titular_id,
    a.acao           as tipo,          -- lgpd_export | lgpd_anonimizar
    a.payload_depois as detalhes
    from public.audit_log a
   where a.acao in ('lgpd_export','lgpd_anonimizar')
   order by a.created_at desc;

revoke all on public.v_admin_lgpd_solicitacoes from public;
grant select on public.v_admin_lgpd_solicitacoes to authenticated;


-- =============================================
-- 5) Bootstrap: garantir que a coluna ativo existe em usuarios
-- =============================================
-- (no-op se já existir; cobre o caso de migrations futuras)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='usuarios' and column_name='ativo'
  ) then
    alter table public.usuarios add column ativo boolean not null default true;
  end if;
end $$;
