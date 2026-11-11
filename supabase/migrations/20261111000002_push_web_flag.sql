-- Flag de rollout do push web (Frente A, issue #16).
-- Nasce DESLIGADA: rollout progressivo via regras (roles/partner_ids/percent)
-- pela UI /admin/feature-flags. Kill switch sem deploy (dispatcher + cliente).

insert into public.feature_flags (chave, descricao, regras, ativo)
values (
  'push_web',
  'Push web (FCM): banner de opt-in, seção em Configurações, cartão do cliente e dispatcher. Ver runbooks.md §17.',
  '{}',
  false
)
on conflict (chave) do nothing;
