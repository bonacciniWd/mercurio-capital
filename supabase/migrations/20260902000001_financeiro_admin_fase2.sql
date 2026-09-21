-- FASE 2 — Livro financeiro administrativo e condicoes comerciais por proposta
-- Migration aditiva. Nao executar em producao sem GO operacional especifico.

create table public.financeiro_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 2 and 100),
  tipo text not null check (tipo in ('entrada','saida')),
  grupo text not null check (grupo in ('operacional','pessoal','comissao','imposto','infraestrutura','ocupacao','receita','outros')),
  categoria_pai_id uuid references public.financeiro_categorias(id) on delete restrict,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_by uuid references public.usuarios(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tipo, nome)
);

create table public.financeiro_recorrencias (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('entrada','saida')),
  categoria_id uuid not null references public.financeiro_categorias(id) on delete restrict,
  descricao text not null check (length(trim(descricao)) between 2 and 180),
  contraparte text,
  valor_previsto numeric(14,2) not null check (valor_previsto > 0),
  frequencia text not null default 'mensal' check (frequencia = 'mensal'),
  dia_vencimento smallint not null check (dia_vencimento between 1 and 31),
  inicio_em date not null,
  fim_em date,
  fundo_id uuid references public.fundos(id) on delete set null,
  partner_id uuid references public.partners(id) on delete set null,
  equipe_id uuid references public.equipes(id) on delete set null,
  ativo boolean not null default true,
  created_by uuid references public.usuarios(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fim_em is null or fim_em >= inicio_em)
);

create table public.financeiro_lancamentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('entrada','saida')),
  categoria_id uuid not null references public.financeiro_categorias(id) on delete restrict,
  recorrencia_id uuid references public.financeiro_recorrencias(id) on delete restrict,
  descricao text not null check (length(trim(descricao)) between 2 and 180),
  contraparte text,
  competencia date not null check (competencia = date_trunc('month', competencia)::date),
  vencimento_em date not null,
  valor_previsto numeric(14,2) not null check (valor_previsto > 0),
  valor_realizado numeric(14,2),
  realizado_em date,
  status text not null default 'previsto' check (status in ('previsto','realizado','vencido','cancelado')),
  fundo_id uuid references public.fundos(id) on delete set null,
  partner_id uuid references public.partners(id) on delete set null,
  equipe_id uuid references public.equipes(id) on delete set null,
  proposta_id uuid references public.propostas(id) on delete restrict,
  condicao_comercial_id uuid,
  liberacao_id uuid references public.liberacoes_recurso(id) on delete restrict,
  comissao_id uuid references public.comissoes(id) on delete restrict,
  observacao text,
  motivo_cancelamento text,
  comprovante_storage_path text,
  created_by uuid references public.usuarios(id) on delete set null default auth.uid(),
  updated_by uuid references public.usuarios(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'realizado' and valor_realizado is not null and valor_realizado > 0 and realizado_em is not null)
      or (status <> 'realizado' and valor_realizado is null and realizado_em is null)),
  check (status <> 'cancelado' or length(trim(coalesce(motivo_cancelamento,''))) >= 3)
);

create unique index financeiro_lancamento_recorrencia_competencia_uq
  on public.financeiro_lancamentos(recorrencia_id, competencia) where recorrencia_id is not null;
create unique index financeiro_lancamento_liberacao_uq
  on public.financeiro_lancamentos(liberacao_id) where liberacao_id is not null;
create unique index financeiro_lancamento_comissao_uq
  on public.financeiro_lancamentos(comissao_id) where comissao_id is not null;
create index financeiro_lancamentos_periodo_idx on public.financeiro_lancamentos(competencia, tipo, status);
create index financeiro_lancamentos_vencimento_idx on public.financeiro_lancamentos(vencimento_em, status);

