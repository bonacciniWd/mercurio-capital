-- =============================================
-- MIGRATION 003 — ORIGINAÇÃO (PROPOSTAS)
-- =============================================

-- =============================================
-- SIMULACOES
-- =============================================

create table simulacoes (
  id                        uuid primary key default gen_random_uuid(),
  partner_id                uuid not null references partners(id) on delete restrict,
  equipe_id                 uuid references equipes(id) on delete set null,
  responsavel_id            uuid references usuarios(id) on delete set null,
  produto                   produto_tipo not null,
  pessoa_tipo               pessoa_tipo not null default 'PF',
  cliente_nome              text not null,
  cliente_cpf               text,
  cliente_email             text,
  cliente_telefone          text,
  imovel_estado             char(2),
  imovel_cidade             text,
  imovel_bairro             text,
  imovel_cep                text,
  valor_credito             numeric(14,2) not null,
  valor_imovel              numeric(14,2) not null,
  correcao                  correcao_tipo not null default 'pos_fixado',
  amortizacao               amortizacao_tipo not null default 'price',
  prazo_meses               int not null check (prazo_meses between 12 and 240),
  carencia_meses            int not null default 0 check (carencia_meses between 0 and 3),
  taxa_juros_mensal         numeric(6,4) not null default 1.39,
  convertida_em_proposta_id uuid, -- FK adicionada após criação de propostas
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index simulacoes_partner_idx on simulacoes (partner_id, created_at desc);
create index simulacoes_equipe_idx  on simulacoes (equipe_id);

alter table simulacoes enable row level security;

create policy "partner_le_proprias_simulacoes" on simulacoes
  for select using (partner_id = public.app_partner_id() or public.app_is_admin());

create policy "team_le_simulacoes_equipe" on simulacoes
  for select using (
    equipe_id = public.app_equipe_id() and public.app_user_role() = 'team_member'
  );

create policy "partner_team_insere_simulacao" on simulacoes
  for insert with check (
    public.app_user_role() in ('partner','team_member') and public.app_is_approved()
  );

create policy "partner_team_atualiza_simulacao" on simulacoes
  for update using (
    partner_id = public.app_partner_id()
    or equipe_id = public.app_equipe_id()
  );

create policy "admin_full_simulacoes" on simulacoes
  for all using (public.app_is_admin()) with check (public.app_is_admin());

create trigger trg_simulacoes_updated_at
  before update on simulacoes
  for each row execute function set_updated_at();

-- =============================================
-- PROPOSTAS
-- =============================================

create table propostas (
  id                    uuid primary key default gen_random_uuid(),
  protocolo             text unique,              -- gerado automaticamente: MERC-YYYY-NNNNNN
  simulacao_id          uuid references simulacoes(id) on delete set null,
  partner_id            uuid not null references partners(id) on delete restrict,
  equipe_id             uuid references equipes(id) on delete set null,
  responsavel_id        uuid references usuarios(id) on delete set null,
  cliente_id            uuid references clientes(id) on delete restrict,
  produto               produto_tipo not null,
  status                proposta_status not null default 'pre_analise',
  valor_solicitado      numeric(14,2) not null,
  valor_imoveis_total   numeric(14,2) not null default 0, -- mantido por trigger
  taxa_juros_mensal     numeric(6,4) not null default 1.39,
  indexador             text not null default 'IPCA',
  correcao              correcao_tipo not null default 'pos_fixado',
  amortizacao           amortizacao_tipo not null default 'price',
  prazo_meses           int not null,
  carencia_meses        int not null default 0,
  motivo_cancelamento   text,
  dados_vendedor_imovel jsonb,  -- usado em financiamento_imobiliario
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index propostas_status_partner_idx on propostas (status, partner_id, created_at desc);
create index propostas_equipe_resp_idx    on propostas (equipe_id, responsavel_id);
create index propostas_protocolo_idx      on propostas (protocolo);
create index propostas_cliente_idx        on propostas (cliente_id);

alter table propostas enable row level security;

create policy "partner_le_proprias_propostas" on propostas
  for select using (partner_id = public.app_partner_id());

create policy "team_le_propostas_equipe" on propostas
  for select using (
    equipe_id = public.app_equipe_id() and public.app_user_role() = 'team_member'
  );

create policy "cliente_le_propria_proposta" on propostas
  for select using (
    cliente_id in (select id from clientes where usuario_id = auth.uid())
    and public.app_user_role() = 'client'
  );

create policy "admin_full_propostas" on propostas
  for all using (public.app_is_admin()) with check (public.app_is_admin());

create policy "partner_team_insere_proposta" on propostas
  for insert with check (
    public.app_user_role() in ('partner','team_member') and public.app_is_approved()
  );

create policy "partner_atualiza_proposta" on propostas
  for update using (
    partner_id = public.app_partner_id() or equipe_id = public.app_equipe_id()
  );

create trigger trg_propostas_updated_at
  before update on propostas
  for each row execute function set_updated_at();

-- FK reversa: simulacoes → propostas
alter table simulacoes
  add constraint simulacoes_proposta_fk
  foreign key (convertida_em_proposta_id)
  references propostas(id) on delete set null;

-- =============================================
-- GERADOR DE PROTOCOLO (trigger before insert)
-- =============================================

create or replace function gerar_protocolo()
  returns trigger language plpgsql as $$
declare
  v_seq bigint;
  v_ano text;
begin
  if new.protocolo is not null and new.protocolo != '' then
    return new;
  end if;
  v_ano := to_char(now(), 'YYYY');
  select count(*) + 1 into v_seq
    from propostas
    where extract(year from created_at) = extract(year from now());
  new.protocolo := format('MERC-%s-%s', v_ano, lpad(v_seq::text, 6, '0'));
  return new;
end;
$$;

create trigger trg_gera_protocolo
  before insert on propostas
  for each row execute function gerar_protocolo();

-- =============================================
-- PROPOSTA_STATUS_HISTORICO
-- =============================================

create table proposta_status_historico (
  id              uuid primary key default gen_random_uuid(),
  proposta_id     uuid not null references propostas(id) on delete cascade,
  status_anterior proposta_status,
  status_novo     proposta_status not null,
  alterado_por    uuid references usuarios(id) on delete set null,
  motivo          text,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

create index psh_proposta_idx on proposta_status_historico (proposta_id, created_at desc);

alter table proposta_status_historico enable row level security;

create policy "psh_visivel_ao_dono" on proposta_status_historico
  for select using (
    proposta_id in (
      select id from propostas
      where partner_id = public.app_partner_id()
         or equipe_id  = public.app_equipe_id()
         or cliente_id in (select id from clientes where usuario_id = auth.uid())
    )
    or public.app_is_admin()
  );

-- trigger: grava histórico automaticamente em todo UPDATE de status
create or replace function registrar_historico_status()
  returns trigger language plpgsql as $$
begin
  if old.status is distinct from new.status then
    insert into proposta_status_historico
      (proposta_id, status_anterior, status_novo, alterado_por)
    values
      (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_proposta_status_historico
  after update of status on propostas
  for each row execute function registrar_historico_status();

-- =============================================
-- PROPONENTES
-- =============================================

create table proponentes (
  id                   uuid primary key default gen_random_uuid(),
  proposta_id          uuid not null references propostas(id) on delete cascade,
  cliente_id           uuid references clientes(id) on delete set null,
  principal            boolean not null default false,
  pessoa_tipo          pessoa_tipo not null default 'PF',
  nome                 text not null,
  cpf_cnpj             text,
  estado_civil         estado_civil,
  relacao              text check (relacao in ('conjuge','socio','outro')),
  dados_complementares jsonb not null default '{}',
  created_at           timestamptz not null default now()
);

create index proponentes_proposta_idx on proponentes (proposta_id, principal);

alter table proponentes enable row level security;

create policy "admin_full_proponentes" on proponentes
  for all using (public.app_is_admin()) with check (public.app_is_admin());

create policy "partner_team_gerencia_proponentes" on proponentes
  for all using (
    proposta_id in (
      select id from propostas
      where partner_id = public.app_partner_id()
         or equipe_id  = public.app_equipe_id()
    )
    and public.app_user_role() in ('partner','team_member')
  );

create policy "cliente_le_proponentes" on proponentes
  for select using (
    proposta_id in (
      select id from propostas
      where cliente_id in (select id from clientes where usuario_id = auth.uid())
    )
    and public.app_user_role() = 'client'
  );

-- =============================================
-- IMOVEIS
-- =============================================

create table imoveis (
  id                       uuid primary key default gen_random_uuid(),
  proposta_id              uuid not null references propostas(id) on delete cascade,
  tipo                     imovel_tipo not null default 'apartamento',
  cep                      text,
  estado                   char(2),
  cidade                   text,
  bairro                   text,
  logradouro               text,
  numero                   text,
  sem_numero               boolean not null default false,
  complemento              text,
  valor                    numeric(14,2) not null,
  vagas_garagem            int not null default 0,
  alugado                  boolean not null default false,
  valor_aluguel            numeric(14,2),
  financiado               boolean not null default false,
  instituicao_financiadora text,
  saldo_devedor            numeric(14,2),
  possui_debitos           boolean not null default false,
  debitos_iptu             numeric(14,2),
  debitos_condominio       numeric(14,2),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index imoveis_proposta_idx on imoveis (proposta_id);

alter table imoveis enable row level security;

create policy "admin_full_imoveis" on imoveis
  for all using (public.app_is_admin()) with check (public.app_is_admin());

create policy "partner_team_gerencia_imoveis" on imoveis
  for all using (
    proposta_id in (
      select id from propostas
      where partner_id = public.app_partner_id()
         or equipe_id  = public.app_equipe_id()
    )
    and public.app_user_role() in ('partner','team_member')
  );

create policy "cliente_le_imoveis" on imoveis
  for select using (
    proposta_id in (
      select id from propostas
      where cliente_id in (select id from clientes where usuario_id = auth.uid())
    )
    and public.app_user_role() = 'client'
  );

create trigger trg_imoveis_updated_at
  before update on imoveis
  for each row execute function set_updated_at();

-- trigger: recalcula propostas.valor_imoveis_total
create or replace function recalcular_valor_imoveis()
  returns trigger language plpgsql as $$
declare
  v_proposta_id uuid;
  v_total       numeric(14,2);
begin
  v_proposta_id := coalesce(new.proposta_id, old.proposta_id);
  select coalesce(sum(valor), 0) into v_total
    from imoveis where proposta_id = v_proposta_id;
  update propostas set valor_imoveis_total = v_total where id = v_proposta_id;
  return coalesce(new, old);
end;
$$;

create trigger trg_recalcula_valor_imoveis
  after insert or update of valor or delete on imoveis
  for each row execute function recalcular_valor_imoveis();

-- =============================================
-- IMOVEL_PROPRIETARIOS (N:N)
-- =============================================

create table imovel_proprietarios (
  imovel_id     uuid not null references imoveis(id) on delete cascade,
  proponente_id uuid not null references proponentes(id) on delete cascade,
  percentual    numeric(5,2) not null default 100,
  primary key (imovel_id, proponente_id)
);

alter table imovel_proprietarios enable row level security;

create policy "admin_full_proprietarios" on imovel_proprietarios
  for all using (public.app_is_admin()) with check (public.app_is_admin());

create policy "partner_team_gerencia_proprietarios" on imovel_proprietarios
  for all using (
    imovel_id in (
      select i.id from imoveis i
      join propostas p on p.id = i.proposta_id
      where p.partner_id = public.app_partner_id()
         or p.equipe_id  = public.app_equipe_id()
    )
    and public.app_user_role() in ('partner','team_member')
  );

-- =============================================
-- PROPOSTA_DOCUMENTOS
-- =============================================

create table proposta_documentos (
  id            uuid primary key default gen_random_uuid(),
  proposta_id   uuid not null references propostas(id) on delete cascade,
  proponente_id uuid references proponentes(id) on delete set null,
  imovel_id     uuid references imoveis(id) on delete set null,
  categoria     text not null check (categoria in ('pessoa_fisica','pessoa_juridica','imovel')),
  tipo          documento_tipo not null,
  storage_path  text not null,
  bucket        text not null default 'proposta-docs',
  mime_type     text,
  tamanho_bytes bigint,
  enviado_por   uuid references usuarios(id) on delete set null,
  origem        text check (origem in ('cliente','parceiro','protocolo_publico','ocr')),
  validado      boolean not null default false,
  validado_por  uuid references usuarios(id) on delete set null,
  validado_em   timestamptz,
  ocr_texto     text,
  created_at    timestamptz not null default now()
);

create index prop_docs_proposta_idx on proposta_documentos (proposta_id, categoria);

alter table proposta_documentos enable row level security;

create policy "admin_full_prop_docs" on proposta_documentos
  for all using (public.app_is_admin()) with check (public.app_is_admin());

create policy "partner_team_le_docs" on proposta_documentos
  for select using (
    proposta_id in (
      select id from propostas
      where partner_id = public.app_partner_id()
         or equipe_id  = public.app_equipe_id()
    )
  );

create policy "cliente_le_docs_propria" on proposta_documentos
  for select using (
    proposta_id in (
      select id from propostas
      where cliente_id in (select id from clientes where usuario_id = auth.uid())
    )
    and public.app_user_role() = 'client'
  );

create policy "partner_team_cliente_insere_doc" on proposta_documentos
  for insert with check (
    proposta_id in (
      select id from propostas
      where partner_id = public.app_partner_id()
         or equipe_id  = public.app_equipe_id()
         or cliente_id in (select id from clientes where usuario_id = auth.uid())
    )
  );

-- =============================================
-- PROPOSTA_PENDENCIAS
-- =============================================

create table proposta_pendencias (
  id                        uuid primary key default gen_random_uuid(),
  proposta_id               uuid not null references propostas(id) on delete cascade,
  descricao                 text not null,
  solicitado_por            uuid references usuarios(id) on delete set null,
  responsavel_resolver      uuid references usuarios(id) on delete set null,
  documento_solicitado_tipo documento_tipo,
  status                    pendencia_status not null default 'aberta',
  prazo                     timestamptz,
  resolvida_em              timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index pendencias_proposta_idx on proposta_pendencias (proposta_id, status);

alter table proposta_pendencias enable row level security;

create policy "admin_full_pendencias" on proposta_pendencias
  for all using (public.app_is_admin()) with check (public.app_is_admin());

create policy "partner_team_le_pendencias" on proposta_pendencias
  for select using (
    proposta_id in (
      select id from propostas
      where partner_id = public.app_partner_id()
         or equipe_id  = public.app_equipe_id()
    )
  );

create policy "partner_team_insere_pendencia" on proposta_pendencias
  for insert with check (
    proposta_id in (
      select id from propostas
      where partner_id = public.app_partner_id()
         or equipe_id  = public.app_equipe_id()
    )
    and public.app_user_role() in ('partner','team_member')
  );

create policy "cliente_le_pendencias_propria" on proposta_pendencias
  for select using (
    proposta_id in (
      select id from propostas
      where cliente_id in (select id from clientes where usuario_id = auth.uid())
    )
    and public.app_user_role() = 'client'
  );

create trigger trg_pendencias_updated_at
  before update on proposta_pendencias
  for each row execute function set_updated_at();

