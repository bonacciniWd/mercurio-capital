-- Configurable grace period for the mobile device lock, independent of session expiry.
insert into public.configuracoes_sistema (chave, valor, descricao)
values ('mobile_relock_segundos', '60'::jsonb, 'Segundos em segundo plano antes de exigir desbloqueio do aparelho no app mobile')
on conflict (chave) do nothing;
