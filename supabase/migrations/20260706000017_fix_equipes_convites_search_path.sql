-- =============================================
-- FIX: Convites de equipe devem enxergar pgcrypto (digest)
-- Data: 2026-07-06
-- Contexto: partner_invite_membro / membro_accept_convite
-- =============================================

-- Garantia defensiva para ambientes em que a extensão ainda não existe.
create extension if not exists pgcrypto with schema extensions;

alter function public.partner_invite_membro(uuid, text, text, text, jsonb)
  set search_path = public, extensions;

alter function public.membro_accept_convite(text)
  set search_path = public, extensions;
