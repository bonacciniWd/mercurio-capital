-- SMOKE FASE 29 — financeiro admin, recorrencias, fechamento e condicao comercial
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/smoke-tests/fase-29-financeiro-admin.sql
begin;

do $$
declare
  v_admin uuid := gen_random_uuid(); v_partner_user uuid := gen_random_uuid(); v_partner uuid;
  v_prop uuid; v_cat uuid; v_rec uuid; v_cond uuid; v_lib uuid; v_comm numeric;
  v_comp date := (date_trunc('month',current_date)-interval '2 months')::date;
  v_count integer; v_fifth date;
begin
  perform set_config('request.jwt.claims','',true);
  insert into auth.users(id,email,raw_user_meta_data,created_at,email_confirmed_at) values
    (v_admin,'financeiro.admin.'||replace(v_admin::text,'-','')||'@test.local','{}',now(),now()),
    (v_partner_user,'financeiro.partner.'||replace(v_partner_user::text,'-','')||'@test.local','{}',now(),now());
  update public.usuarios set role='admin',nome_completo='Financeiro Admin' where id=v_admin;
  update public.usuarios set role='partner',nome_completo='Financeiro Partner' where id=v_partner_user;
  insert into public.partners(usuario_id,status) values(v_partner_user,'approved') returning id into v_partner;
  insert into public.propostas(partner_id,produto,valor_solicitado,prazo_meses)
    values(v_partner,'home_equity',2000000,120) returning id into v_prop;

  perform set_config('request.jwt.claims',json_build_object('sub',v_admin,'app_metadata',json_build_object('role','admin','admin_nivel','full'))::text,true);
  select id into v_cat from public.financeiro_categorias where nome='Aluguel' and tipo='saida';
  insert into public.financeiro_recorrencias(tipo,categoria_id,descricao,valor_previsto,dia_vencimento,inicio_em)
    values('saida',v_cat,'Aluguel smoke',10000,31,v_comp) returning id into v_rec;
  if public.financeiro_materializar_recorrencias(v_comp) <> 1 then raise exception 'FASE 29 FAIL: materializacao inicial'; end if;
  if public.financeiro_materializar_recorrencias(v_comp) <> 0 then raise exception 'FASE 29 FAIL: recorrencia nao idempotente'; end if;
  select count(*) into v_count from public.financeiro_lancamentos where recorrencia_id=v_rec and competencia=v_comp;
  if v_count<>1 then raise exception 'FASE 29 FAIL: esperado um lancamento recorrente'; end if;

  select id into v_cond from public.proposta_condicao_comercial_criar(
    v_prop,'valor_aprovado',2000000,6,'receita_bruta',10,current_date+15,'smoke');
  perform public.proposta_condicao_comercial_aprovar(v_cond);
  if not exists(select 1 from public.financeiro_lancamentos where condicao_comercial_id=v_cond and valor_previsto=120000) then
    raise exception 'FASE 29 FAIL: receita prevista deveria ser 120000';
  end if;
  insert into public.liberacoes_recurso(proposta_id,valor_liberado,data_liberacao)
    values(v_prop,2000000,current_date) returning id into v_lib;
  select valor into v_comm from public.comissoes where liberacao_id=v_lib;
  if v_comm is distinct from 12000::numeric then raise exception 'FASE 29 FAIL: comissao esperada 12000, obtida %',v_comm; end if;

  update public.financeiro_lancamentos set status='realizado',valor_realizado=valor_previsto,realizado_em=vencimento_em
    where recorrencia_id=v_rec and competencia=v_comp;
  perform public.financeiro_fechar_competencia(v_comp,'smoke');
  begin
    update public.financeiro_lancamentos set descricao='nao pode' where recorrencia_id=v_rec and competencia=v_comp;
    raise exception 'FASE 29 FAIL: competencia fechada aceitou update';
  exception when sqlstate '55000' then null; end;
  perform public.financeiro_reabrir_competencia(v_comp,'correcao smoke');
  update public.financeiro_lancamentos set descricao='Aluguel smoke corrigido' where recorrencia_id=v_rec and competencia=v_comp;

  insert into public.financeiro_dias_nao_uteis(data,abrangencia,nome,fonte_oficial)
    values(date_trunc('month',current_date)::date,'nacional','Primeiro dia smoke','smoke');
  v_fifth := public.financeiro_quinto_dia_util(current_date);
  if v_fifth is null or extract(isodow from v_fifth) not between 1 and 5 then raise exception 'FASE 29 FAIL: quinto dia util invalido'; end if;

  perform set_config('request.jwt.claims',json_build_object('sub',v_partner_user,'app_metadata',json_build_object('role','partner','partner_id',v_partner))::text,true);
  begin
    perform public.financeiro_materializar_recorrencias(v_comp);
    raise exception 'FASE 29 FAIL: partner materializou recorrencias';
  exception when insufficient_privilege then null; when others then
    if sqlerrm<>'forbidden' then raise; end if;
  end;

  raise notice 'FASE 29 SMOKE OK';
end $$;

rollback;
