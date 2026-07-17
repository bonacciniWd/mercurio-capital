-- =============================================
-- FASE 18 — Rede scoped do parceiro + criação admin para partner pending
-- =============================================

-- =============================================
-- RPC: partner_rede_graph()
-- Retorna somente a rede do partner logado (partner + equipes + contagens)
-- Não aceita partner_id vindo do cliente.
-- =============================================
create or replace function public.partner_rede_graph()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_role           text := public.app_user_role();
  v_partner_id     uuid := public.app_partner_id();
  v_partner_status public.partner_status;
  v_partner_nome   text;
  v_nodes          jsonb := '[]'::jsonb;
  v_edges          jsonb := '[]'::jsonb;
begin
  if v_role <> 'partner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not public.app_is_approved() then
    raise exception 'forbidden: parceiro não aprovado' using errcode = '42501';
  end if;

  if v_partner_id is null then
    raise exception 'forbidden: parceiro inválido' using errcode = '42501';
  end if;

  select p.status, u.nome_completo
    into v_partner_status, v_partner_nome
    from public.partners p
    join public.usuarios u on u.id = p.usuario_id
   where p.id = v_partner_id;

  if not found then
    raise exception 'partner_not_found' using errcode = 'P0001';
  end if;

  v_nodes := v_nodes || jsonb_build_array(
    jsonb_build_object(
      'id', 'partner-' || v_partner_id::text,
      'tipo', 'partner',
      'label', coalesce(v_partner_nome, v_partner_id::text),
      'status', v_partner_status,
      'propostas', (
        select count(*)
          from public.propostas pr
         where pr.partner_id = v_partner_id
      )
    )
  );

  with sel_eq as (
    select
      e.id,
      e.nome,
      (
        select count(*)
          from public.equipe_membros em
         where em.equipe_id = e.id
           and em.aceito_em is not null
           and coalesce(em.permissoes->>'suspenso', 'false') <> 'true'
      ) as membros
    from public.equipes e
    where e.partner_id = v_partner_id
    order by e.created_at
  )
  select
    coalesce(
      v_nodes || jsonb_agg(
        jsonb_build_object(
          'id', 'equipe-' || se.id::text,
          'tipo', 'equipe',
          'label', se.nome,
          'membros', se.membros
        )
      ),
      v_nodes
    ),
    coalesce(
      v_edges || jsonb_agg(
        jsonb_build_object(
          'id', 'e-partner-equipe-' || se.id::text,
          'source', 'partner-' || v_partner_id::text,
          'target', 'equipe-' || se.id::text
        )
      ),
      v_edges
    )
  into v_nodes, v_edges
  from sel_eq se;

  return jsonb_build_object('nodes', v_nodes, 'edges', v_edges);
end;
$$;

revoke all on function public.partner_rede_graph() from public;
grant execute on function public.partner_rede_graph() to authenticated;

