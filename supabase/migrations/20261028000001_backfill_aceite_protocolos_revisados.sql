-- Escopo fixo dos 138 protocolos revisados e autorizados em 27/10/2026.
-- O helper privado é consumido apenas pelos RPCs Admin de prévia e execução.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.proposta_consulta_aceites_protocolos_revisados()
returns table (protocolo text, status_revisado text)
language sql
immutable
set search_path = public
as $$
  select v.protocolo, v.status_revisado
  from (values
    ('MERC-2026-000007', 'completo'),
    ('MERC-2026-000009', 'completo'),
    ('MERC-2026-000012', 'completo'),
    ('MERC-2026-000013', 'completo'),
    ('MERC-2026-000014', 'completo'),
    ('MERC-2026-000016', 'protocolo_cartorio'),
    ('MERC-2026-000019', 'completo'),
    ('MERC-2026-000020', 'diligencia_juridica'),
    ('MERC-2026-000021', 'completo'),
    ('MERC-2026-000022', 'completo'),
    ('MERC-2026-000023', 'completo'),
    ('MERC-2026-000025', 'completo'),
    ('MERC-2026-000026', 'completo'),
    ('MERC-2026-000027', 'completo'),
    ('MERC-2026-000028', 'pagamento_comissao'),
    ('MERC-2026-000029', 'completo'),
    ('MERC-2026-000030', 'completo'),
    ('MERC-2026-000031', 'completo'),
    ('MERC-2026-000032', 'diligencia_juridica'),
    ('MERC-2026-000034', 'completo'),
    ('MERC-2026-000035', 'completo'),
    ('MERC-2026-000037', 'proposta_cliente'),
    ('MERC-2026-000041', 'completo'),
    ('MERC-2026-000042', 'completo'),
    ('MERC-2026-000047', 'completo'),
    ('MERC-2026-000052', 'completo'),
    ('MERC-2026-000056', 'completo'),
    ('MERC-2026-000057', 'completo'),
    ('MERC-2026-000058', 'completo'),
    ('MERC-2026-000059', 'completo'),
    ('MERC-2026-000060', 'completo'),
    ('MERC-2026-000061', 'completo'),
    ('MERC-2026-000062', 'completo'),
    ('MERC-2026-000063', 'completo'),
    ('MERC-2026-000064', 'completo'),
    ('MERC-2026-000065', 'completo'),
    ('MERC-2026-000066', 'completo'),
    ('MERC-2026-000067', 'completo'),
    ('MERC-2026-000068', 'completo'),
    ('MERC-2026-000069', 'completo'),
    ('MERC-2026-000070', 'completo'),
    ('MERC-2026-000071', 'completo'),
    ('MERC-2026-000073', 'completo'),
    ('MERC-2026-000074', 'completo'),
    ('MERC-2026-000075', 'completo'),
    ('MERC-2026-000076', 'completo'),
    ('MERC-2026-000077', 'completo'),
    ('MERC-2026-000078', 'completo'),
    ('MERC-2026-000079', 'completo'),
    ('MERC-2026-000080', 'completo'),
    ('MERC-2026-000081', 'completo'),
    ('MERC-2026-000082', 'completo'),
    ('MERC-2026-000083', 'completo'),
    ('MERC-2026-000084', 'completo'),
    ('MERC-2026-000085', 'completo'),
    ('MERC-2026-000086', 'completo'),
    ('MERC-2026-000087', 'completo'),
    ('MERC-2026-000088', 'completo'),
    ('MERC-2026-000089', 'completo'),
    ('MERC-2026-000090', 'completo'),
    ('MERC-2026-000091', 'completo'),
    ('MERC-2026-000092', 'completo'),
    ('MERC-2026-000093', 'completo'),
    ('MERC-2026-000094', 'completo'),
    ('MERC-2026-000095', 'completo'),
    ('MERC-2026-000096', 'completo'),
    ('MERC-2026-000097', 'completo'),
    ('MERC-2026-000098', 'completo'),
    ('MERC-2026-000099', 'completo'),
    ('MERC-2026-000100', 'completo'),
    ('MERC-2026-000101', 'completo'),
    ('MERC-2026-000102', 'completo'),
    ('MERC-2026-000103', 'completo'),
    ('MERC-2026-000104', 'completo'),
    ('MERC-2026-000105', 'completo'),
    ('MERC-2026-000106', 'completo'),
    ('MERC-2026-000109', 'completo'),
    ('MERC-2026-000113', 'proposta_cliente'),
    ('MERC-2026-000115', 'completo'),
    ('MERC-2026-000121', 'completo'),
    ('MERC-2026-000122', 'completo'),
    ('MERC-2026-000126', 'standby'),
    ('MERC-2026-000127', 'pre_analise'),
    ('MERC-2026-000131', 'diligencia_juridica'),
    ('MERC-2026-000133', 'completo'),
    ('MERC-2026-000137', 'completo'),
    ('MERC-2026-000141', 'protocolo_cartorio'),
    ('MERC-2026-000142', 'recurso_liberado'),
    ('MERC-2026-000147', 'standby'),
    ('MERC-2026-000150', 'diligencia_juridica'),
    ('MERC-2026-000151', 'analise_imovel'),
    ('MERC-2026-000153', 'standby'),
    ('MERC-2026-000161', 'completo'),
    ('MERC-2026-000163', 'exigencias_cartorio'),
    ('MERC-2026-000164', 'analise_juridica'),
    ('MERC-2026-000165', 'exigencias_cartorio'),
    ('MERC-2026-000167', 'diligencia_juridica'),
    ('MERC-2026-000168', 'completo'),
    ('MERC-2026-000171', 'emissao_contrato'),
    ('MERC-2026-000173', 'standby'),
    ('MERC-2026-000174', 'protocolo_cartorio'),
    ('MERC-2026-000177', 'pre_aprovado'),
    ('MERC-2026-000178', 'proposta_cliente'),
    ('MERC-2026-000179', 'standby'),
    ('MERC-2026-000181', 'pre_analise'),
    ('MERC-2026-000182', 'pre_analise'),
    ('MERC-2026-000183', 'pre_analise'),
    ('MERC-2026-000184', 'comite'),
    ('MERC-2026-000185', 'pagamento_comissao'),
    ('MERC-2026-000187', 'pre_analise'),
    ('MERC-2026-000188', 'pre_analise'),
    ('MERC-2026-000189', 'pre_aprovado'),
    ('MERC-2026-000191', 'proposta_cliente'),
    ('MERC-2026-000192', 'proposta_cliente'),
    ('MERC-2026-000193', 'pre_aprovado'),
    ('MERC-2026-000194', 'pre_aprovado'),
    ('MERC-2026-000195', 'pre_aprovado'),
    ('MERC-2026-000196', 'pre_aprovado'),
    ('MERC-2026-000197', 'pre_analise'),
    ('MERC-2026-000199', 'pre_analise'),
    ('MERC-2026-000200', 'analise_imovel'),
    ('MERC-2026-000206', 'pre_analise'),
    ('MERC-2026-000211', 'pre_aprovado'),
    ('MERC-2026-000213', 'analise_imovel'),
    ('MERC-2026-000214', 'diligencia_juridica'),
    ('MERC-2026-000215', 'emissao_contrato'),
    ('MERC-2026-000216', 'pre_aprovado'),
    ('MERC-2026-000217', 'analise_juridica'),
    ('MERC-2026-000218', 'pre_aprovado'),
    ('MERC-2026-000219', 'pre_aprovado'),
    ('MERC-2026-000220', 'pre_aprovado'),
    ('MERC-2026-000221', 'pre_analise'),
    ('MERC-2026-000222', 'analise_imovel'),
    ('MERC-2026-000223', 'standby'),
    ('MERC-2026-000224', 'pre_aprovado'),
    ('MERC-2026-000225', 'pre_aprovado'),
    ('MERC-2026-000226', 'pre_aprovado'),
    ('MERC-2026-000227', 'pre_analise')
  ) as v(protocolo, status_revisado)
