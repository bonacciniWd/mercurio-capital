-- =============================================
-- MIGRATION — LOTE A (APROVAÇÕES & PARCEIROS)
-- =============================================
-- Aditiva; não altera RLS além do necessário.
--   1) documento_tipo: novos valores para os slots de PartnerDocsUploader.
--   2) v_admin_partner_aprovacoes: expõe invite_id (necessário para reenvio).
--   3) RPC equipe_membro_invite_resend — reenvia convite de membro de equipe
--      delegando para partner_invite_membro (mesmo guard, mesma trilha de e-mail).
--   4) RPC admin_partner_invite_resend — valida/audita o reenvio de convite de
--      parceiro; a orquestração de e-mail (Auth Admin API) fica na Edge Function
--      `admin-partner-invite-resend`, que chama esta RPC com o JWT do admin.
--   5) RPC admin_partner_update_perfil — atualiza nome/CPF/telefone/endereço/
--      dados_bancarios do parceiro (o e-mail de login é tratado à parte pela
--      Edge Function `admin-partner-update-email`, nunca client-side direto).

-- =============================================
-- 1) documento_tipo — novos slots do PartnerDocsUploader
-- =============================================
alter type public.documento_tipo add value if not exists 'cnh_ou_rg';
alter type public.documento_tipo add value if not exists 'certidao_estado_civil';
alter type public.documento_tipo add value if not exists 'dados_bancarios';

-- =============================================
-- 2) v_admin_partner_aprovacoes — expõe invite_id
-- =============================================
-- Necessário para a tela /admin/aprovacoes acionar o reenvio do convite.
-- DROP + CREATE porque a coluna é adicionada dentro do CTE (não apenas ao
-- final do SELECT), o que CREATE OR REPLACE VIEW não permite.
drop view if exists public.v_admin_partner_aprovacoes;

create view public.v_admin_partner_aprovacoes
with (security_invoker = true)
as
  with last_invite as (
    select distinct on (i.partner_id)
      i.partner_id,
      i.id               as invite_id,
      i.observacoes      as invite_observacoes,
      i.created_at       as invite_created_at,
      i.created_by       as invite_created_by,
      uc.nome_completo   as invite_criado_por_nome,
      i.status           as invite_status
    from public.partner_invites i
    left join public.usuarios uc on uc.id = i.created_by
    order by i.partner_id, i.created_at desc
  )
  select
    p.id                              as partner_id,
    p.status,
    p.cpf,
    p.endereco_cidade,
    p.endereco_estado,
    p.created_at,
    p.aprovado_em,
    p.aprovado_por,
    p.motivo_rejeicao,
    u.id                              as usuario_id,
    u.nome_completo                   as nome,
    u.email,
    u.telefone,
    u.telefone_ddi,
    u.ultimo_login_at,
    (select count(*) from public.partner_documentos d where d.partner_id = p.id) as docs_count,
    case when li.partner_id is not null then 'convite' else 'auto_cadastro' end as origem,
    li.invite_observacoes,
    li.invite_criado_por_nome,
    li.invite_created_at,
    li.invite_status,
    li.invite_id
  from public.partners p
  join public.usuarios u on u.id = p.usuario_id
  left join last_invite li on li.partner_id = p.id;

grant select on public.v_admin_partner_aprovacoes to authenticated;

