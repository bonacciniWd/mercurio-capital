-- Mobile onboarding supplements existing identities and proposals. No core proposal
-- status, amount, party identity or Serasa consent is changed by these writes.
create or replace function public.mobile_documento_valido(p_tipo public.pessoa_tipo, p_documento text)
returns boolean language plpgsql immutable set search_path = public, pg_temp
as $$
declare
  i integer;
  soma integer;
  digito integer;
  pesos integer[];
begin
  if p_tipo = 'PF' then
    if p_documento !~ '^[0-9]{11}$' or p_documento ~ '^([0-9])\1{10}$' then return false; end if;
    for i in 1..2 loop
      soma := 0;
      for digito in 1..(8 + i) loop
        soma := soma + substring(p_documento from digito for 1)::integer * (10 + i - digito);
      end loop;
      if (((soma * 10) % 11) % 10) <> substring(p_documento from (9 + i) for 1)::integer then return false; end if;
    end loop;
    return true;
  end if;
  if p_tipo = 'PJ' then
    if p_documento !~ '^[0-9]{14}$' or p_documento ~ '^([0-9])\1{13}$' then return false; end if;
    for i in 1..2 loop
      pesos := case when i = 1 then array[5,4,3,2,9,8,7,6,5,4,3,2] else array[6,5,4,3,2,9,8,7,6,5,4,3,2] end;
      soma := 0;
      for digito in 1..(11 + i) loop
        soma := soma + substring(p_documento from digito for 1)::integer * pesos[digito];
      end loop;
      if (case when soma % 11 < 2 then 0 else 11 - (soma % 11) end)
         <> substring(p_documento from (12 + i) for 1)::integer then return false; end if;
    end loop;
    return true;
  end if;
  return false;
end;
$$;

create table public.proposta_onboarding_respostas (
  proposta_id uuid primary key references public.propostas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  usuario_id uuid references public.usuarios(id) on delete set null,
  pessoa_tipo public.pessoa_tipo not null,
  nome_informado text not null,
  documento_informado text not null,
  email_informado text not null,
  telefone_informado text not null,
  nome_fantasia text,
  ramo_atuacao text,
  cidade text,
  uf char(2),
  faixa_faturamento text,
  objetivo text not null,
  avisos_versao text not null,
  privacidade_versao text not null,
  aceito_em timestamptz not null,
  status_revisao text not null check (status_revisao in ('conferido', 'divergente')),
  enviado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint proposta_onboarding_nome_check check (char_length(trim(nome_informado)) between 2 and 200),
  constraint proposta_onboarding_contato_check check (char_length(trim(email_informado)) between 5 and 320 and char_length(regexp_replace(telefone_informado, '\D', '', 'g')) between 10 and 13),
  constraint proposta_onboarding_tipo_check check (
    (pessoa_tipo = 'PF' and nome_fantasia is null and ramo_atuacao is null and faixa_faturamento is null)
    or pessoa_tipo = 'PJ'
  ),
  constraint proposta_onboarding_documento_check check (public.mobile_documento_valido(pessoa_tipo, documento_informado))
);

create index proposta_onboarding_cliente_idx on public.proposta_onboarding_respostas(cliente_id);
alter table public.proposta_onboarding_respostas enable row level security;
create policy proposta_onboarding_select on public.proposta_onboarding_respostas
  for select to authenticated using (
    usuario_id = auth.uid() or public.app_is_admin()
  );
revoke all on public.proposta_onboarding_respostas from public, anon, authenticated;
grant select on public.proposta_onboarding_respostas to authenticated;

create table public.partner_onboarding_respostas (
  partner_id uuid primary key references public.partners(id) on delete cascade,
  usuario_id uuid references public.usuarios(id) on delete set null,
  organizacao text not null,
  cidade text,
  uf char(2),
  areas_atuacao text[] not null,
  declaracao_versao text not null,
  declarado_em timestamptz not null,
  enviado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint partner_onboarding_organizacao_check check (char_length(trim(organizacao)) between 2 and 200),
  constraint partner_onboarding_areas_check check (cardinality(areas_atuacao) between 1 and 6)
);