create table public.financeiro_fechamentos (
  id uuid primary key default gen_random_uuid(),
  competencia date not null unique check (competencia = date_trunc('month', competencia)::date),
  status text not null default 'aberto' check (status in ('aberto','pendente','fechado','reaberto')),
  prazo_fechamento date not null,
  fechado_por uuid references public.usuarios(id) on delete set null,
  fechado_em timestamptz,
  reaberto_por uuid references public.usuarios(id) on delete set null,
  reaberto_em timestamptz,
  motivo_reabertura text,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'fechado' and fechado_por is not null and fechado_em is not null) or status <> 'fechado'),
  check (status <> 'reaberto' or length(trim(coalesce(motivo_reabertura,''))) >= 3)
);

create table public.financeiro_dias_nao_uteis (
  data date not null,
  abrangencia text not null check (abrangencia in ('nacional','estadual','municipal','bancaria')),
  nome text not null check (length(trim(nome)) >= 2),
  uf char(2),
  municipio text,
  fonte_oficial text not null,
  ativo boolean not null default true,
  created_by uuid references public.usuarios(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (data, abrangencia, nome),
  check ((abrangencia = 'estadual' and uf is not null)
      or (abrangencia = 'municipal' and uf is not null and municipio is not null)
      or abrangencia in ('nacional','bancaria'))
);

create table public.proposta_condicoes_comerciais (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas(id) on delete restrict,
  versao integer not null check (versao > 0),
  status text not null default 'rascunho' check (status in ('rascunho','aprovada','substituida','cancelada')),
  tipo_base_receita text not null check (tipo_base_receita in ('valor_aprovado','valor_liberado','valor_fixo')),
  valor_base_previsto numeric(14,2) not null check (valor_base_previsto > 0),
  percentual_receita_mercurio numeric(7,4) not null check (percentual_receita_mercurio between 0 and 100),
  valor_receita_prevista numeric(14,2) generated always as
    (round(valor_base_previsto * percentual_receita_mercurio / 100, 2)) stored,
  base_comissao_parceiro text not null check (base_comissao_parceiro in ('valor_liberado','receita_bruta')),
  percentual_comissao_parceiro numeric(7,4) not null check (percentual_comissao_parceiro between 0 and 100),
  valor_comissao_parceiro_prevista numeric(14,2) generated always as
    (round((case when base_comissao_parceiro = 'valor_liberado' then valor_base_previsto
                 else valor_base_previsto * percentual_receita_mercurio / 100 end)
           * percentual_comissao_parceiro / 100, 2)) stored,
  recebimento_previsto_em date not null,
  vigente_desde date,
  aprovada_por uuid references public.usuarios(id) on delete set null,
  aprovada_em timestamptz,
  motivo_alteracao text,
  created_by uuid references public.usuarios(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (proposta_id, versao),
  check ((status = 'aprovada' and aprovada_por is not null and aprovada_em is not null) or status <> 'aprovada')
);

create unique index proposta_condicao_aprovada_uq
  on public.proposta_condicoes_comerciais(proposta_id) where status = 'aprovada';

alter table public.financeiro_lancamentos
  add constraint financeiro_lancamentos_condicao_fk foreign key (condicao_comercial_id)
  references public.proposta_condicoes_comerciais(id) on delete restrict;
create unique index financeiro_lancamento_condicao_uq
  on public.financeiro_lancamentos(condicao_comercial_id) where condicao_comercial_id is not null;

-- updated_at
create trigger trg_financeiro_categorias_updated before update on public.financeiro_categorias
  for each row execute function public.set_updated_at();
create trigger trg_financeiro_recorrencias_updated before update on public.financeiro_recorrencias
  for each row execute function public.set_updated_at();
create trigger trg_financeiro_lancamentos_updated before update on public.financeiro_lancamentos
  for each row execute function public.set_updated_at();
create trigger trg_financeiro_fechamentos_updated before update on public.financeiro_fechamentos
  for each row execute function public.set_updated_at();
create trigger trg_financeiro_dias_updated before update on public.financeiro_dias_nao_uteis
  for each row execute function public.set_updated_at();

-- RLS: leitura para admins; escrita financeira somente operacional.
alter table public.financeiro_categorias enable row level security;
alter table public.financeiro_recorrencias enable row level security;
alter table public.financeiro_lancamentos enable row level security;
alter table public.financeiro_fechamentos enable row level security;
alter table public.financeiro_dias_nao_uteis enable row level security;
alter table public.proposta_condicoes_comerciais enable row level security;

create policy financeiro_categorias_read on public.financeiro_categorias for select using (public.app_is_admin());
create policy financeiro_categorias_write on public.financeiro_categorias for all using (public.app_is_admin_operacional()) with check (public.app_is_admin_operacional());
create policy financeiro_recorrencias_read on public.financeiro_recorrencias for select using (public.app_is_admin());
create policy financeiro_recorrencias_write on public.financeiro_recorrencias for all using (public.app_is_admin_operacional()) with check (public.app_is_admin_operacional());
create policy financeiro_lancamentos_read on public.financeiro_lancamentos for select using (public.app_is_admin());
create policy financeiro_lancamentos_write on public.financeiro_lancamentos for all using (public.app_is_admin_operacional()) with check (public.app_is_admin_operacional());
create policy financeiro_fechamentos_read on public.financeiro_fechamentos for select using (public.app_is_admin());
create policy financeiro_fechamentos_write on public.financeiro_fechamentos for all using (public.app_is_admin_operacional()) with check (public.app_is_admin_operacional());
create policy financeiro_dias_read on public.financeiro_dias_nao_uteis for select using (public.app_is_admin());
create policy financeiro_dias_write on public.financeiro_dias_nao_uteis for all using (public.app_is_admin_operacional()) with check (public.app_is_admin_operacional());
create policy proposta_condicoes_read on public.proposta_condicoes_comerciais for select using (public.app_is_admin());
create policy proposta_condicoes_write on public.proposta_condicoes_comerciais for all using (public.app_is_admin_operacional()) with check (public.app_is_admin_operacional());

-- Fechamentos e condicoes comerciais mudam apenas pelas RPCs transacionais.
revoke insert, update, delete on public.financeiro_fechamentos from authenticated;
revoke insert, update, delete on public.proposta_condicoes_comerciais from authenticated;

-- Auditoria de todas as alteracoes sensiveis.
create trigger trg_audit_financeiro_categorias after update on public.financeiro_categorias
  for each row execute function public.audit_update_trigger();
create trigger trg_audit_financeiro_recorrencias after update on public.financeiro_recorrencias
  for each row execute function public.audit_update_trigger();
create trigger trg_audit_financeiro_lancamentos after update on public.financeiro_lancamentos
  for each row execute function public.audit_update_trigger();
create trigger trg_audit_financeiro_fechamentos after update on public.financeiro_fechamentos
  for each row execute function public.audit_update_trigger();
create trigger trg_audit_proposta_condicoes after update on public.proposta_condicoes_comerciais
  for each row execute function public.audit_update_trigger();

create or replace function public.financeiro_audit_insert_delete()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_row jsonb := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  perform public.registrar_audit(lower(tg_op),tg_table_name,
    case when tg_op='DELETE' then old.id else new.id end,
    case when tg_op='DELETE' then v_row else null end,
    case when tg_op='INSERT' then v_row else null end);
  return case when tg_op='DELETE' then old else new end;
end; $$;

create trigger trg_audit_financeiro_categorias_id after insert or delete on public.financeiro_categorias
  for each row execute function public.financeiro_audit_insert_delete();
create trigger trg_audit_financeiro_recorrencias_id after insert or delete on public.financeiro_recorrencias
  for each row execute function public.financeiro_audit_insert_delete();
create trigger trg_audit_financeiro_lancamentos_id after insert or delete on public.financeiro_lancamentos
  for each row execute function public.financeiro_audit_insert_delete();
create trigger trg_audit_financeiro_fechamentos_id after insert or delete on public.financeiro_fechamentos
  for each row execute function public.financeiro_audit_insert_delete();
create trigger trg_audit_proposta_condicoes_id after insert or delete on public.proposta_condicoes_comerciais
  for each row execute function public.financeiro_audit_insert_delete();

-- Competencia fechada e imutavel.
create or replace function public.financeiro_guard_competencia()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_competencia date := coalesce(new.competencia, old.competencia);
begin
  if tg_op in ('UPDATE','DELETE') and exists
    (select 1 from public.financeiro_fechamentos f where f.competencia=old.competencia and f.status='fechado') then
    raise exception 'competencia_fechada' using errcode = '55000';
  end if;
  if exists (select 1 from public.financeiro_fechamentos f where f.competencia = v_competencia and f.status = 'fechado') then
    raise exception 'competencia_fechada' using errcode = '55000';
  end if;
  if tg_op <> 'DELETE' then new.updated_by := auth.uid(); return new; end if;
  return old;
end; $$;

create trigger trg_financeiro_lancamentos_competencia
  before insert or update or delete on public.financeiro_lancamentos
  for each row execute function public.financeiro_guard_competencia();

-- Utilitario de quinto dia util para Balneario Camboriu/SC.
create or replace function public.financeiro_quinto_dia_util(p_competencia date)
returns date language sql stable security definer set search_path = public as $$
  with dias as (
    select d::date as dia
      from generate_series(date_trunc('month', p_competencia)::date,
                           (date_trunc('month', p_competencia) + interval '1 month - 1 day')::date,
                           interval '1 day') d
     where extract(isodow from d) between 1 and 5
       and not exists (
         select 1 from public.financeiro_dias_nao_uteis h
          where h.data = d::date and h.ativo
            and (h.abrangencia in ('nacional','bancaria')
              or (h.abrangencia = 'estadual' and h.uf = 'SC')
              or (h.abrangencia = 'municipal' and h.uf = 'SC' and lower(h.municipio) = lower('Balneario Camboriu')))
       )
  ) select dia from dias order by dia offset 4 limit 1;
$$;

-- Materializa custos/receitas recorrentes uma unica vez por competencia.
create or replace function public.financeiro_materializar_recorrencias(p_competencia date)
returns integer language plpgsql security definer set search_path = public as $$
declare v_comp date := date_trunc('month', p_competencia)::date; v_count integer;
begin
  if not public.app_is_admin_operacional() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.financeiro_lancamentos
    (tipo,categoria_id,recorrencia_id,descricao,contraparte,competencia,vencimento_em,valor_previsto,fundo_id,partner_id,equipe_id)
  select r.tipo,r.categoria_id,r.id,r.descricao,r.contraparte,v_comp,
         (v_comp + (least(r.dia_vencimento,
            extract(day from (v_comp + interval '1 month - 1 day'))::int) - 1) * interval '1 day')::date,
         r.valor_previsto,r.fundo_id,r.partner_id,r.equipe_id
    from public.financeiro_recorrencias r
   where r.ativo and r.inicio_em < v_comp + interval '1 month'
     and (r.fim_em is null or r.fim_em >= v_comp)
  on conflict (recorrencia_id, competencia) where recorrencia_id is not null do nothing;
  get diagnostics v_count = row_count;
  perform public.registrar_audit('materializar_recorrencias','financeiro_lancamentos',null,null,
    jsonb_build_object('competencia',v_comp,'quantidade',v_count));
  return v_count;
end; $$;

-- Fecha e reabre competencia com validacao e auditoria.
create or replace function public.financeiro_fechar_competencia(p_competencia date, p_observacao text default null)
returns public.financeiro_fechamentos language plpgsql security definer set search_path = public as $$
declare v_comp date := date_trunc('month',p_competencia)::date; v_row public.financeiro_fechamentos%rowtype;
begin
  if not public.app_is_admin_operacional() then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_comp >= date_trunc('month', current_date)::date then raise exception 'competencia_nao_encerrada'; end if;
  if exists (select 1 from public.financeiro_lancamentos where competencia=v_comp and status in ('previsto','vencido')) then
    raise exception 'pendencias_financeiras' using hint='realize, cancele com motivo ou ajuste os lancamentos pendentes';
  end if;
  insert into public.financeiro_fechamentos(competencia,status,prazo_fechamento,fechado_por,fechado_em,observacao)
  values(v_comp,'fechado',(v_comp + interval '1 month 1 day')::date,auth.uid(),now(),p_observacao)
  on conflict(competencia) do update set status='fechado',fechado_por=auth.uid(),fechado_em=now(),observacao=excluded.observacao,
    reaberto_por=null,reaberto_em=null,motivo_reabertura=null
  returning * into v_row;
  perform public.registrar_audit('fechar_competencia','financeiro_fechamentos',v_row.id,null,to_jsonb(v_row));
  return v_row;
end; $$;

create or replace function public.financeiro_reabrir_competencia(p_competencia date, p_motivo text)
returns public.financeiro_fechamentos language plpgsql security definer set search_path = public as $$
declare v_comp date := date_trunc('month',p_competencia)::date; v_row public.financeiro_fechamentos%rowtype;
begin
  if not public.app_is_admin_operacional() then raise exception 'forbidden' using errcode = '42501'; end if;
  if length(trim(coalesce(p_motivo,''))) < 3 then raise exception 'motivo_reabertura_obrigatorio'; end if;
  update public.financeiro_fechamentos set status='reaberto',reaberto_por=auth.uid(),reaberto_em=now(),motivo_reabertura=p_motivo
   where competencia=v_comp and status='fechado' returning * into v_row;
  if not found then raise exception 'fechamento_nao_encontrado'; end if;
  perform public.registrar_audit('reabrir_competencia','financeiro_fechamentos',v_row.id,null,to_jsonb(v_row));
  return v_row;
end; $$;

-- Cria uma nova versao em rascunho. Valores sao recalculados pelo banco.
create or replace function public.proposta_condicao_comercial_criar(
  p_proposta_id uuid,p_tipo_base_receita text,p_valor_base numeric,p_percentual_receita numeric,
  p_base_comissao text,p_percentual_parceiro numeric,p_recebimento_previsto date,p_motivo text default null)
returns public.proposta_condicoes_comerciais language plpgsql security definer set search_path=public as $$
declare v_row public.proposta_condicoes_comerciais%rowtype; v_versao integer;
begin
  if not public.app_is_admin_operacional() then raise exception 'forbidden' using errcode='42501'; end if;
  perform 1 from public.propostas where id=p_proposta_id for update;
  if not found then raise exception 'proposta_nao_encontrada'; end if;
  select coalesce(max(versao),0)+1 into v_versao from public.proposta_condicoes_comerciais where proposta_id=p_proposta_id;
  insert into public.proposta_condicoes_comerciais
    (proposta_id,versao,tipo_base_receita,valor_base_previsto,percentual_receita_mercurio,
     base_comissao_parceiro,percentual_comissao_parceiro,recebimento_previsto_em,motivo_alteracao)
  values(p_proposta_id,v_versao,p_tipo_base_receita,p_valor_base,p_percentual_receita,
         p_base_comissao,p_percentual_parceiro,p_recebimento_previsto,p_motivo)
  returning * into v_row;
  perform public.registrar_audit('criar_condicao_comercial','proposta_condicoes_comerciais',v_row.id,null,to_jsonb(v_row));
  return v_row;
end; $$;

create or replace function public.proposta_condicao_comercial_aprovar(p_condicao_id uuid)
returns public.proposta_condicoes_comerciais language plpgsql security definer set search_path=public as $$
declare v_row public.proposta_condicoes_comerciais%rowtype; v_categoria uuid;
begin
  if not public.app_is_admin_operacional() then raise exception 'forbidden' using errcode='42501'; end if;
  select * into v_row from public.proposta_condicoes_comerciais where id=p_condicao_id and status='rascunho' for update;
  if not found then raise exception 'condicao_nao_encontrada_ou_nao_editavel'; end if;
  update public.proposta_condicoes_comerciais set status='substituida'
   where proposta_id=v_row.proposta_id and status='aprovada';
  update public.financeiro_lancamentos
     set status='cancelado',motivo_cancelamento='Condicao comercial substituida'
   where proposta_id=v_row.proposta_id and tipo='entrada' and status in ('previsto','vencido')
     and condicao_comercial_id is not null;
  update public.proposta_condicoes_comerciais set status='aprovada',aprovada_por=auth.uid(),aprovada_em=now(),vigente_desde=current_date
   where id=p_condicao_id returning * into v_row;
  select id into v_categoria from public.financeiro_categorias where tipo='entrada' and nome='Receita bruta de proposta';
  insert into public.financeiro_lancamentos(tipo,categoria_id,descricao,competencia,vencimento_em,valor_previsto,status,proposta_id,condicao_comercial_id)
  values('entrada',v_categoria,'Receita bruta da proposta',date_trunc('month',v_row.recebimento_previsto_em)::date,
         v_row.recebimento_previsto_em,v_row.valor_receita_prevista,'previsto',v_row.proposta_id,v_row.id);
  perform public.registrar_audit('aprovar_condicao_comercial','proposta_condicoes_comerciais',v_row.id,null,to_jsonb(v_row));
  return v_row;
end; $$;

-- Sem condicao aprovada nao ha comissao automatica. Remove fallback global silencioso.
create or replace function public.fn_calcular_comissao()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_partner uuid; v_cond public.proposta_condicoes_comerciais%rowtype; v_base numeric; v_receita numeric; v_valor numeric;
begin
  select partner_id into v_partner from public.propostas where id=new.proposta_id;
  if v_partner is null then return new; end if;
  select * into v_cond from public.proposta_condicoes_comerciais where proposta_id=new.proposta_id and status='aprovada';
  if not found then raise exception 'condicao_comercial_aprovada_obrigatoria' using errcode='23514'; end if;
  v_receita := case when v_cond.tipo_base_receita='valor_liberado'
                    then round(new.valor_liberado*v_cond.percentual_receita_mercurio/100,2)
                    else v_cond.valor_receita_prevista end;
  v_base := case when v_cond.base_comissao_parceiro='valor_liberado' then new.valor_liberado else v_receita end;
  v_valor := round(v_base*v_cond.percentual_comissao_parceiro/100,2);
  insert into public.comissoes(proposta_id,partner_id,percentual,valor,status,liberacao_id)
  values(new.proposta_id,v_partner,v_cond.percentual_comissao_parceiro,v_valor,'prevista',new.id);
  return new;
end; $$;

-- Pagamento de repasse: depois do dia 02 exige fechamento anterior ou justificativa auditada.
create or replace function public.financeiro_comissao_marcar_paga(p_comissao_id uuid,p_data date default null,p_justificativa_excecao text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_anterior date := (date_trunc('month',current_date)-interval '1 month')::date; v_atrasado boolean;
begin
  if not public.app_is_admin_operacional() then raise exception 'forbidden' using errcode='42501'; end if;
  v_atrasado := extract(day from current_date)>2 and not exists
    (select 1 from public.financeiro_fechamentos where competencia=v_anterior and status='fechado');
  if v_atrasado and length(trim(coalesce(p_justificativa_excecao,'')))<5 then
    raise exception 'fechamento_anterior_pendente' using hint='informe justificativa de excecao ou feche a competencia anterior';
  end if;
  update public.comissoes set status='paga',paga_em=coalesce(p_data::timestamptz,now())
   where id=p_comissao_id and status in ('prevista','aprovada');
  if not found then raise exception 'comissao_nao_encontrada_ou_ja_paga'; end if;
  if v_atrasado then perform public.registrar_audit('repasse_excecao','comissoes',p_comissao_id,null,
    jsonb_build_object('justificativa',p_justificativa_excecao,'competencia_pendente',v_anterior)); end if;
end; $$;

create or replace function public.comissao_marcar_paga(p_comissao_id uuid,p_data date default null)
returns void language plpgsql security definer set search_path=public as $$
begin perform public.financeiro_comissao_marcar_paga(p_comissao_id,p_data,null); end; $$;

-- Agregacoes server-side para dashboard e resumo financeiro.
create or replace function public.admin_financeiro_resumo(
  p_inicio date,p_fim date,p_visao text default 'competencia',p_fundo uuid default null,p_partner uuid default null,p_equipe uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_result jsonb;
begin
  if not public.app_is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_inicio is null or p_fim is null or p_inicio>p_fim or p_visao not in ('competencia','caixa') then raise exception 'filtro_invalido'; end if;
  with base as (
    select l.*,
      case when p_visao='caixa' then l.realizado_em else l.competencia end as data_analitica
    from public.financeiro_lancamentos l
    where (p_fundo is null or l.fundo_id=p_fundo) and (p_partner is null or l.partner_id=p_partner)
      and (p_equipe is null or l.equipe_id=p_equipe)
      and ((p_visao='caixa' and l.status='realizado' and l.realizado_em between p_inicio and p_fim)
        or (p_visao='competencia' and l.competencia between date_trunc('month',p_inicio)::date and date_trunc('month',p_fim)::date))
  ), meses as (
    select date_trunc('month',data_analitica)::date mes,
      coalesce(sum(case when tipo='entrada' and status='realizado' then valor_realizado else 0 end),0) entradas,
      coalesce(sum(case when tipo='saida' and status='realizado' then valor_realizado else 0 end),0) saidas,
      coalesce(sum(case when tipo='entrada' and status in ('previsto','vencido') then valor_previsto else 0 end),0) entradas_previstas,
      coalesce(sum(case when tipo='saida' and status in ('previsto','vencido') then valor_previsto else 0 end),0) saidas_previstas
    from base group by 1 order by 1
  )
  select jsonb_build_object(
    'entradas_realizadas',coalesce(sum(case when tipo='entrada' and status='realizado' then valor_realizado else 0 end),0),
    'saidas_realizadas',coalesce(sum(case when tipo='saida' and status='realizado' then valor_realizado else 0 end),0),
    'entradas_previstas',coalesce(sum(case when tipo='entrada' and status in ('previsto','vencido') then valor_previsto else 0 end),0),
    'saidas_previstas',coalesce(sum(case when tipo='saida' and status in ('previsto','vencido') then valor_previsto else 0 end),0),
    'custos_operacionais',coalesce(sum(case when tipo='saida' and status='realizado' and categoria_id in
      (select id from public.financeiro_categorias where grupo in ('operacional','infraestrutura','ocupacao')) then valor_realizado else 0 end),0),
    'custos_pessoal',coalesce(sum(case when tipo='saida' and status='realizado' and categoria_id in
      (select id from public.financeiro_categorias where grupo='pessoal') then valor_realizado else 0 end),0),
    'pendencias',count(*) filter(where status in ('previsto','vencido')),
    'serie',coalesce((select jsonb_agg(to_jsonb(m)) from meses m),'[]'::jsonb)
  ) into v_result from base;
  return v_result;
end; $$;

create or replace function public.admin_dashboard_analytics(
  p_inicio date,p_fim date,p_fundo uuid default null,p_partner uuid default null,p_equipe uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_result jsonb;
begin
  if not public.app_is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_inicio is null or p_fim is null or p_inicio>p_fim then raise exception 'filtro_invalido'; end if;
  with propostas_dimensionadas as (
    select p.* from public.propostas p
    where (p_partner is null or p.partner_id=p_partner) and (p_equipe is null or p.equipe_id=p_equipe)
      and (p_fundo is null or exists(select 1 from public.proposta_fundos pf where pf.proposta_id=p.id and pf.fundo_id=p_fundo))
  ), propostas_filtradas as (
    select p.* from propostas_dimensionadas p
    where p.created_at >= p_inicio::timestamptz and p.created_at < (p_fim+1)::timestamptz
  ), liberacoes_periodo as (
    select l.*,p.partner_id
    from public.liberacoes_recurso l
    join propostas_dimensionadas p on p.id=l.proposta_id
    where l.data_liberacao between p_inicio and p_fim
  ), top_parceiros as (
    select p.partner_id,u.nome_completo partner_nome,count(distinct p.id) total,
      count(distinct p.id) filter(where p.status in ('contrato_registrado','recurso_liberado','pagamento_comissao','completo')) ganhas,
      coalesce(sum(l.valor_liberado),0) volume
    from propostas_dimensionadas p join public.partners pa on pa.id=p.partner_id join public.usuarios u on u.id=pa.usuario_id
    join liberacoes_periodo l on l.proposta_id=p.id
    group by p.partner_id,u.nome_completo order by volume desc,total desc limit 10
  )
  select jsonb_build_object(
    'total_propostas',count(*),
    'ativas',count(*) filter(where status not in ('cancelado','completo')),
    'ganhas',count(*) filter(where status in ('contrato_registrado','recurso_liberado','pagamento_comissao','completo')),
    'canceladas',count(*) filter(where status='cancelado'),
    'taxa_conversao',case when count(*)=0 then 0 else round(100.0*count(*) filter(where status in ('contrato_registrado','recurso_liberado','pagamento_comissao','completo'))/count(*),1) end,
    'volume_operacional',coalesce((select sum(l.valor_liberado) from liberacoes_periodo l),0),
    'parceiros_ativos',count(distinct partner_id),
    'top_parceiros',coalesce((select jsonb_agg(to_jsonb(t)) from top_parceiros t),'[]'::jsonb)
  ) into v_result from propostas_filtradas;
  return v_result;
end; $$;

grant execute on function public.financeiro_quinto_dia_util(date) to authenticated;
grant execute on function public.financeiro_materializar_recorrencias(date) to authenticated;
grant execute on function public.financeiro_fechar_competencia(date,text) to authenticated;
grant execute on function public.financeiro_reabrir_competencia(date,text) to authenticated;
grant execute on function public.proposta_condicao_comercial_criar(uuid,text,numeric,numeric,text,numeric,date,text) to authenticated;
grant execute on function public.proposta_condicao_comercial_aprovar(uuid) to authenticated;
grant execute on function public.financeiro_comissao_marcar_paga(uuid,date,text) to authenticated;
grant execute on function public.admin_financeiro_resumo(date,date,text,uuid,uuid,uuid) to authenticated;
grant execute on function public.admin_dashboard_analytics(date,date,uuid,uuid,uuid) to authenticated;

-- Categorias minimas. Administradores podem criar outras pela UI.
insert into public.financeiro_categorias(nome,tipo,grupo,ordem) values
 ('Receita bruta de proposta','entrada','receita',10),
 ('Outras receitas','entrada','outros',20),
 ('Comissao de parceiro','saida','comissao',30),
 ('Salarios','saida','pessoal',40),
 ('Energia','saida','infraestrutura',50),
 ('Aluguel','saida','ocupacao',60),
 ('Condominio','saida','ocupacao',70),
 ('Impostos','saida','imposto',80),
 ('Outros custos','saida','outros',90)
on conflict (tipo,nome) do nothing;

comment on table public.financeiro_lancamentos is 'Livro financeiro administrativo; previsto e realizado, por competencia e caixa.';
comment on table public.proposta_condicoes_comerciais is 'Condicoes comerciais imutaveis por versao; receita Mercurio e comissao do parceiro.';
