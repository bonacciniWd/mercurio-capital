-- Fase 38 — simulador público v2
-- Executar somente após aplicar a migration correspondente no ambiente de teste.
-- Este smoke é read-only: não cria lead nem dispara e-mail.

do $$
begin
  if to_regclass('public.simulacao_leads_publicos') is null then
    raise exception 'tabela simulacao_leads_publicos ausente';
  end if;

  if to_regclass('public.v_admin_simulacao_leads_publicos') is null then
    raise exception 'view v_admin_simulacao_leads_publicos ausente';
  end if;

  if to_regprocedure('public.capture_public_simulacao_lead(uuid,text,text,text,numeric,numeric,text,text,text,numeric,text,text,text,text,text)') is null then
    raise exception 'RPC capture_public_simulacao_lead ausente';
  end if;

  if not exists (
    select 1 from public.templates_mensagem
     where codigo = 'simulacao_publica_resultado_v1' and canal = 'email' and ativo
  ) then
    raise exception 'template de resultado do prospect ausente ou inativo';
  end if;

  if not exists (
    select 1 from public.templates_mensagem
     where codigo = 'simulacao_publica_novo_lead_interno_v1' and canal = 'email' and ativo
  ) then
    raise exception 'template interno ausente ou inativo';
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'simulacao_leads_publicos'
       and policyname = 'simulacao_leads_publicos_admin_read'
  ) then
    raise exception 'RLS admin da tabela de leads ausente';
  end if;

  raise notice 'fase-38 simulador público: estrutura, RPC, templates e RLS OK';
end
$$;