alter table public.partner_onboarding_respostas enable row level security;
create policy partner_onboarding_select on public.partner_onboarding_respostas
  for select to authenticated using (usuario_id = auth.uid() or public.app_is_admin());
revoke all on public.partner_onboarding_respostas from public, anon, authenticated;
grant select on public.partner_onboarding_respostas to authenticated;

create or replace function public.mobile_cliente_onboarding_salvar(p_proposta_id uuid, p_resposta jsonb)
returns public.proposta_onboarding_respostas
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_cliente public.clientes%rowtype;
  v_row public.proposta_onboarding_respostas%rowtype;
  v_documento text;
  v_nome text := trim(coalesce(p_resposta->>'nome', ''));
  v_email text := lower(trim(coalesce(p_resposta->>'email', '')));
  v_telefone text := regexp_replace(coalesce(p_resposta->>'telefone', ''), '\D', '', 'g');
  v_divergente boolean;
begin
  if v_uid is null or public.app_user_role() <> 'client' then raise exception 'forbidden' using errcode = '42501'; end if;
  select c.* into v_cliente
  from public.propostas p join public.clientes c on c.id = p.cliente_id
  where p.id = p_proposta_id and c.usuario_id = v_uid;
  if not found then raise exception 'proposta_nao_encontrada' using errcode = '42501'; end if;

  v_documento := regexp_replace(coalesce(p_resposta->>'documento', ''), '\D', '', 'g');
  if char_length(v_nome) < 2 or char_length(v_nome) > 200
     or char_length(v_email) < 5 or char_length(v_email) > 320 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or char_length(v_telefone) not between 10 and 13
     or not public.mobile_documento_valido(v_cliente.pessoa_tipo, v_documento)
     or char_length(trim(coalesce(p_resposta->>'objetivo', ''))) not between 2 and 160
     or char_length(trim(coalesce(p_resposta->>'cidade', ''))) not between 2 and 120
     or upper(trim(coalesce(p_resposta->>'uf', ''))) !~ '^[A-Z]{2}$'
     or (v_cliente.pessoa_tipo = 'PJ' and (
       char_length(trim(coalesce(p_resposta->>'nome_fantasia', ''))) < 2
       or char_length(trim(coalesce(p_resposta->>'ramo_atuacao', ''))) < 2
       or coalesce(p_resposta->>'faixa_faturamento', '') = ''))
     or coalesce(p_resposta->>'avisos_versao', '') = ''
     or coalesce(p_resposta->>'privacidade_versao', '') = ''
     or coalesce((p_resposta->>'aceitou')::boolean, false) is not true then
    raise exception 'dados_invalidos' using errcode = '22023';
  end if;

  v_divergente := (v_cliente.pessoa_tipo = 'PF' and v_cliente.cpf is not null and regexp_replace(v_cliente.cpf, '\D', '', 'g') <> v_documento)
    or (v_cliente.pessoa_tipo = 'PJ' and v_cliente.cnpj is not null and regexp_replace(v_cliente.cnpj, '\D', '', 'g') <> v_documento)
    or lower(trim(coalesce(v_cliente.email, ''))) <> v_email
    or lower(trim(coalesce(case when v_cliente.pessoa_tipo = 'PJ' then v_cliente.razao_social else v_cliente.nome_completo end, ''))) <> lower(v_nome)
    or (v_cliente.telefone is not null and regexp_replace(v_cliente.telefone, '\D', '', 'g') <> v_telefone);

  insert into public.proposta_onboarding_respostas (
    proposta_id, cliente_id, usuario_id, pessoa_tipo, nome_informado, documento_informado,
    email_informado, telefone_informado, nome_fantasia, ramo_atuacao, cidade, uf,
    faixa_faturamento, objetivo, avisos_versao, privacidade_versao, aceito_em,
    status_revisao
  ) values (
    p_proposta_id, v_cliente.id, v_uid, v_cliente.pessoa_tipo, v_nome, v_documento,
    v_email, v_telefone,
    case when v_cliente.pessoa_tipo = 'PJ' then nullif(trim(p_resposta->>'nome_fantasia'), '') else null end,
    case when v_cliente.pessoa_tipo = 'PJ' then nullif(trim(p_resposta->>'ramo_atuacao'), '') else null end,
    nullif(trim(p_resposta->>'cidade'), ''), nullif(upper(trim(p_resposta->>'uf')), '')::char(2),
    case when v_cliente.pessoa_tipo = 'PJ' then nullif(trim(p_resposta->>'faixa_faturamento'), '') else null end,
    trim(p_resposta->>'objetivo'), p_resposta->>'avisos_versao', p_resposta->>'privacidade_versao', now(),
    case when v_divergente then 'divergente' else 'conferido' end
  )
  on conflict (proposta_id) do update set
    nome_informado = excluded.nome_informado, documento_informado = excluded.documento_informado,
    email_informado = excluded.email_informado, telefone_informado = excluded.telefone_informado,
    nome_fantasia = excluded.nome_fantasia, ramo_atuacao = excluded.ramo_atuacao,
    cidade = excluded.cidade, uf = excluded.uf, faixa_faturamento = excluded.faixa_faturamento,
    objetivo = excluded.objetivo, avisos_versao = excluded.avisos_versao,
    privacidade_versao = excluded.privacidade_versao, aceito_em = excluded.aceito_em,
    status_revisao = excluded.status_revisao, atualizado_em = now()
  where public.proposta_onboarding_respostas.cliente_id = excluded.cliente_id
    and public.proposta_onboarding_respostas.usuario_id = excluded.usuario_id
  returning * into v_row;
  if not found then raise exception 'resposta_pertence_a_outro_cliente' using errcode = '42501'; end if;
  return v_row;