-- =============================================
-- 3) RPC equipe_membro_invite_resend — reenvia convite de membro de equipe
-- =============================================
-- Reaproveita partner_invite_membro: localiza o convite pendente, extrai o
-- payload original e delega para a mesma RPC (mesmo guard admin/dono da
-- equipe, mesma trilha de e-mail via email_outbox).
create or replace function public.equipe_membro_invite_resend(
  p_magic_link_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link   public.magic_links%rowtype;
  v_result jsonb;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_link
    from public.magic_links
   where id = p_magic_link_id
     and finalidade = 'membro_convite'
     and used_at is null
     and expires_at > now();

  if not found then
    raise exception 'convite_nao_encontrado_ou_expirado';
  end if;

  v_result := public.partner_invite_membro(
    (v_link.payload->>'equipe_id')::uuid,
    v_link.payload->>'email',
    v_link.payload->>'nome',
    coalesce(v_link.payload->>'papel_equipe', 'membro'),
    coalesce(v_link.payload->'permissoes', '{}'::jsonb)
  );

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_antes, payload_depois)
  values (
    auth.uid(),
    'equipe_convite_reenviado',
    'magic_links',
    p_magic_link_id,
    jsonb_build_object('payload', v_link.payload),
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.equipe_membro_invite_resend(uuid) from public;
grant execute on function public.equipe_membro_invite_resend(uuid) to authenticated;

-- =============================================
-- 4) RPC admin_partner_invite_resend — valida/audita reenvio de convite
-- =============================================
-- Apenas a parte de banco: valida o convite, guarda contra admin não-full e
-- audita. A Edge Function `admin-partner-invite-resend` chama esta RPC com o
-- JWT do admin e, em seguida, usa a Auth Admin API (service role) para gerar
-- um novo link e reenfileirar o e-mail — mesma orquestração usada em
-- `admin-invite-partner`.
create or replace function public.admin_partner_invite_resend(
  p_invite_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite  public.partner_invites%rowtype;
  v_partner public.partners%rowtype;
begin
  if not public.app_is_admin_full() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_invite from public.partner_invites where id = p_invite_id for update;
  if not found then
    raise exception 'convite_nao_encontrado';
  end if;

  if v_invite.status <> 'sent' then
    raise exception 'convite_nao_reenviavel' using hint = 'apenas convites com status sent podem ser reenviados';
  end if;

  select * into v_partner from public.partners where id = v_invite.partner_id;
  if not found or v_partner.status <> 'pending' then
    raise exception 'parceiro_nao_pendente';
  end if;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (
    auth.uid(),
    'partner_invite_resend',
    'partner_invites',
    v_invite.id,
    jsonb_build_object('email', v_invite.email, 'partner_id', v_invite.partner_id)
  );

  return jsonb_build_object(
    'invite_id',      v_invite.id,
    'email',          v_invite.email,
    'nome_completo',  v_invite.nome_completo,
    'partner_id',     v_invite.partner_id,
    'usuario_id',     v_invite.usuario_id
  );
end;
$$;

revoke all on function public.admin_partner_invite_resend(uuid) from public;
grant execute on function public.admin_partner_invite_resend(uuid) to authenticated;

-- =============================================
-- 5) RPC admin_partner_update_perfil — nome/CPF/telefone/endereço/bancários
-- =============================================
-- O e-mail de login NÃO é alterado aqui: é tratado pela Edge Function
-- `admin-partner-update-email` (service role, audita separadamente).
create or replace function public.admin_partner_update_perfil(
  p_partner_id uuid,
  p_payload    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_before public.partners%rowtype;
  v_usuario_before public.usuarios%rowtype;
  v_partner        public.partners%rowtype;
  v_usuario        public.usuarios%rowtype;
begin
  if not public.app_is_admin_full() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_partner_before from public.partners where id = p_partner_id for update;
  if not found then
    raise exception 'partner_not_found';
  end if;

  select * into v_usuario_before from public.usuarios where id = v_partner_before.usuario_id for update;
  if not found then
    raise exception 'usuario_not_found';
  end if;

  update public.usuarios
     set nome_completo = coalesce(nullif(p_payload->>'nome', ''), nome_completo),
         telefone      = coalesce(nullif(p_payload->>'telefone', ''), telefone),
         telefone_ddi  = coalesce(nullif(p_payload->>'telefone_ddi', ''), telefone_ddi)
   where id = v_usuario_before.id
   returning * into v_usuario;

  update public.partners
     set cpf                  = coalesce(nullif(p_payload->>'cpf', ''), cpf),
         endereco_cep         = coalesce(nullif(p_payload->>'endereco_cep', ''), endereco_cep),
         endereco_logradouro  = coalesce(nullif(p_payload->>'endereco_logradouro', ''), endereco_logradouro),
         endereco_numero      = coalesce(nullif(p_payload->>'endereco_numero', ''), endereco_numero),
         endereco_complemento = coalesce(p_payload->>'endereco_complemento', endereco_complemento),
         endereco_bairro      = coalesce(nullif(p_payload->>'endereco_bairro', ''), endereco_bairro),
         endereco_cidade      = coalesce(nullif(p_payload->>'endereco_cidade', ''), endereco_cidade),
         endereco_estado      = coalesce(nullif(p_payload->>'endereco_estado', ''), endereco_estado),
         dados_bancarios      = coalesce(p_payload->'dados_bancarios', dados_bancarios)
   where id = p_partner_id
   returning * into v_partner;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_antes, payload_depois)
  values (
    auth.uid(),
    'admin_partner_update_perfil',
    'partners',
    p_partner_id,
    jsonb_build_object(
      'nome', v_usuario_before.nome_completo,
      'telefone', v_usuario_before.telefone,
      'telefone_ddi', v_usuario_before.telefone_ddi,
      'cpf', v_partner_before.cpf,
      'endereco_cep', v_partner_before.endereco_cep,
      'endereco_logradouro', v_partner_before.endereco_logradouro,
      'endereco_numero', v_partner_before.endereco_numero,
      'endereco_complemento', v_partner_before.endereco_complemento,
      'endereco_bairro', v_partner_before.endereco_bairro,
      'endereco_cidade', v_partner_before.endereco_cidade,
      'endereco_estado', v_partner_before.endereco_estado,
      'dados_bancarios', v_partner_before.dados_bancarios
    ),
    jsonb_build_object(
      'nome', v_usuario.nome_completo,
      'telefone', v_usuario.telefone,
      'telefone_ddi', v_usuario.telefone_ddi,
      'cpf', v_partner.cpf,
      'endereco_cep', v_partner.endereco_cep,
      'endereco_logradouro', v_partner.endereco_logradouro,
      'endereco_numero', v_partner.endereco_numero,
      'endereco_complemento', v_partner.endereco_complemento,
      'endereco_bairro', v_partner.endereco_bairro,
      'endereco_cidade', v_partner.endereco_cidade,
      'endereco_estado', v_partner.endereco_estado,
      'dados_bancarios', v_partner.dados_bancarios
    )
  );

  return jsonb_build_object(
    'partner_id',           v_partner.id,
    'nome',                 v_usuario.nome_completo,
    'telefone',             v_usuario.telefone,
    'telefone_ddi',         v_usuario.telefone_ddi,
    'cpf',                  v_partner.cpf,
    'endereco_cep',         v_partner.endereco_cep,
    'endereco_logradouro',  v_partner.endereco_logradouro,
    'endereco_numero',      v_partner.endereco_numero,
    'endereco_complemento', v_partner.endereco_complemento,
    'endereco_bairro',      v_partner.endereco_bairro,
    'endereco_cidade',      v_partner.endereco_cidade,
    'endereco_estado',      v_partner.endereco_estado,
    'dados_bancarios',      v_partner.dados_bancarios
  );
end;
$$;

revoke all on function public.admin_partner_update_perfil(uuid, jsonb) from public;
grant execute on function public.admin_partner_update_perfil(uuid, jsonb) to authenticated;
