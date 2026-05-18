-- =============================================
-- MIGRATION 012 — RPC partner_create_proposta + cliente_consume_magic
-- =============================================
-- RPCs que cobrem o fluxo wizard → proposta criada → magic link enviado ao cliente.
-- Mantém criação atômica (proposta + proponentes + imóveis + cliente + magic_link).

create extension if not exists pgcrypto with schema extensions;

-- Helper: gera token alfanumérico legível para magic link de proposta.
create or replace function public.gen_magic_token(p_len int default 32)
  returns text language plpgsql volatile as $$
declare
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz';
  v_out   text := '';
  i int;
begin
  for i in 1..p_len loop
    v_out := v_out || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
  end loop;
  return v_out;
end;
$$;

-- =============================================
-- RPC: partner_create_proposta(p_payload jsonb) returns jsonb
-- =============================================
-- Payload esperado:
-- {
--   "produto": "home_equity" | "credito_construcao" | "financiamento_imobiliario",
--   "pessoa_tipo": "PF" | "PJ",
--   "valor_solicitado": 350000,
--   "prazo_meses": 120,
--   "carencia_meses": 0,
--   "taxa_juros_mensal": 1.39,
--   "correcao": "pos_fixado" | "pre_fixado",
--   "amortizacao": "price" | "sac",
--   "indexador": "IPCA",
--   "cliente": {
--     "nome_completo": "...", "cpf": "...", "email": "...", "telefone": "...",
--     "data_nascimento": "1980-01-01", "estado_civil": "casado"
--   },
--   "proponentes": [
--     { "nome": "...", "cpf_cnpj": "...", "principal": true, "relacao": null, "estado_civil": "casado" },
--     { "nome": "...", "cpf_cnpj": "...", "principal": false, "relacao": "conjuge" }
--   ],
--   "imoveis": [
--     {
--       "tipo": "apartamento", "cep": "...", "estado": "SP", "cidade": "...",
--       "bairro": "...", "logradouro": "...", "numero": "...", "complemento": "...",
--       "valor": 850000, "vagas_garagem": 2,
--       "alugado": false, "financiado": false, "possui_debitos": false
--     }
--   ]
-- }
--
-- Retorno:
-- {
--   "proposta_id": "...",
--   "protocolo": "MERC-2026-000001",
--   "cliente_id": "...",
--   "magic_token": "..." -- plaintext, exibido UMA vez para o parceiro encaminhar
-- }
create or replace function public.partner_create_proposta(p_payload jsonb)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_partner_id    uuid;
  v_role          text;
  v_cliente_id    uuid;
  v_proposta_id   uuid;
  v_protocolo     text;
  v_cliente_jsonb jsonb;
  v_cpf           text;
  v_proponente    jsonb;
  v_principal_id  uuid;
  v_imovel        jsonb;
  v_imovel_id     uuid;
  v_token         text;
  v_token_hash    text;