end;
$$;
revoke all on function public.mobile_cliente_onboarding_salvar(uuid, jsonb) from public, anon;
grant execute on function public.mobile_cliente_onboarding_salvar(uuid, jsonb) to authenticated;

create or replace function public.mobile_partner_onboarding_salvar(p_resposta jsonb)
returns public.partner_onboarding_respostas
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_partner uuid;
  v_row public.partner_onboarding_respostas%rowtype;
  v_areas text[];
begin
  if v_uid is null or public.app_user_role() <> 'partner' then raise exception 'forbidden' using errcode = '42501'; end if;
  select id into v_partner from public.partners where usuario_id = v_uid;
  if v_partner is null then raise exception 'parceiro_nao_encontrado' using errcode = '42501'; end if;
  select array_agg(value) into v_areas from jsonb_array_elements_text(coalesce(p_resposta->'areas', '[]'::jsonb)) as value;
  if char_length(trim(coalesce(p_resposta->>'organizacao', ''))) not between 2 and 200
    or coalesce(cardinality(v_areas), 0) not between 1 and 6
    or char_length(trim(coalesce(p_resposta->>'cidade', ''))) not between 2 and 120
    or upper(trim(coalesce(p_resposta->>'uf', ''))) !~ '^[A-Z]{2}$'
    or coalesce((p_resposta->>'declarou')::boolean, false) is not true then
    raise exception 'dados_invalidos' using errcode = '22023';
  end if;
  insert into public.partner_onboarding_respostas (
    partner_id, usuario_id, organizacao, cidade, uf, areas_atuacao, declaracao_versao, declarado_em
  ) values (
    v_partner, v_uid, trim(p_resposta->>'organizacao'), nullif(trim(p_resposta->>'cidade'), ''),
    nullif(upper(trim(p_resposta->>'uf')), '')::char(2), v_areas, '2026-11-08', now()
  ) on conflict (partner_id) do update set
    organizacao = excluded.organizacao, cidade = excluded.cidade, uf = excluded.uf,
    areas_atuacao = excluded.areas_atuacao, declaracao_versao = excluded.declaracao_versao,
    declarado_em = excluded.declarado_em, atualizado_em = now()
  where public.partner_onboarding_respostas.usuario_id = excluded.usuario_id
  returning * into v_row;
  if not found then raise exception 'resposta_pertence_a_outro_parceiro' using errcode = '42501'; end if;
  return v_row;
end;
$$;
revoke all on function public.mobile_partner_onboarding_salvar(jsonb) from public, anon;
grant execute on function public.mobile_partner_onboarding_salvar(jsonb) to authenticated;
