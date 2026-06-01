-- =============================================
-- FIX: search_path deve incluir extensions para digest() (pgcrypto)
-- nas RPCs que consomem/emitem magic_links.
-- =============================================
-- O fluxo /magic/<token> chama cliente_peek_proposta e cliente_consume_magic;
-- a página da proposta chama partner_reissue_magic_link; convites de equipe
-- também usam digest(). Todas estavam declaradas com `set search_path = public`,
-- causando "function digest(text, unknown) does not exist".

alter function public.cliente_consume_magic(text)
  set search_path = public, extensions;

alter function public.cliente_peek_proposta(text)
  set search_path = public, extensions;

alter function public.partner_reissue_magic_link(uuid)
  set search_path = public, extensions;
