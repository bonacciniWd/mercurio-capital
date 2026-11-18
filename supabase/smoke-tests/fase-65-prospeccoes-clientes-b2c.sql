-- Smoke estrutural da carteira B2C de prospecção.
-- Executar somente depois da migration 20261118000001, em ambiente local/isolado.
-- Este arquivo não cria fixtures nem altera dados.

begin;

do $$
declare
  v_function text;
  v_functions text[] := array[
    'public.partner_prospeccao_cliente_create(text,text,text,uuid,text,text)',
    'public.admin_prospeccao_cliente_create(uuid,uuid,text,text,text,text,text)',
    'public.prospeccao_cliente_update(uuid,text,text,text,text,text,uuid,boolean)',
    'public.prospeccao_cliente_move(uuid,text,text,text)',
    'public.partner_prospeccao_cliente_converter(uuid,jsonb)',
    'public.admin_prospeccao_cliente_converter(uuid,jsonb)'
  ];
begin
  if to_regclass('public.prospeccoes_clientes') is null
     or to_regclass('public.prospeccoes_clientes_historico') is null
     or to_regclass('public.v_prospeccoes_clientes') is null then
    raise exception 'fase65_relacao_ausente';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.prospeccoes_clientes'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.prospeccoes_clientes_historico'::regclass) then
    raise exception 'fase65_rls_desabilitada';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public'
       and tablename = 'prospeccoes_clientes' and policyname = 'prospeccoes_clientes_leitura_escopada'
       and qual ilike '%app_can_operate%' and qual ilike '%deleted_at%')
     or not exists (select 1 from pg_policies where schemaname = 'public'
       and tablename = 'prospeccoes_clientes_historico' and policyname = 'prospeccoes_clientes_historico_leitura_escopada'
       and qual ilike '%app_can_operate%' and qual ilike '%deleted_at%') then
    raise exception 'fase65_rls_sem_gate_2fa_ou_filtro_soft_delete';
  end if;

  if not has_table_privilege('authenticated', 'public.prospeccoes_clientes', 'SELECT')
     or not has_table_privilege('authenticated', 'public.prospeccoes_clientes_historico', 'SELECT')
     or not has_table_privilege('authenticated', 'public.v_prospeccoes_clientes', 'SELECT') then
    raise exception 'fase65_leitura_authenticated_ausente';
  end if;

  if has_table_privilege('authenticated', 'public.prospeccoes_clientes', 'INSERT')
     or has_table_privilege('authenticated', 'public.prospeccoes_clientes', 'UPDATE')
     or has_table_privilege('authenticated', 'public.prospeccoes_clientes', 'DELETE')
     or has_table_privilege('authenticated', 'public.prospeccoes_clientes_historico', 'INSERT')
     or has_table_privilege('authenticated', 'public.prospeccoes_clientes_historico', 'UPDATE')
     or has_table_privilege('authenticated', 'public.prospeccoes_clientes_historico', 'DELETE') then
    raise exception 'fase65_escrita_direta_authenticated_concedida';
  end if;

  foreach v_function in array v_functions loop
    if to_regprocedure(v_function) is null then
      raise exception 'fase65_rpc_ausente: %', v_function;
    end if;
    if not has_function_privilege('authenticated', v_function, 'EXECUTE') then
      raise exception 'fase65_rpc_authenticated_sem_execucao: %', v_function;
    end if;
    if has_function_privilege('anon', v_function, 'EXECUTE') then
      raise exception 'fase65_rpc_anon_com_execucao: %', v_function;
    end if;
    if not (select prosecdef from pg_proc where oid = to_regprocedure(v_function)) then
      raise exception 'fase65_rpc_nao_security_definer: %', v_function;
    end if;
    if position('app_requires_2fa' in pg_get_functiondef(to_regprocedure(v_function))) = 0 then
      raise exception 'fase65_rpc_sem_gate_2fa: %', v_function;
    end if;
  end loop;

  if not exists (select 1 from pg_constraint where conname = 'prospeccao_cliente_contato_obrigatorio')
     or not exists (select 1 from pg_constraint where conname = 'prospeccao_cliente_perda_motivo')
     or not exists (select 1 from pg_constraint where conname = 'prospeccao_cliente_conversao_coerente') then
    raise exception 'fase65_constraints_de_negocio_ausentes';
  end if;

  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and tablename = 'prospeccoes_clientes'
       and indexdef ilike '%unique%proposta_id%'
  ) then
    raise exception 'fase65_proposta_id_sem_unicidade';
  end if;

  raise notice 'fase65_ok: RLS, grants, RPCs security definer e constraints verificados';
end;
$$;

rollback;

-- Matriz manual autenticada (usar fixtures descartáveis num ambiente isolado):
-- 1. Admin e parceiro aprovado em AAL1 não leem contatos nem executam RPCs; em AAL2 podem operar conforme o escopo.
-- 2. Partner A lê os próprios prospects; Partner B não lê nem movimenta A.
-- 3. Team member A1 lê apenas equipe A1; equipe A2 e Partner B ficam invisíveis.
-- 4. Soft-deleted não pode ser lido diretamente pela tabela nem pelo histórico.
-- 5. Team member não consegue reatribuir equipe; Partner A só aponta para equipe A.
-- 6. Admin full/limitado/comercial lê e opera globalmente; Admin jurídico recebe forbidden.
-- 7. authenticated sem RPC não insere/edita tabelas; anon não executa nenhuma RPC.
-- 8. Perda sem motivo < 3 falha; concorrência com status esperado antigo falha sem sobrescrever.
-- 9. Conversão fora de 'qualificado' falha; dupla conversão não cria segunda proposta.
-- 10. Conversão válida grava partner/equipe/proposta/status/histórico em uma transação.
