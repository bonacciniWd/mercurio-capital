-- =============================================
-- MIGRATION 009 — AUTH BRIDGE (handle_new_user + me() RPC)
-- =============================================

-- 1) Auto-criar usuarios quando auth.users for inserido.
--    O perfil padrão é "client". Outros papéis sobem via app_metadata
--    setado pelas Edge Functions / convites administrativos.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role   user_role;
  v_nome   text;
  v_tel    text;
  v_ddi    text;
begin
  v_role := coalesce(
    (new.raw_user_meta_data ->> 'role')::user_role,
    (new.raw_app_meta_data  ->> 'role')::user_role,
    'client'::user_role
  );

  v_nome := coalesce(
    new.raw_user_meta_data ->> 'nome_completo',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)
  );

  v_tel := new.raw_user_meta_data ->> 'telefone';
  v_ddi := coalesce(new.raw_user_meta_data ->> 'telefone_ddi', '55');

  insert into public.usuarios (id, nome_completo, email, role, telefone, telefone_ddi)
  values (new.id, v_nome, new.email, v_role, v_tel, v_ddi)
  on conflict (id) do update
    set email        = excluded.email,
        nome_completo = excluded.nome_completo;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) RPC public.me() — retorna identidade + claims efetivas do usuário logado.
--    Usado pelo frontend logo após login para hidratar AuthContext.

create or replace function public.me()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row json;
begin
  if v_uid is null then
    return null;
  end if;

  select json_build_object(
    'id',             u.id,
    'email',          u.email,
    'nome',           u.nome_completo,
    'role',           u.role,
    'ativo',          u.ativo,
    'partner_id',     p.id,
    'partner_status', p.status,
    'equipe_id',      em.equipe_id,
    'approved', case
                  when u.role = 'partner'      then coalesce(p.status,  'pending'::partner_status) = 'approved'
                  when u.role = 'team_member'  then em.aceito_em is not null
                  else true
                end,
    'requires_2fa',   (u.role in ('admin','partner'))
  )
  into v_row
  from public.usuarios u
  left join public.partners        p  on p.usuario_id = u.id
  left join public.equipe_membros  em on em.usuario_id = u.id
  where u.id = v_uid
  limit 1;

  return v_row;
end;
$$;

grant execute on function public.me() to authenticated;

-- 3) RPC opcional: registrar um partner self-service.
--    Cria entry mínima em partners(status='pending') vinculada ao auth.uid().

create or replace function public.partner_self_register(
  p_cpf text default null,
  p_dados_bancarios jsonb default null
)
returns partners
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row partners%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  update public.usuarios set role = 'partner' where id = v_uid and role = 'client';

  insert into public.partners (usuario_id, cpf, dados_bancarios, status)
  values (v_uid, p_cpf, p_dados_bancarios, 'pending')
  on conflict (usuario_id) do update
    set cpf = coalesce(excluded.cpf, partners.cpf),
        dados_bancarios = coalesce(excluded.dados_bancarios, partners.dados_bancarios)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.partner_self_register(text, jsonb) to authenticated;

