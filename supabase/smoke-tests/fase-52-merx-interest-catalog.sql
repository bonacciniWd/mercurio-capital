-- Run only in a local/test database after migration 20261030000003.
-- Synthetic records only; transaction is always rolled back.
begin;

insert into public.merx_leads_publicos (
  idempotency_key, nome_completo, email, telefone, interesse, pagina_origem
) values
  ('52000000-0000-4000-8000-000000000001', 'Teste Originador', 'originador@example.invalid', '41999990001', 'parceiro_originador', '/'),
  ('52000000-0000-4000-8000-000000000002', 'Teste Financiamento', 'financiamento@example.invalid', '41999990002', 'financiamento_imobiliario', '/');

do $$
begin
  begin
    insert into public.merx_leads_publicos (
      idempotency_key, nome_completo, email, telefone, interesse, pagina_origem
    ) values (
      '52000000-0000-4000-8000-000000000003', 'Teste inválido', 'invalido@example.invalid', '41999990003', 'role_admin', '/'
    );
    raise exception 'interesse inválido foi aceito';
  exception when check_violation then
    null;
  end;
end;
$$;

rollback;
