-- =============================================
-- MIGRATION — ADMIN JURIDICO (upload-only de modelo de contrato)
-- =============================================
-- Objetivo:
-- 1) adicionar admin_nivel='juridico';
-- 2) separar helpers de escopo admin (operacional vs juridico);
-- 3) hardening de escrita operacional para impedir mutacoes por juridico;
-- 4) permitir juridico apenas no upload de modelo de contrato via RPC dedicada.

-- ---------------------------------------------------------------
-- Helpers de nivel admin
-- ---------------------------------------------------------------
create or replace function public.app_admin_nivel()
  returns text
  language sql stable
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'admin_nivel', ''),
    'full'
  )
$$;

create or replace function public.app_is_admin_full()
  returns boolean
  language sql stable
as $$
  select public.app_is_admin() and public.app_admin_nivel() = 'full'
$$;

create or replace function public.app_is_admin_operacional()
  returns boolean
  language sql stable
as $$
  select public.app_is_admin() and public.app_admin_nivel() in ('full', 'limitado')
$$;

create or replace function public.app_is_admin_juridico()
  returns boolean
  language sql stable
as $$
  select public.app_is_admin() and public.app_admin_nivel() = 'juridico'
$$;

-- ---------------------------------------------------------------
-- RPC: admin_set_admin_nivel (agora aceita juridico)
-- ---------------------------------------------------------------
create or replace function public.admin_set_admin_nivel(
  p_user_id uuid,
  p_nivel   text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role   text;
  v_before text;
begin
  if not public.app_is_admin_full() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'p_user_id_obrigatorio';
  end if;

  if coalesce(p_nivel, '') not in ('full', 'limitado', 'juridico') then
    raise exception 'nivel_invalido' using hint = 'use full, limitado ou juridico';
  end if;

  select coalesce(u.raw_app_meta_data ->> 'role', '')
    into v_role
    from auth.users u
   where u.id = p_user_id;

  if not found then
    raise exception 'usuario_nao_encontrado' using errcode = 'P0002';
  end if;

  if v_role <> 'admin' then
    raise exception 'alvo_nao_e_admin';
  end if;

  v_before := coalesce(
    (select u.raw_app_meta_data ->> 'admin_nivel' from auth.users u where u.id = p_user_id),
    'full'
  );

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('admin_nivel', p_nivel)
   where id = p_user_id;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_antes, payload_depois)
  values (
    auth.uid(),
    'admin_nivel_alterado',
    'auth.users',
    p_user_id,
    jsonb_build_object('admin_nivel', v_before),
    jsonb_build_object('admin_nivel', p_nivel)
  );

  return jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'admin_nivel', p_nivel
  );
end;
$$;

revoke all on function public.admin_set_admin_nivel(uuid, text) from public;
grant execute on function public.admin_set_admin_nivel(uuid, text) to authenticated;

-- ---------------------------------------------------------------
-- Hardening de RLS: escrita administrativa apenas operacional.
-- Juridico permanece com leitura para operacao assistida.
-- ---------------------------------------------------------------

-- propostas / originacao
DROP POLICY IF EXISTS "admin_full_propostas" ON public.propostas;
CREATE POLICY "admin_full_propostas" ON public.propostas
  FOR ALL USING (public.app_is_admin_operacional()) WITH CHECK (public.app_is_admin_operacional());
DROP POLICY IF EXISTS "admin_read_propostas" ON public.propostas;
CREATE POLICY "admin_read_propostas" ON public.propostas
  FOR SELECT USING (public.app_is_admin());

DROP POLICY IF EXISTS "admin_full_proponentes" ON public.proponentes;
CREATE POLICY "admin_full_proponentes" ON public.proponentes
  FOR ALL USING (public.app_is_admin_operacional()) WITH CHECK (public.app_is_admin_operacional());
DROP POLICY IF EXISTS "admin_read_proponentes" ON public.proponentes;
CREATE POLICY "admin_read_proponentes" ON public.proponentes
  FOR SELECT USING (public.app_is_admin());

DROP POLICY IF EXISTS "admin_full_imoveis" ON public.imoveis;
CREATE POLICY "admin_full_imoveis" ON public.imoveis
  FOR ALL USING (public.app_is_admin_operacional()) WITH CHECK (public.app_is_admin_operacional());
