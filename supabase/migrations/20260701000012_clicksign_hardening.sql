-- Clicksign hardening (ciclo 2): unicidade de envelope e request signature key.
-- Objetivo: reduzir ambiguidade no webhook e proteger mapeamento de assinatura.

create unique index if not exists contratos_provider_envelope_id_uq
  on public.contratos (provider_envelope_id)
  where provider_envelope_id is not null;

create unique index if not exists assinaturas_contrato_provider_request_key_uq
  on public.assinaturas_contrato (provider_request_signature_key)
  where provider_request_signature_key is not null;