$$;
revoke all on function private.proposta_consulta_aceites_protocolos_revisados() from public, anon, authenticated;

-- Remove o RPC anterior, que abrangia toda proposta elegível no momento da chamada.
drop function if exists public.admin_proposta_consulta_aceites_atestar_retroativo();

create or replace function public.admin_proposta_consulta_aceites_atestar_retroativo_preview()
returns table (
  protocolo text,
  status_revisado text,
  status_atual text,
  elegivel boolean,
  ja_registrado boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.app_is_admin() then
    raise exception 'admin_obrigatorio' using errcode = '42501';
  end if;

  return query
  select r.protocolo,
         r.status_revisado,
         p.status::text,
         p.id is not null
           and p.cliente_id is not null
           and c.id is not null
           and p.status not in ('simulacao', 'cancelado'),
         exists (
           select 1 from public.proposta_consulta_aceites a
            where a.proposta_id = p.id
              and a.cliente_id = p.cliente_id
              and a.revogado_em is null
         )
    from private.proposta_consulta_aceites_protocolos_revisados() r
    left join public.propostas p on p.protocolo = r.protocolo
    left join public.clientes c on c.id = p.cliente_id
   order by r.protocolo;
end;
$$;
revoke all on function public.admin_proposta_consulta_aceites_atestar_retroativo_preview() from public, anon;
grant execute on function public.admin_proposta_consulta_aceites_atestar_retroativo_preview() to authenticated;

create or replace function public.admin_proposta_consulta_aceites_atestar_retroativo_revisado()
returns table (
  protocolos_revisados bigint,
  propostas_elegiveis bigint,
  inseridos bigint,
  ja_registrados bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_count bigint;
  v_unique bigint;
  v_eligible bigint;
  v_inserted bigint;
  v_existing bigint;
  v_invalid bigint;
  v_now timestamptz := now();
  v_version text := '2026-10-retro-v1';
  v_text text := 'Atestado retrospectivo do controlador: segundo a confirmação do controlador, o cliente principal já havia aceitado o uso dos dados desta proposta para as categorias de consulta listadas, mas o evento original não foi persistido. Este registro documenta o atestado atual; não comprova clique digital nem informa a data original do aceite.';
begin
  if v_admin is null or not public.app_is_admin() then
    raise exception 'admin_obrigatorio' using errcode = '42501';
  end if;

  select count(*), count(distinct protocolo) into v_count, v_unique
    from private.proposta_consulta_aceites_protocolos_revisados();
  if v_count <> 138 or v_unique <> 138 then
    raise exception 'lista_revisada_invalida';
  end if;

  select count(*) into v_invalid
    from private.proposta_consulta_aceites_protocolos_revisados() r
    left join public.propostas p on p.protocolo = r.protocolo
    left join public.clientes c on c.id = p.cliente_id
   where p.id is null
      or p.cliente_id is null
      or c.id is null
      or p.status in ('simulacao', 'cancelado');
  if v_invalid > 0 then
    raise exception 'lista_revisada_alterada';
  end if;

  with eligible as materialized (
    select p.id as proposta_id, p.cliente_id, c.usuario_id
      from private.proposta_consulta_aceites_protocolos_revisados() r
      join public.propostas p on p.protocolo = r.protocolo
      join public.clientes c on c.id = p.cliente_id
     where p.status not in ('simulacao', 'cancelado')
  ), inserted as (
    insert into public.proposta_consulta_aceites (
      proposta_id, cliente_id, usuario_id, magic_link_id, origem,
      versao_texto, texto_exibido, escopos, aceito_em, registrado_em,
      registrado_por, atestado_em
    )
    select e.proposta_id, e.cliente_id, e.usuario_id, null, 'atestado_controlador',
      v_version, v_text,
      array['serasa_pf','serasa_pj','bacen_cpf','bacen_cnpj']::text[],
      null, v_now, v_admin, v_now
    from eligible e
    where not exists (
      select 1 from public.proposta_consulta_aceites a
       where a.proposta_id = e.proposta_id
         and a.cliente_id = e.cliente_id
         and a.revogado_em is null
    )
    on conflict (proposta_id, cliente_id, versao_texto, origem)
      where revogado_em is null do nothing
    returning id, proposta_id, cliente_id, versao_texto, escopos, registrado_em
  ), audited as (
    insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
    select v_admin, 'proposta_consulta_aceite_atestado_retroativo',
      'proposta_consulta_aceites', i.id,
      jsonb_build_object(
        'proposta_id', i.proposta_id,
        'cliente_id', i.cliente_id,
        'origem', 'atestado_controlador',
        'versao_texto', i.versao_texto,
        'escopos', i.escopos,
        'registrado_em', i.registrado_em,
        'aceito_em_original', null
      )
    from inserted i
    returning id
  )
  select count(*) into v_inserted from inserted;

  select count(*) into v_eligible
    from private.proposta_consulta_aceites_protocolos_revisados() r
    join public.propostas p on p.protocolo = r.protocolo
   where p.status not in ('simulacao', 'cancelado');
  v_existing := greatest(v_eligible - v_inserted, 0);
  protocolos_revisados := v_count;
  propostas_elegiveis := v_eligible;
  inseridos := v_inserted;
  ja_registrados := v_existing;
  return next;
end;
$$;
revoke all on function public.admin_proposta_consulta_aceites_atestar_retroativo_revisado() from public, anon;
grant execute on function public.admin_proposta_consulta_aceites_atestar_retroativo_revisado() to authenticated;

commit;