DROP POLICY IF EXISTS "admin_read_imoveis" ON public.imoveis;
CREATE POLICY "admin_read_imoveis" ON public.imoveis
  FOR SELECT USING (public.app_is_admin());

DROP POLICY IF EXISTS "admin_full_prop_docs" ON public.proposta_documentos;
CREATE POLICY "admin_full_prop_docs" ON public.proposta_documentos
  FOR ALL USING (public.app_is_admin_operacional()) WITH CHECK (public.app_is_admin_operacional());
DROP POLICY IF EXISTS "admin_read_prop_docs" ON public.proposta_documentos;
CREATE POLICY "admin_read_prop_docs" ON public.proposta_documentos
  FOR SELECT USING (public.app_is_admin());

DROP POLICY IF EXISTS "admin_full_pendencias" ON public.proposta_pendencias;
CREATE POLICY "admin_full_pendencias" ON public.proposta_pendencias
  FOR ALL USING (public.app_is_admin_operacional()) WITH CHECK (public.app_is_admin_operacional());
DROP POLICY IF EXISTS "admin_read_pendencias" ON public.proposta_pendencias;
CREATE POLICY "admin_read_pendencias" ON public.proposta_pendencias
  FOR SELECT USING (public.app_is_admin());

-- contratos / financeiro operacional
DROP POLICY IF EXISTS "admin_full_contratos" ON public.contratos;
CREATE POLICY "admin_full_contratos" ON public.contratos
  FOR ALL USING (public.app_is_admin_operacional()) WITH CHECK (public.app_is_admin_operacional());
DROP POLICY IF EXISTS "admin_read_contratos" ON public.contratos;
CREATE POLICY "admin_read_contratos" ON public.contratos
  FOR SELECT USING (public.app_is_admin());

DROP POLICY IF EXISTS "admin_full_assinaturas" ON public.assinaturas_contrato;
CREATE POLICY "admin_full_assinaturas" ON public.assinaturas_contrato
  FOR ALL USING (public.app_is_admin_operacional()) WITH CHECK (public.app_is_admin_operacional());
DROP POLICY IF EXISTS "admin_read_assinaturas" ON public.assinaturas_contrato;
CREATE POLICY "admin_read_assinaturas" ON public.assinaturas_contrato
  FOR SELECT USING (public.app_is_admin());

DROP POLICY IF EXISTS "admin_full_liberacoes" ON public.liberacoes_recurso;
CREATE POLICY "admin_full_liberacoes" ON public.liberacoes_recurso
  FOR ALL USING (public.app_is_admin_operacional()) WITH CHECK (public.app_is_admin_operacional());
DROP POLICY IF EXISTS "admin_read_liberacoes" ON public.liberacoes_recurso;
CREATE POLICY "admin_read_liberacoes" ON public.liberacoes_recurso
  FOR SELECT USING (public.app_is_admin());

DROP POLICY IF EXISTS "admin_full_comissoes" ON public.comissoes;
CREATE POLICY "admin_full_comissoes" ON public.comissoes
  FOR ALL USING (public.app_is_admin_operacional()) WITH CHECK (public.app_is_admin_operacional());
DROP POLICY IF EXISTS "admin_read_comissoes" ON public.comissoes;
CREATE POLICY "admin_read_comissoes" ON public.comissoes
  FOR SELECT USING (public.app_is_admin());

-- fundos
DROP POLICY IF EXISTS "admin_full_fundos" ON public.fundos;
CREATE POLICY "admin_full_fundos" ON public.fundos
  FOR ALL USING (public.app_is_admin_operacional()) WITH CHECK (public.app_is_admin_operacional());
DROP POLICY IF EXISTS "admin_read_fundos" ON public.fundos;
CREATE POLICY "admin_read_fundos" ON public.fundos
  FOR SELECT USING (public.app_is_admin());

DROP POLICY IF EXISTS "admin_full_proposta_fundos" ON public.proposta_fundos;
CREATE POLICY "admin_full_proposta_fundos" ON public.proposta_fundos
  FOR ALL USING (public.app_is_admin_operacional()) WITH CHECK (public.app_is_admin_operacional());
