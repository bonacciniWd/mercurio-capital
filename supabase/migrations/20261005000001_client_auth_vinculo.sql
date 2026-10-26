-- Vincula clientes legados às contas Auth somente quando a correspondência
-- for única e o papel efetivo da conta for client.

create temporary table _cliente_auth_links (
  cliente_id uuid primary key,
  usuario_id uuid not null
) on commit drop;

with candidatos as (
  select
    c.id as cliente_id,
    au.id as usuario_id,
    count(*) over (partition by lower(btrim(c.email))) as clientes_com_email,
    coalesce(
      u.role::text,
      au.raw_app_meta_data ->> 'role',
      au.raw_user_meta_data ->> 'role',
      'client'
    ) as papel_efetivo
  from public.clientes c
  join auth.users au
    on lower(btrim(au.email)) = lower(btrim(c.email))
  left join public.usuarios u on u.id = au.id
  where c.usuario_id is null
    and nullif(btrim(c.email), '') is not null
)
insert into _cliente_auth_links (cliente_id, usuario_id)
select c.cliente_id, c.usuario_id
  from candidatos c
 where c.clientes_com_email = 1
   and c.papel_efetivo = 'client'
   and not exists (
     select 1
       from public.clientes already_linked
      where already_linked.usuario_id = c.usuario_id
   );

update public.clientes c
   set usuario_id = links.usuario_id
  from _cliente_auth_links links
 where c.id = links.cliente_id
   and c.usuario_id is null;

-- Contas Auth legadas criadas antes do bridge podem não ter espelho em
-- public.usuarios. Cria somente o espelho de contas client já vinculadas.
insert into public.usuarios (
  id,
  nome_completo,
  email,
  role,
  telefone_ddi,
  telefone,
  ativo
)
select
  au.id,
  coalesce(
    nullif(au.raw_user_meta_data ->> 'nome_completo', ''),
    nullif(au.raw_user_meta_data ->> 'name', ''),
    c.nome_completo,
    split_part(au.email, '@', 1),
    'Cliente'
  ),
  au.email,
  'client'::public.user_role,
  coalesce(nullif(au.raw_user_meta_data ->> 'telefone_ddi', ''), c.telefone_ddi, '55'),
  coalesce(nullif(au.raw_user_meta_data ->> 'telefone', ''), c.telefone),
  true
from public.clientes c
join auth.users au on au.id = c.usuario_id
left join public.usuarios u on u.id = au.id
where u.id is null
  and coalesce(
    au.raw_app_meta_data ->> 'role',
    au.raw_user_meta_data ->> 'role',
    'client'
  ) = 'client'
on conflict (id) do nothing;

insert into public.audit_log (
  usuario_id,
  acao,
  entidade,
  entidade_id,
  payload_depois
)
select
  null,
  'cliente_usuario_vinculado_migracao',
  'clientes',
  links.cliente_id,
  jsonb_build_object('usuario_id', links.usuario_id, 'origem', 'email_unico')
from _cliente_auth_links links;