-- =============================================
-- RPC: admin_create_proposta(p_partner_id uuid, p_payload jsonb)
-- Ajuste de regra: admin pode criar para partner approved ou pending.
-- Bloqueia rejected/suspended e mantém partner_create_proposta inalterada.
-- =============================================
create or replace function public.admin_create_proposta(
  p_partner_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_partner_status public.partner_status;
  v_cliente_id     uuid;
  v_proposta_id    uuid;
  v_protocolo      text;
  v_cliente_jsonb  jsonb;
  v_cpf            text;
  v_proponente     jsonb;
  v_imovel         jsonb;
  v_token          text;
  v_token_hash     text;
  v_prazo          int;
  v_carencia       int;
  v_valor          numeric;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden: apenas admin pode criar proposta para parceiro'
      using errcode = '42501';
  end if;

  if p_partner_id is null then
    raise exception 'partner_id é obrigatório' using errcode = '22023';
  end if;

  select p.status
    into v_partner_status
    from public.partners p
   where p.id = p_partner_id
   for update;

  if not found then
    raise exception 'partner_not_found' using errcode = 'P0001';
  end if;

  if v_partner_status not in ('approved', 'pending') then
    raise exception 'forbidden: parceiro alvo deve estar pending ou approved'
      using errcode = '42501';
  end if;

  if p_payload->'cliente' is null then
    raise exception 'cliente é obrigatório' using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(p_payload->'proponentes', '[]'::jsonb)) = 0 then
    raise exception 'pelo menos um proponente é obrigatório' using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(p_payload->'imoveis', '[]'::jsonb)) = 0 then
    raise exception 'pelo menos um imóvel é obrigatório' using errcode = '22023';
  end if;

  v_prazo := (p_payload->>'prazo_meses')::int;
  v_carencia := coalesce((p_payload->>'carencia_meses')::int, 0);
  v_valor := (p_payload->>'valor_solicitado')::numeric;

  if v_prazo < 12 or v_prazo > 240 then
    raise exception 'prazo_meses fora da faixa permitida (12..240)' using errcode = '22023';
  end if;

  if v_carencia < 0 or v_carencia > 3 then
    raise exception 'carencia_meses fora da faixa permitida (0..3)' using errcode = '22023';
  end if;

  if coalesce(v_valor, 0) <= 0 then
    raise exception 'valor_solicitado inválido' using errcode = '22023';
  end if;

  v_cliente_jsonb := p_payload->'cliente';
  v_cpf := nullif(v_cliente_jsonb->>'cpf', '');

  if v_cpf is not null then
    select c.id
      into v_cliente_id
      from public.clientes c
     where c.cpf = v_cpf
       and c.pessoa_tipo = 'PF'
     limit 1;
  end if;

  if v_cliente_id is null then
    insert into public.clientes (
      pessoa_tipo,
      nome_completo,
      cpf,
      email,
      telefone,
      data_nascimento,
      estado_civil
    ) values (
      coalesce((p_payload->>'pessoa_tipo')::pessoa_tipo, 'PF'),
      v_cliente_jsonb->>'nome_completo',
      v_cpf,
      nullif(v_cliente_jsonb->>'email', ''),
      nullif(v_cliente_jsonb->>'telefone', ''),
      nullif(v_cliente_jsonb->>'data_nascimento', '')::date,
      nullif(v_cliente_jsonb->>'estado_civil', '')::estado_civil
    )
    returning id into v_cliente_id;
  end if;

  insert into public.propostas (
    partner_id,
    cliente_id,
    produto,
    valor_solicitado,
    prazo_meses,
    carencia_meses,
    taxa_juros_mensal,
    correcao,
    amortizacao,
    indexador
  ) values (
    p_partner_id,
    v_cliente_id,
    (p_payload->>'produto')::produto_tipo,
    v_valor,
    v_prazo,
    v_carencia,
    coalesce((p_payload->>'taxa_juros_mensal')::numeric, 1.29),
    coalesce((p_payload->>'correcao')::correcao_tipo, 'pos_fixado'),
    coalesce((p_payload->>'amortizacao')::amortizacao_tipo, 'price'),
    coalesce(p_payload->>'indexador', 'IPCA')
  )
  returning id, protocolo into v_proposta_id, v_protocolo;

  for v_proponente in select * from jsonb_array_elements(p_payload->'proponentes') loop
    insert into public.proponentes (
      proposta_id,
      cliente_id,
      principal,
      pessoa_tipo,
      nome,
      cpf_cnpj,
      estado_civil,
      relacao,
      dados_complementares
    ) values (
      v_proposta_id,
      case when coalesce((v_proponente->>'principal')::boolean, false) then v_cliente_id else null end,
      coalesce((v_proponente->>'principal')::boolean, false),
      coalesce((v_proponente->>'pessoa_tipo')::pessoa_tipo, 'PF'),
      v_proponente->>'nome',
      nullif(v_proponente->>'cpf_cnpj', ''),
      nullif(v_proponente->>'estado_civil', '')::estado_civil,
      nullif(v_proponente->>'relacao', ''),
      coalesce(v_proponente->'dados_complementares', '{}'::jsonb)
    );
  end loop;

  for v_imovel in select * from jsonb_array_elements(p_payload->'imoveis') loop
    insert into public.imoveis (
      proposta_id,
      tipo,
      cep,
      estado,
      cidade,
      bairro,
      logradouro,
      numero,
      sem_numero,
      complemento,
      valor,
      vagas_garagem,
      alugado,
      valor_aluguel,
      financiado,
      instituicao_financiadora,
      saldo_devedor,
      possui_debitos,
      debitos_iptu,
      debitos_condominio
    ) values (
      v_proposta_id,
      coalesce((v_imovel->>'tipo')::imovel_tipo, 'apartamento'),
      nullif(v_imovel->>'cep', ''),
      nullif(v_imovel->>'estado', '')::char(2),
      nullif(v_imovel->>'cidade', ''),
      nullif(v_imovel->>'bairro', ''),
      nullif(v_imovel->>'logradouro', ''),
      nullif(v_imovel->>'numero', ''),
      coalesce((v_imovel->>'sem_numero')::boolean, false),
      nullif(v_imovel->>'complemento', ''),
      (v_imovel->>'valor')::numeric,
      coalesce((v_imovel->>'vagas_garagem')::int, 0),
      coalesce((v_imovel->>'alugado')::boolean, false),
      case when coalesce((v_imovel->>'alugado')::boolean, false)
           then nullif(v_imovel->>'valor_aluguel', '0')::numeric else null end,
      coalesce((v_imovel->>'financiado')::boolean, false),
      case when coalesce((v_imovel->>'financiado')::boolean, false)
           then nullif(v_imovel->>'instituicao_financiadora', '') else null end,
      case when coalesce((v_imovel->>'financiado')::boolean, false)
           then nullif(v_imovel->>'saldo_devedor', '0')::numeric else null end,
      coalesce((v_imovel->>'possui_debitos')::boolean, false),
      case when coalesce((v_imovel->>'possui_debitos')::boolean, false)
           then nullif(v_imovel->>'debitos_iptu', '0')::numeric else null end,
      case when coalesce((v_imovel->>'possui_debitos')::boolean, false)
           then nullif(v_imovel->>'debitos_condominio', '0')::numeric else null end
    );
  end loop;

  v_token := public.gen_magic_token(40);
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  insert into public.magic_links (token_hash, finalidade, payload, expires_at)
  values (
    v_token_hash,
    'cliente_ativacao',
    jsonb_build_object('proposta_id', v_proposta_id, 'cliente_id', v_cliente_id),
    now() + interval '30 minutes'
  );

  return jsonb_build_object(
    'proposta_id', v_proposta_id,
    'protocolo', v_protocolo,
    'cliente_id', v_cliente_id,
    'magic_token', v_token
  );
end;
$$;

revoke all on function public.admin_create_proposta(uuid, jsonb) from public;
grant execute on function public.admin_create_proposta(uuid, jsonb) to authenticated;