DROP POLICY IF EXISTS "admin_read_proposta_fundos" ON public.proposta_fundos;
CREATE POLICY "admin_read_proposta_fundos" ON public.proposta_fundos
  FOR SELECT USING (public.app_is_admin());

-- requisitos de documentos
DROP POLICY IF EXISTS "admin_full_doc_requisitos" ON public.documento_requisitos;
CREATE POLICY "admin_full_doc_requisitos" ON public.documento_requisitos
  FOR ALL USING (public.app_is_admin_operacional()) WITH CHECK (public.app_is_admin_operacional());

-- modelos de contrato
DROP POLICY IF EXISTS "admin_full_contrato_modelos" ON public.proposta_contrato_modelos;
CREATE POLICY "admin_full_contrato_modelos" ON public.proposta_contrato_modelos
  FOR ALL USING (public.app_is_admin_operacional()) WITH CHECK (public.app_is_admin_operacional());
DROP POLICY IF EXISTS "admin_read_contrato_modelos" ON public.proposta_contrato_modelos;
CREATE POLICY "admin_read_contrato_modelos" ON public.proposta_contrato_modelos
  FOR SELECT USING (public.app_is_admin());

-- ---------------------------------------------------------------
-- RPCs de escrita operacional
-- ---------------------------------------------------------------
create or replace function public.admin_set_proposta_status(
  p_id uuid,
  p_status proposta_status,
  p_motivo text default null
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_old proposta_status;
begin
  if not public.app_is_admin_operacional() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select status into v_old from propostas where id = p_id;
  if v_old is null then
    raise exception 'proposta not found' using errcode = 'P0002';
  end if;

  if v_old = p_status then
    return;
  end if;

  update propostas set status = p_status, updated_at = now() where id = p_id;

  if p_motivo is not null and length(btrim(p_motivo)) > 0 then
    update proposta_status_historico
       set motivo = p_motivo
     where id = (
       select id from proposta_status_historico
        where proposta_id = p_id
          and status_novo = p_status
        order by created_at desc
        limit 1
     );
  end if;
end;
$$;

revoke all on function public.admin_set_proposta_status(uuid, proposta_status, text) from public;
grant execute on function public.admin_set_proposta_status(uuid, proposta_status, text) to authenticated;

create or replace function public.admin_set_documento_validado(
  p_id uuid,
  p_validado boolean
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not public.app_is_admin_operacional() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update proposta_documentos
     set validado = p_validado,
         validado_por = case when p_validado then auth.uid() else null end,
         validado_em = case when p_validado then now() else null end
   where id = p_id;
end;
$$;

revoke all on function public.admin_set_documento_validado(uuid, boolean) from public;
grant execute on function public.admin_set_documento_validado(uuid, boolean) to authenticated;

create or replace function public.admin_fundo_upsert(
  p_id    uuid,
  p_nome  text,
  p_cor   text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_nome text := btrim(coalesce(p_nome, ''));
  v_cor  text := btrim(coalesce(p_cor, ''));
begin
  if not public.app_is_admin_operacional() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if length(v_nome) < 2 then
    raise exception 'nome_invalido' using errcode = '22023';
  end if;

  if v_cor !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'cor_invalida' using errcode = '22023', hint = 'use #RRGGBB';
  end if;

  begin
    if p_id is null then
      insert into public.fundos (nome, cor_hex, created_by)
      values (v_nome, v_cor, auth.uid())
      returning id into v_id;
    else
      update public.fundos
         set nome = v_nome,
             cor_hex = v_cor
       where id = p_id
      returning id into v_id;

      if v_id is null then
        raise exception 'fundo_nao_encontrado' using errcode = 'P0002';
      end if;
    end if;
  exception when unique_violation then
    raise exception 'fundo_nome_duplicado' using errcode = '23505';
  end;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (
    auth.uid(),
    case when p_id is null then 'fundo_criado' else 'fundo_atualizado' end,
    'fundos',
    v_id,
    jsonb_build_object('nome', v_nome, 'cor_hex', v_cor)
  );

  return v_id;
end;
$$;

revoke all on function public.admin_fundo_upsert(uuid, text, text) from public;
grant execute on function public.admin_fundo_upsert(uuid, text, text) to authenticated;

create or replace function public.admin_fundo_toggle_ativo(
  p_id     uuid,
  p_ativo  boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.app_is_admin_operacional() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.fundos
     set ativo = coalesce(p_ativo, true)
   where id = p_id
  returning id into v_id;

  if v_id is null then
    raise exception 'fundo_nao_encontrado' using errcode = 'P0002';
  end if;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (auth.uid(), 'fundo_ativo_alterado', 'fundos', v_id, jsonb_build_object('ativo', coalesce(p_ativo, true)));
end;
$$;

revoke all on function public.admin_fundo_toggle_ativo(uuid, boolean) from public;
grant execute on function public.admin_fundo_toggle_ativo(uuid, boolean) to authenticated;

create or replace function public.admin_proposta_fundo_set(
  p_proposta_id  uuid,
  p_fundo_id     uuid,
  p_status       public.fundo_status default 'aguardando',
  p_obs          text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.app_is_admin_operacional() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.propostas p where p.id = p_proposta_id) then
    raise exception 'proposta_nao_encontrada' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.fundos f where f.id = p_fundo_id) then
    raise exception 'fundo_nao_encontrado' using errcode = 'P0002';
  end if;

  insert into public.proposta_fundos (proposta_id, fundo_id, status_fundo, observacao, atribuido_por)
  values (p_proposta_id, p_fundo_id, coalesce(p_status, 'aguardando'), nullif(btrim(coalesce(p_obs, '')), ''), auth.uid())
  on conflict (proposta_id, fundo_id) do update
     set status_fundo = excluded.status_fundo,
         observacao   = excluded.observacao,
         atribuido_por = auth.uid();

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (
    auth.uid(),
    'proposta_fundo_set',
    'proposta_fundos',
    p_proposta_id,
    jsonb_build_object('fundo_id', p_fundo_id, 'status_fundo', coalesce(p_status, 'aguardando'))
  );
end;
$$;

revoke all on function public.admin_proposta_fundo_set(uuid, uuid, public.fundo_status, text) from public;
grant execute on function public.admin_proposta_fundo_set(uuid, uuid, public.fundo_status, text) to authenticated;

create or replace function public.admin_proposta_fundo_remove(
  p_proposta_id  uuid,
  p_fundo_id     uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.app_is_admin_operacional() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.proposta_fundos
   where proposta_id = p_proposta_id
     and fundo_id = p_fundo_id;

  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'atribuicao_nao_encontrada' using errcode = 'P0002';
  end if;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_antes)
  values (
    auth.uid(),
    'proposta_fundo_removido',
    'proposta_fundos',
    p_proposta_id,
    jsonb_build_object('fundo_id', p_fundo_id)
  );
end;
$$;

revoke all on function public.admin_proposta_fundo_remove(uuid, uuid) from public;
grant execute on function public.admin_proposta_fundo_remove(uuid, uuid) to authenticated;

create or replace function public.proposta_documentos_seed(p_proposta_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pessoa_cat text;
  v_count      int := 0;
  v_ins        int;
begin
  if not (
    public.app_is_admin_operacional()
    or exists (
      select 1 from public.propostas p
       where p.id = p_proposta_id
         and (
           p.partner_id = public.app_partner_id()
           or p.equipe_id = public.app_equipe_id()
           or p.cliente_id in (select c.id from public.clientes c where c.usuario_id = auth.uid())
         )
    )
  ) then
    return 0;
  end if;

  if not exists (select 1 from public.propostas where id = p_proposta_id) then
    return 0;
  end if;

  insert into public.proposta_documentos (proposta_id, categoria, tipo, storage_path, status)
  select p_proposta_id, r.categoria, r.tipo, null, 'pendente'
    from public.documento_requisitos r
   where r.categoria = 'imovel'
     and not exists (
       select 1 from public.proposta_documentos d
        where d.proposta_id = p_proposta_id and d.categoria = r.categoria and d.tipo = r.tipo
     );
  get diagnostics v_ins = row_count;
  v_count := v_count + v_ins;

  select case when pr.pessoa_tipo = 'PJ' then 'pessoa_juridica' else 'pessoa_fisica' end
    into v_pessoa_cat
    from public.proponentes pr
   where pr.proposta_id = p_proposta_id
   order by pr.principal desc, pr.created_at asc
   limit 1;

  if v_pessoa_cat is not null then
    insert into public.proposta_documentos (proposta_id, categoria, tipo, storage_path, status)
    select p_proposta_id, r.categoria, r.tipo, null, 'pendente'
      from public.documento_requisitos r
     where r.categoria = v_pessoa_cat
       and not exists (
         select 1 from public.proposta_documentos d
          where d.proposta_id = p_proposta_id and d.categoria = r.categoria and d.tipo = r.tipo
       );
    get diagnostics v_ins = row_count;
    v_count := v_count + v_ins;
  end if;

  return v_count;
end;
$$;

revoke all on function public.proposta_documentos_seed(uuid) from public;
grant execute on function public.proposta_documentos_seed(uuid) to authenticated;

create or replace function public.contrato_gerar(
  p_proposta_id uuid,
  p_pdf_path    text,
  p_corpo_html  text,
  p_signatarios jsonb
)
returns contratos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role     text := public.app_user_role();
  v_proposta propostas%rowtype;
  v_contrato contratos%rowtype;
  v_versao   int;
  v_sig      jsonb;
  v_idx      int := 1;
begin
  if v_role not in ('partner','admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_role = 'admin' and not public.app_is_admin_operacional() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_proposta from propostas where id = p_proposta_id for update;
  if not found then
    raise exception 'proposta_nao_encontrada';
  end if;

  if v_role = 'partner' and v_proposta.partner_id <> public.app_partner_id() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_proposta.status <> 'emissao_contrato' then
    raise exception 'status_invalido' using detail =
      format('proposta deve estar em emissao_contrato (atual: %s)', v_proposta.status);
  end if;

  if p_signatarios is null or jsonb_typeof(p_signatarios) <> 'array' or jsonb_array_length(p_signatarios) = 0 then
    raise exception 'signatarios_invalidos';
  end if;

  select coalesce(max(versao), 0) + 1 into v_versao
    from contratos where proposta_id = p_proposta_id;

  insert into contratos (
    proposta_id, pdf_storage_path, corpo_html, versao,
    gerado_por, gerado_em
  ) values (
    p_proposta_id, p_pdf_path, p_corpo_html, v_versao,
    auth.uid(), now()
  )
  on conflict (proposta_id) do update set
    pdf_storage_path = excluded.pdf_storage_path,
    corpo_html       = excluded.corpo_html,
    versao           = excluded.versao,
    gerado_por       = excluded.gerado_por,
    gerado_em        = excluded.gerado_em,
    provedor_assinatura = null,
    provider_envelope_id = null,
    assinado_em      = null,
    registrado_em    = null,
    updated_at       = now()
  returning * into v_contrato;

  delete from assinaturas_contrato where contrato_id = v_contrato.id;

  for v_sig in select * from jsonb_array_elements(p_signatarios)
  loop
    insert into assinaturas_contrato (
      contrato_id, signatario_nome, signatario_email,
      signatario_cpf_cnpj, papel, ordem
    ) values (
      v_contrato.id,
      coalesce(v_sig->>'nome', 'Signatário'),
      coalesce(v_sig->>'email', ''),
      v_sig->>'cpf',
      coalesce(v_sig->>'papel', 'tomador'),
      coalesce((v_sig->>'ordem')::int, v_idx)
    );
    v_idx := v_idx + 1;
  end loop;

  update propostas set status = 'aguardando_assinatura', updated_at = now()
   where id = p_proposta_id;

  return v_contrato;
end;
$$;

revoke all on function public.contrato_gerar(uuid, text, text, jsonb) from public;
grant execute on function public.contrato_gerar(uuid, text, text, jsonb) to authenticated;

create or replace function public.contrato_registrar(
  p_contrato_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposta_id uuid;
begin
  if not public.app_is_admin_operacional() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update contratos
     set registrado_em = coalesce(registrado_em, now()),
         updated_at = now()
   where id = p_contrato_id
   returning proposta_id into v_proposta_id;

  if v_proposta_id is null then
    raise exception 'contrato_nao_encontrado';
  end if;

  update propostas
     set status = 'contrato_registrado', updated_at = now()
   where id = v_proposta_id;
end;
$$;

grant execute on function public.contrato_registrar(uuid) to authenticated;

create or replace function public.liberacao_registrar(
  p_proposta_id   uuid,
  p_valor         numeric,
  p_data          date,
  p_comprovante   text default null,
  p_observacao    text default null
)
returns liberacoes_recurso
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposta propostas%rowtype;
  v_lib      liberacoes_recurso%rowtype;
begin
  if not public.app_is_admin_operacional() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'valor_invalido';
  end if;

  select * into v_proposta from propostas where id = p_proposta_id for update;
  if not found then
    raise exception 'proposta_nao_encontrada';
  end if;
  if v_proposta.status not in ('contrato_registrado','em_registro') then
    raise exception 'status_invalido' using detail =
      format('proposta deve estar em contrato_registrado (atual: %s)', v_proposta.status);
  end if;

  insert into liberacoes_recurso (
    proposta_id, valor_liberado, data_liberacao,
    comprovante_storage_path, criado_por, observacao
  ) values (
    p_proposta_id, p_valor, p_data, p_comprovante, auth.uid(), p_observacao
  ) returning * into v_lib;

  update propostas
     set status = 'recurso_liberado', updated_at = now()
   where id = p_proposta_id;

  return v_lib;
end;
$$;

grant execute on function public.liberacao_registrar(uuid, numeric, date, text, text) to authenticated;

create or replace function public.comissao_aprovar(
  p_comissao_id uuid,
  p_observacao  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.app_is_admin_operacional() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update comissoes
     set status = 'aprovada',
         aprovada_em = coalesce(aprovada_em, now()),
         observacao = coalesce(p_observacao, observacao)
   where id = p_comissao_id
     and status = 'prevista';
end;
$$;

create or replace function public.comissao_marcar_paga(
  p_comissao_id uuid,
  p_data        date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.app_is_admin_operacional() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update comissoes
     set status = 'paga',
         paga_em = coalesce(p_data::timestamptz, now())
   where id = p_comissao_id
     and status in ('prevista','aprovada');
end;
$$;

grant execute on function public.comissao_aprovar(uuid, text) to authenticated;
grant execute on function public.comissao_marcar_paga(uuid, date) to authenticated;

-- ---------------------------------------------------------------
-- Modelos de contrato: juridico pode adicionar, apenas operacional remove.
-- ---------------------------------------------------------------
create or replace function public.proposta_contrato_modelo_add(
  p_proposta_id  uuid,
  p_storage_path text,
  p_nome_arquivo text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not (public.app_is_admin_operacional() or public.app_is_admin_juridico()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.propostas where id = p_proposta_id) then
    raise exception 'proposta_nao_encontrada' using errcode = 'P0002';
  end if;

  if length(coalesce(btrim(p_storage_path), '')) = 0 then
    raise exception 'storage_path_obrigatorio' using errcode = '22023';
  end if;

  if split_part(p_storage_path, '/', 1) <> p_proposta_id::text then
    raise exception 'storage_path_invalido' using errcode = '22023', hint = 'path deve iniciar com {proposta_id}/';
  end if;

  insert into public.proposta_contrato_modelos (proposta_id, storage_path, nome_arquivo, enviado_por)
  values (p_proposta_id, btrim(p_storage_path), coalesce(nullif(btrim(p_nome_arquivo), ''), 'modelo'), auth.uid())
  returning id into v_id;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (auth.uid(), 'contrato_modelo_adicionado', 'proposta_contrato_modelos', v_id,
          jsonb_build_object('proposta_id', p_proposta_id, 'nome_arquivo', p_nome_arquivo));

  return v_id;
end;
$$;

revoke all on function public.proposta_contrato_modelo_add(uuid, text, text) from public;
grant execute on function public.proposta_contrato_modelo_add(uuid, text, text) to authenticated;

create or replace function public.proposta_contrato_modelo_remove(
  p_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
begin
  if not public.app_is_admin_operacional() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.proposta_contrato_modelos
   where id = p_id
  returning storage_path into v_path;

  if v_path is null then
    raise exception 'modelo_nao_encontrado' using errcode = 'P0002';
  end if;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_antes)
  values (auth.uid(), 'contrato_modelo_removido', 'proposta_contrato_modelos', p_id,
          jsonb_build_object('storage_path', v_path));

  return v_path;
end;
$$;

revoke all on function public.proposta_contrato_modelo_remove(uuid) from public;
grant execute on function public.proposta_contrato_modelo_remove(uuid) to authenticated;
