-- =============================================
-- FIX: Dominio canonico para links transacionais
-- Data: 2026-07-06
-- =============================================

insert into public.configuracoes_sistema (chave, valor, descricao)
values
  (
    'app_url',
    to_jsonb('https://mercuriocapitalsa.com.br'::text),
    'URL canônica do app para links de convite e redirecionamentos transacionais.'
  ),
  (
    'frontend_url',
    to_jsonb('https://mercuriocapitalsa.com.br'::text),
    'URL pública do frontend web (fallback legado para links).' 
  ),
  (
    'site_url',
    to_jsonb('https://mercuriocapitalsa.com.br'::text),
    'URL institucional/canônica utilizada como fallback de links.'
  )
on conflict (chave) do update
set valor = excluded.valor,
    descricao = coalesce(public.configuracoes_sistema.descricao, excluded.descricao),
    updated_at = now();

update public.templates_mensagem
   set corpo = replace(corpo, 'https://app.mercuriocapital.com.br', 'https://mercuriocapitalsa.com.br'),
       updated_at = now()
 where canal = 'email'
   and position('https://app.mercuriocapital.com.br' in coalesce(corpo, '')) > 0;
