-- Expand the existing public contact lead interest catalog. No new table,
-- identity, proposal link, or public read/write privilege is introduced.
alter table public.merx_leads_publicos
  drop constraint if exists merx_leads_publicos_interesse_check;

alter table public.merx_leads_publicos
  add constraint merx_leads_publicos_interesse_check
  check (interesse in (
    'atendimento',
    'home_equity',
    'construcao',
    'financiamento_imobiliario',
    'parceiro_originador'
  ));

comment on column public.merx_leads_publicos.interesse is
  'Intenção declarada pelo visitante no formulário público MERX; não cria parceiro nem proposta.';