begin
  -- Permissão
  v_role := public.app_user_role();
  if v_role not in ('partner','team_member') then
    raise exception 'forbidden: apenas parceiros podem criar propostas' using errcode = '42501';
  end if;
  if not public.app_is_approved() then
    raise exception 'forbidden: parceiro não aprovado' using errcode = '42501';
  end if;
  v_partner_id := public.app_partner_id();
  if v_partner_id is null then
    raise exception 'forbidden: parceiro inválido' using errcode = '42501';
  end if;

  -- Validação mínima
  if p_payload->'cliente' is null then
    raise exception 'cliente é obrigatório' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_payload->'proponentes','[]'::jsonb)) = 0 then
    raise exception 'pelo menos um proponente é obrigatório' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_payload->'imoveis','[]'::jsonb)) = 0 then
    raise exception 'pelo menos um imóvel é obrigatório' using errcode = '22023';
  end if;

  v_cliente_jsonb := p_payload->'cliente';
  v_cpf := nullif(v_cliente_jsonb->>'cpf','');

  -- Upsert cliente por CPF (se houver)
  if v_cpf is not null then
    select id into v_cliente_id from clientes where cpf = v_cpf and pessoa_tipo = 'PF' limit 1;
  end if;

  if v_cliente_id is null then
    insert into clientes (
      pessoa_tipo, nome_completo, cpf, email, telefone, data_nascimento, estado_civil
    ) values (
      coalesce((p_payload->>'pessoa_tipo')::pessoa_tipo, 'PF'),
      v_cliente_jsonb->>'nome_completo',
      v_cpf,
      nullif(v_cliente_jsonb->>'email',''),
      nullif(v_cliente_jsonb->>'telefone',''),
      nullif(v_cliente_jsonb->>'data_nascimento','')::date,
      nullif(v_cliente_jsonb->>'estado_civil','')::estado_civil
    ) returning id into v_cliente_id;
  end if;

  -- Insere proposta (trigger gera o protocolo)
  insert into propostas (
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
    v_partner_id,
    v_cliente_id,
    (p_payload->>'produto')::produto_tipo,
    (p_payload->>'valor_solicitado')::numeric,
    (p_payload->>'prazo_meses')::int,
    coalesce((p_payload->>'carencia_meses')::int, 0),
    coalesce((p_payload->>'taxa_juros_mensal')::numeric, 1.39),
    coalesce((p_payload->>'correcao')::correcao_tipo, 'pos_fixado'),
    coalesce((p_payload->>'amortizacao')::amortizacao_tipo, 'price'),
    coalesce(p_payload->>'indexador', 'IPCA')
  ) returning id, protocolo into v_proposta_id, v_protocolo;

  -- Proponentes
  for v_proponente in select * from jsonb_array_elements(p_payload->'proponentes') loop
    insert into proponentes (
      proposta_id, cliente_id, principal, pessoa_tipo, nome, cpf_cnpj,
      estado_civil, relacao, dados_complementares
    ) values (
      v_proposta_id,
      case when coalesce((v_proponente->>'principal')::boolean, false) then v_cliente_id else null end,
      coalesce((v_proponente->>'principal')::boolean, false),
      coalesce((v_proponente->>'pessoa_tipo')::pessoa_tipo, 'PF'),
      v_proponente->>'nome',
      nullif(v_proponente->>'cpf_cnpj',''),
      nullif(v_proponente->>'estado_civil','')::estado_civil,
      nullif(v_proponente->>'relacao',''),
      coalesce(v_proponente->'dados_complementares','{}'::jsonb)
    )
    returning id into v_principal_id;
  end loop;

  -- Imóveis
  for v_imovel in select * from jsonb_array_elements(p_payload->'imoveis') loop
    insert into imoveis (
      proposta_id, tipo, cep, estado, cidade, bairro, logradouro, numero, sem_numero,
      complemento, valor, vagas_garagem, alugado, financiado, possui_debitos
    ) values (
      v_proposta_id,
      coalesce((v_imovel->>'tipo')::imovel_tipo, 'apartamento'),
      nullif(v_imovel->>'cep',''),
      nullif(v_imovel->>'estado','')::char(2),
      nullif(v_imovel->>'cidade',''),
      nullif(v_imovel->>'bairro',''),
      nullif(v_imovel->>'logradouro',''),
      nullif(v_imovel->>'numero',''),
      coalesce((v_imovel->>'sem_numero')::boolean, false),
      nullif(v_imovel->>'complemento',''),
      (v_imovel->>'valor')::numeric,
      coalesce((v_imovel->>'vagas_garagem')::int, 0),
      coalesce((v_imovel->>'alugado')::boolean, false),
      coalesce((v_imovel->>'financiado')::boolean, false),
      coalesce((v_imovel->>'possui_debitos')::boolean, false)
    ) returning id into v_imovel_id;
  end loop;

  -- Magic link de ativação do cliente (validade 7 dias)
  v_token := public.gen_magic_token(40);
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  insert into magic_links (token_hash, finalidade, payload, expires_at)
  values (
    v_token_hash,
    'cliente_ativacao',
    jsonb_build_object('proposta_id', v_proposta_id, 'cliente_id', v_cliente_id),
    now() + interval '7 days'
  );

  return jsonb_build_object(
    'proposta_id', v_proposta_id,
    'protocolo', v_protocolo,
    'cliente_id', v_cliente_id,
    'magic_token', v_token
  );
end;
$$;

revoke all on function public.partner_create_proposta(jsonb) from public;
grant execute on function public.partner_create_proposta(jsonb) to authenticated;

-- =============================================
-- RPC: cliente_consume_magic(p_token text) — usado pelo portal /magic/:token
-- =============================================
-- Valida token, marca como usado, vincula cliente ao usuário autenticado se aplicável,
-- e retorna proposta_id + protocolo.
create or replace function public.cliente_consume_magic(p_token text)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_hash         text;
  v_link         magic_links;
  v_cliente_id   uuid;
  v_proposta_id  uuid;
  v_protocolo    text;
  v_uid          uuid;
begin
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select * into v_link from magic_links
    where token_hash = v_hash
      and used_at is null
      and expires_at > now()
      and finalidade = 'cliente_ativacao'
    limit 1;

  if v_link.id is null then
    raise exception 'token inválido ou expirado' using errcode = 'P0001';
  end if;

  v_cliente_id  := (v_link.payload->>'cliente_id')::uuid;
  v_proposta_id := (v_link.payload->>'proposta_id')::uuid;

  update magic_links set used_at = now() where id = v_link.id;

  -- Se já autenticado (usuário existente), vincula cliente ao usuario_id
  v_uid := auth.uid();
  if v_uid is not null then
    update clientes set usuario_id = v_uid where id = v_cliente_id and usuario_id is null;
  end if;

  select protocolo into v_protocolo from propostas where id = v_proposta_id;

  return jsonb_build_object(
    'proposta_id', v_proposta_id,
    'cliente_id',  v_cliente_id,
    'protocolo',   v_protocolo
  );
end;
$$;

revoke all on function public.cliente_consume_magic(text) from public;
grant execute on function public.cliente_consume_magic(text) to authenticated, anon;
