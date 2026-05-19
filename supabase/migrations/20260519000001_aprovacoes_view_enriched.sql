-- =============================================
-- MIGRATION 043 — ENRIQUECE v_admin_partner_aprovacoes
-- =============================================
-- Inclui contexto do convite (origem) e dados úteis para a tela
-- /admin/aprovacoes mostrar o parceiro mesmo antes do envio de docs:
--   - origem ('convite' | 'auto_cadastro')
--   - observações do convite e quem convidou
--   - cidade/UF e telefone para identificação rápida
-- Não altera nada existente; apenas substitui a view.
-- (DROP + CREATE porque adicionamos colunas no meio — PG não permite alterar
--  posição/nome de colunas em CREATE OR REPLACE VIEW.)

drop view if exists public.v_admin_partner_aprovacoes;

create view public.v_admin_partner_aprovacoes
with (security_invoker = true)
as
  with last_invite as (
    select distinct on (i.partner_id)
      i.partner_id,
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
    li.invite_status
  from public.partners p
  join public.usuarios u on u.id = p.usuario_id
  left join last_invite li on li.partner_id = p.id;

grant select on public.v_admin_partner_aprovacoes to authenticated;

