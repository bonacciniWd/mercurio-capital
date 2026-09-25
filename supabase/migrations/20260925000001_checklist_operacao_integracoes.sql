-- Checklist operacional da esteira rápida CGI/Home Equity.
-- Reaproveita o catálogo existente de documento_requisitos e torna explícitos
-- os itens necessários para a conferência inicial da proposta.

update public.documento_requisitos
   set obrigatorio = true
 where (categoria, tipo) in (
   ('pessoa_fisica', 'extrato_bancario'),
   ('pessoa_juridica', 'extrato_bancario'),
   ('imovel', 'fotos_imovel')
 );

insert into public.documento_requisitos (categoria, tipo, obrigatorio, ordem)
values
  ('pessoa_fisica', 'extrato_bancario', true, 50),
  ('pessoa_juridica', 'extrato_bancario', true, 20),
  ('imovel', 'fotos_imovel', true, 30)
on conflict (categoria, tipo) do update
  set obrigatorio = excluded.obrigatorio,
      ordem = excluded.ordem;

comment on table public.documento_requisitos is
  'Checklist de abertura e análise documental da proposta; itens obrigatórios bloqueiam a conclusão da conferência.';
