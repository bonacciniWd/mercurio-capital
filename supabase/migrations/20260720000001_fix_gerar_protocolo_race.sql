-- =============================================
-- Fix: gerar_protocolo() gera duplicatas
-- =============================================
-- Problema: a função original usava `count(*) + 1` sobre a tabela
-- propostas do ano corrente para calcular o próximo número. Isso
-- causava violação da constraint UNIQUE `propostas_protocolo_key`
-- em dois cenários:
--   1. Concorrência: dois inserts simultâneos leem o mesmo count.
--   2. Gaps por delete/importação: se já existe protocolo maior
--      que count+1 para o ano, o novo protocolo colide.
--
-- Correção:
--   - Usar `max(sequência)+1` extraindo o número do protocolo do
--     próprio ano (robusto a gaps).
--   - Envolver com `pg_advisory_xact_lock` (chave = ano) para
--     serializar geradores concorrentes dentro do mesmo ano.
--   - Fallback com loop de retry por segurança extra.

create or replace function gerar_protocolo()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_seq       bigint;
  v_ano_int   int;
  v_ano_txt   text;
  v_candidato text;
  v_tentativa int := 0;
begin
  -- Se protocolo já foi informado explicitamente, respeita.
  if new.protocolo is not null and new.protocolo <> '' then
    return new;
  end if;

  v_ano_int := extract(year from now())::int;
  v_ano_txt := v_ano_int::text;

  -- Serializa geração por ano dentro da transação.
  perform pg_advisory_xact_lock(hashtext('gerar_protocolo:' || v_ano_txt));

  -- Extrai o maior número já usado para o ano corrente diretamente
  -- do padrão MERC-YYYY-NNNNNN. Isso é robusto a deletes e a
  -- importações que criaram gaps.
  select coalesce(
           max(
             nullif(regexp_replace(protocolo, '^MERC-' || v_ano_txt || '-', ''), '')::bigint
           ),
           0
         ) + 1
    into v_seq
    from propostas
   where protocolo ~ ('^MERC-' || v_ano_txt || '-\d+$');

  v_candidato := format('MERC-%s-%s', v_ano_txt, lpad(v_seq::text, 6, '0'));

  -- Loop defensivo (não deveria ser necessário com o advisory lock,
  -- mas garante avanço caso já exista o candidato).
  while exists (select 1 from propostas where protocolo = v_candidato) loop
    v_seq := v_seq + 1;
    v_candidato := format('MERC-%s-%s', v_ano_txt, lpad(v_seq::text, 6, '0'));
    v_tentativa := v_tentativa + 1;
    if v_tentativa > 10000 then
      raise exception 'gerar_protocolo: não foi possível alocar protocolo único para o ano %', v_ano_txt;
    end if;
  end loop;

  new.protocolo := v_candidato;
  return new;
end;
$$;
comment on function gerar_protocolo() is
  'Gera protocolo MERC-YYYY-NNNNNN de forma concorrência-segura usando advisory lock por ano e max(sequência)+1.';
