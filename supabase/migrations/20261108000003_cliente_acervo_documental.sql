-- Acervo por titular. Sem backfill implícito dos documentos anteriores.
create table public.cliente_documentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  categoria text not null check (categoria in ('pessoa_fisica','pessoa_juridica','imovel')),
  proposta_contexto_id uuid references public.propostas(id) on delete restrict,
  tipo public.documento_tipo not null,
  created_at timestamptz not null default now(),
  check ((categoria='imovel') = (proposta_contexto_id is not null)),
  unique nulls not distinct(cliente_id,categoria,tipo,proposta_contexto_id)
);
create table public.cliente_documento_versoes (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.cliente_documentos(id) on delete restrict,
  versao int not null check (versao > 0),
  bucket text not null,
  storage_path text not null,
  nome text not null,
  mime_type text,
  tamanho_bytes bigint,
  enviado_por uuid references public.usuarios(id) on delete set null,
  proposta_id uuid not null references public.propostas(id) on delete restrict,
  pendencia_id uuid references public.proposta_pendencias(id) on delete restrict,
  legado_id uuid unique references public.proposta_documentos(id) on delete restrict,
  requisicao text,
  estado text not null check (estado in ('preparado','recebido')),
  created_at timestamptz not null default now(),
  recebido_em timestamptz,
  unique(documento_id,versao), unique(bucket,storage_path), unique(enviado_por,requisicao)
);
alter table public.proposta_documentos add column cliente_documento_versao_id uuid references public.cliente_documento_versoes(id) on delete restrict;
create unique index proposta_documento_versao_uso on public.proposta_documentos(proposta_id,cliente_documento_versao_id) where cliente_documento_versao_id is not null;
alter table public.proposta_pendencias add column cliente_documento_id uuid references public.cliente_documentos(id) on delete restrict;
alter table public.cliente_documentos enable row level security;
alter table public.cliente_documento_versoes enable row level security;
revoke all on public.cliente_documentos, public.cliente_documento_versoes from public,anon,authenticated;
grant select on public.cliente_documentos, public.cliente_documento_versoes to authenticated;
create policy cliente_acervo_titular on public.cliente_documentos for select to authenticated using (cliente_id in (select id from public.clientes where usuario_id=auth.uid()));
create policy cliente_versoes_titular on public.cliente_documento_versoes for select to authenticated using (documento_id in (select id from public.cliente_documentos));

-- O portal do cliente inclui o principal e os coproponentes formalmente ligados
-- à proposta. O helper evita ciclos de RLS entre propostas e proponentes.
create function public.app_my_proposta_ids() returns setof uuid
language sql stable security definer set search_path=public,pg_temp as $$
 select p.id from public.propostas p
 where public.app_user_role()='client' and (
   p.cliente_id in (select public.app_my_cliente_ids())
   or exists(select 1 from public.proponentes pr join public.clientes c on c.id=pr.cliente_id where pr.proposta_id=p.id and c.usuario_id=auth.uid())
 );
$$;
revoke all on function public.app_my_proposta_ids() from public,anon;
grant execute on function public.app_my_proposta_ids() to authenticated;

drop policy if exists cliente_le_propria_proposta on public.propostas;
create policy cliente_le_propria_proposta on public.propostas for select to authenticated
 using (id in (select public.app_my_proposta_ids()));
drop policy if exists cliente_le_proponentes on public.proponentes;
create policy cliente_le_proponentes on public.proponentes for select to authenticated
 using (proposta_id in (select public.app_my_proposta_ids()));
drop policy if exists cliente_le_imoveis on public.imoveis;
create policy cliente_le_imoveis on public.imoveis for select to authenticated
 using (proposta_id in (select public.app_my_proposta_ids()));
drop policy if exists cliente_le_docs_propria on public.proposta_documentos;
create policy cliente_le_docs_propria on public.proposta_documentos for select to authenticated
 using (proposta_id in (select public.app_my_proposta_ids()));
drop policy if exists cliente_le_pendencias_propria on public.proposta_pendencias;
create policy cliente_le_pendencias_propria on public.proposta_pendencias for select to authenticated
 using (proposta_id in (select public.app_my_proposta_ids()));
drop policy if exists cliente_le_contrato on public.contratos;
create policy cliente_le_contrato on public.contratos for select to authenticated
 using (proposta_id in (select p.id from public.propostas p where p.id in (select public.app_my_proposta_ids()) and p.status::text <> 'pre_aprovado'));
drop policy if exists cliente_le_assinaturas on public.assinaturas_contrato;
create policy cliente_le_assinaturas on public.assinaturas_contrato for select to authenticated
 using (contrato_id in (select ct.id from public.contratos ct join public.propostas p on p.id=ct.proposta_id where p.id in (select public.app_my_proposta_ids()) and p.status::text <> 'pre_aprovado'));
drop policy if exists cliente_le_contrato_modelos on public.proposta_contrato_modelos;
create policy cliente_le_contrato_modelos on public.proposta_contrato_modelos for select to authenticated
 using (proposta_id in (select p.id from public.propostas p where p.id in (select public.app_my_proposta_ids()) and p.status::text <> 'pre_aprovado'));

create or replace function public.app_can_access_proposta_path(p_name text) returns boolean
language sql stable set search_path=public,pg_temp as $$
 select exists(select 1 from public.propostas p where p.id::text=split_part(p_name,'/',1) and (
   p.partner_id=public.app_partner_id() or p.equipe_id=public.app_equipe_id()
   or p.id in (select public.app_my_proposta_ids()) or public.app_is_admin()
 ));
$$;
create or replace function public.app_can_access_contrato_path(p_name text) returns boolean
language sql stable set search_path=public,pg_temp as $$
 select exists(select 1 from public.propostas p where p.id::text=split_part(p_name,'/',1) and (
   public.app_is_admin() or p.partner_id=public.app_partner_id() or p.equipe_id=public.app_equipe_id()
   or p.id in (select public.app_my_proposta_ids())
 ));
$$;

-- Retorna titular apenas quando a associação é inequívoca; nunca usa CPF/nome
-- aproximado nem atribui documentos de coproponentes ao cliente principal.
create function public.cliente_documento_titular(p_id uuid) returns uuid
language sql stable security definer set search_path=public,pg_temp as $$
 select case when d.categoria='imovel' then null
   when d.cliente_documento_versao_id is not null then (select cd.cliente_id from public.cliente_documento_versoes v join public.cliente_documentos cd on cd.id=v.documento_id where v.id=d.cliente_documento_versao_id)
   when d.proponente_id is not null then (select pr.cliente_id from public.proponentes pr join public.clientes c on c.id=pr.cliente_id
     where pr.id=d.proponente_id and pr.proposta_id=d.proposta_id and d.categoria=case when c.pessoa_tipo::text='PJ' then 'pessoa_juridica' else 'pessoa_fisica' end)
   when d.categoria=case when c.pessoa_tipo::text='PJ' then 'pessoa_juridica' else 'pessoa_fisica' end
    and not exists(select 1 from public.proponentes pr where pr.proposta_id=p.id and pr.cliente_id is distinct from p.cliente_id)
   then p.cliente_id else null end
 from public.proposta_documentos d join public.propostas p on p.id=d.proposta_id join public.clientes c on c.id=p.cliente_id where d.id=p_id;
$$;
revoke all on function public.cliente_documento_titular(uuid) from public,anon,authenticated;

create function public.cliente_acervo_indexar(p_id uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.proposta_documentos%rowtype; titular uuid; doc uuid; ver uuid;
begin
 select * into d from public.proposta_documentos where id=p_id for update;
 if d.cliente_documento_versao_id is not null then return d.cliente_documento_versao_id; end if;
 titular:=public.cliente_documento_titular(p_id);
 if titular is null or d.storage_path is null then return null; end if;
 -- Um objeto antigo repetido não será silenciosamente atribuído a dois titulares.
 select v.id into ver from public.cliente_documento_versoes v join public.cliente_documentos cd on cd.id=v.documento_id
 where v.bucket=d.bucket and v.storage_path=d.storage_path and cd.cliente_id=titular and cd.tipo=d.tipo and cd.categoria=d.categoria;
 if ver is null then
   insert into public.cliente_documentos(cliente_id,categoria,tipo) values(titular,d.categoria,d.tipo)
     on conflict(cliente_id,categoria,tipo,proposta_contexto_id) do nothing;
   select id into doc from public.cliente_documentos where cliente_id=titular and categoria=d.categoria and tipo=d.tipo for update;
   insert into public.cliente_documento_versoes(documento_id,versao,bucket,storage_path,nome,mime_type,tamanho_bytes,enviado_por,proposta_id,legado_id,estado,recebido_em)
     select doc,coalesce(max(versao),0)+1,d.bucket,d.storage_path,split_part(d.storage_path,'/',-1),d.mime_type,d.tamanho_bytes,d.enviado_por,d.proposta_id,d.id,'recebido',d.created_at
     from public.cliente_documento_versoes where documento_id=doc returning id into ver;
 end if;
 if not exists(select 1 from public.proposta_documentos where proposta_id=d.proposta_id and cliente_documento_versao_id=ver and id<>d.id) then
   update public.proposta_documentos set cliente_documento_versao_id=ver where id=d.id;
 end if;
 return ver;
end; $$;
revoke all on function public.cliente_acervo_indexar(uuid) from public,anon,authenticated;

create function public.cliente_acervo_novo_documento() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.storage_path is not null and new.cliente_documento_versao_id is null then perform public.cliente_acervo_indexar(new.id); end if;
 return new;
end; $$;
revoke all on function public.cliente_acervo_novo_documento() from public,anon,authenticated;
create trigger cliente_acervo_novo_documento after insert on public.proposta_documentos for each row execute function public.cliente_acervo_novo_documento();

create function public.cliente_acervo_obter() returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare resultado jsonb;
begin
 if auth.uid() is null or public.app_user_role() is distinct from 'client' then raise exception 'forbidden' using errcode='42501'; end if;
 select jsonb_build_object(
 'arquivos',coalesce((select jsonb_agg(x order by x.created_at desc) from (
   select d.id,d.proposta_id,d.categoria,d.tipo,d.bucket,d.storage_path,d.status,d.created_at,d.cliente_documento_versao_id,
     coalesce(v.nome,split_part(d.storage_path,'/',-1)) as nome,coalesce(v.versao,1) as versao,
     public.cliente_documento_titular(d.id) as cliente_id
   from public.proposta_documentos d left join public.cliente_documento_versoes v on v.id=d.cliente_documento_versao_id
   where d.storage_path is not null and (
     public.cliente_documento_titular(d.id) in (select id from public.clientes where usuario_id=auth.uid())
     or (d.categoria='imovel' and d.proposta_id in (select p.id from public.propostas p join public.clientes c on c.id=p.cliente_id where c.usuario_id=auth.uid()))
   )
 ) x),'[]'::jsonb),
 'solicitacoes',coalesce((select jsonb_agg(x) from (
   select pe.id,pe.proposta_id,pe.descricao,pe.documento_solicitado_tipo,pe.status,pe.prazo,pe.created_at,p.protocolo
   from public.proposta_pendencias pe join public.propostas p on p.id=pe.proposta_id
   where pe.status::text in ('aberta','rejeitada','em_analise') and p.status::text not in ('cancelado','completo','standby','simulacao')
     and (pe.responsavel_resolver=auth.uid() or (pe.responsavel_resolver is null and p.cliente_id in (select id from public.clientes where usuario_id=auth.uid())))
     and (p.cliente_id in (select id from public.clientes where usuario_id=auth.uid()) or exists(select 1 from public.proponentes pr join public.clientes c on c.id=pr.cliente_id where pr.proposta_id=p.id and c.usuario_id=auth.uid()))
 ) x),'[]'::jsonb)) into resultado;
 return resultado;
end; $$;
revoke all on function public.cliente_acervo_obter() from public,anon;
grant execute on function public.cliente_acervo_obter() to authenticated;

-- Preparação autenticada: o servidor determina titular, caminho e necessidade.
create function public.cliente_documento_preparar(p_proposta_id uuid,p_tipo public.documento_tipo,p_categoria text,p_nome text,p_mime text,p_tamanho bigint,p_requisicao text,p_pendencia_id uuid default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare titular uuid; doc uuid; v public.cliente_documento_versoes%rowtype; pend public.proposta_pendencias%rowtype; vid uuid:=gen_random_uuid();
begin
 if auth.uid() is null or public.app_user_role() is distinct from 'client' then raise exception 'forbidden' using errcode='42501'; end if;
 select c.id into titular from public.clientes c join public.propostas p on (p.cliente_id=c.id or exists(select 1 from public.proponentes pr where pr.proposta_id=p.id and pr.cliente_id=c.id))
 where p.id=p_proposta_id and c.usuario_id=auth.uid() and p.status::text not in ('cancelado','completo','standby','simulacao')
 and (p_categoria=case when c.pessoa_tipo::text='PJ' then 'pessoa_juridica' else 'pessoa_fisica' end or (p_categoria='imovel' and p.cliente_id=c.id)) order by (p.cliente_id=c.id) desc limit 1;
 if titular is null then raise exception 'titular_ou_proposta_indisponivel' using errcode='42501'; end if;
 if p_nome is null or length(trim(p_nome)) not between 1 and 180 or p_mime is null or p_mime not in ('application/pdf','image/jpeg','image/png') or p_tamanho is null or p_tamanho not between 1 and 20971520 or p_requisicao is null or length(p_requisicao) not between 8 and 100 then raise exception 'arquivo_invalido'; end if;
 if not exists(select 1 from public.documento_requisitos where categoria=p_categoria and tipo=p_tipo) then raise exception 'tipo_nao_aplicavel'; end if;
 perform pg_advisory_xact_lock(hashtextextended(titular::text||p_categoria||p_tipo::text,0));
 select * into v from public.cliente_documento_versoes where enviado_por=auth.uid() and requisicao=p_requisicao;
 if found then
   if v.proposta_id<>p_proposta_id or v.nome<>p_nome or v.mime_type<>p_mime or v.tamanho_bytes<>p_tamanho or v.pendencia_id is distinct from p_pendencia_id then raise exception 'requisicao_divergente'; end if;
   return to_jsonb(v);
 end if;
 if p_pendencia_id is not null then
   select * into pend from public.proposta_pendencias where id=p_pendencia_id and proposta_id=p_proposta_id for update;
   if not found or pend.documento_solicitado_tipo is distinct from p_tipo or pend.status::text not in ('aberta','rejeitada')
     or (pend.responsavel_resolver is not null and pend.responsavel_resolver<>auth.uid())
     or (pend.responsavel_resolver is null and not exists(select 1 from public.propostas where id=p_proposta_id and cliente_id=titular)) then raise exception 'solicitacao_indisponivel' using errcode='42501'; end if;
 else
   if exists(select 1 from public.proposta_documentos d where d.storage_path is not null and d.tipo=p_tipo and d.categoria=p_categoria and (public.cliente_documento_titular(d.id)=titular or (p_categoria='imovel' and d.proposta_id=p_proposta_id))) then raise exception 'documento_ja_recebido_use_acervo'; end if;
 end if;
 insert into public.cliente_documentos(cliente_id,categoria,tipo,proposta_contexto_id) values(titular,p_categoria,p_tipo,case when p_categoria='imovel' then p_proposta_id end) on conflict(cliente_id,categoria,tipo,proposta_contexto_id) do nothing;
 select id into doc from public.cliente_documentos where cliente_id=titular and categoria=p_categoria and tipo=p_tipo and proposta_contexto_id is not distinct from (case when p_categoria='imovel' then p_proposta_id end) for update;
 -- Retoma preparação pendente da mesma solicitação; não cria uploads concorrentes.
 select * into v from public.cliente_documento_versoes where documento_id=doc and estado='preparado' and pendencia_id is not distinct from p_pendencia_id order by created_at desc limit 1;
 if found then
   if v.nome=p_nome and v.mime_type=p_mime and v.tamanho_bytes=p_tamanho and v.enviado_por=auth.uid() then
     update public.cliente_documento_versoes set created_at=now() where id=v.id;
     return to_jsonb(v);
   end if;
   raise exception 'envio_em_andamento_retome_o_arquivo';
 end if;
 insert into public.cliente_documento_versoes(id,documento_id,versao,bucket,storage_path,nome,mime_type,tamanho_bytes,enviado_por,proposta_id,pendencia_id,requisicao,estado)
 select vid,doc,coalesce(max(versao),0)+1,'cliente-docs',titular::text||'/'||vid::text,p_nome,p_mime,p_tamanho,auth.uid(),p_proposta_id,p_pendencia_id,p_requisicao,'preparado'
 from public.cliente_documento_versoes where documento_id=doc returning * into v;
 return to_jsonb(v);
end; $$;
revoke all on function public.cliente_documento_preparar(uuid,public.documento_tipo,text,text,text,bigint,text,uuid) from public,anon;
grant execute on function public.cliente_documento_preparar(uuid,public.documento_tipo,text,text,text,bigint,text,uuid) to authenticated;

create function public.cliente_documento_finalizar(p_versao_id uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.cliente_documento_versoes%rowtype; d public.cliente_documentos%rowtype; objeto storage.objects%rowtype; pid uuid; pend public.proposta_pendencias%rowtype;
begin
 if auth.uid() is null or public.app_user_role() is distinct from 'client' then raise exception 'forbidden' using errcode='42501'; end if;
 select * into v from public.cliente_documento_versoes where id=p_versao_id and enviado_por=auth.uid() for update;
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 select * into d from public.cliente_documentos where id=v.documento_id and cliente_id in (select id from public.clientes where usuario_id=auth.uid());
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 select id into pid from public.proposta_documentos where proposta_id=v.proposta_id and cliente_documento_versao_id=v.id;
 if v.estado='recebido' then return pid; end if;
 if not exists(select 1 from public.propostas p where p.id=v.proposta_id and p.status::text not in ('cancelado','completo','standby','simulacao') and (p.cliente_id=d.cliente_id or exists(select 1 from public.proponentes pr where pr.proposta_id=p.id and pr.cliente_id=d.cliente_id))) then raise exception 'proposta_indisponivel'; end if;
 if v.pendencia_id is not null then
   select * into pend from public.proposta_pendencias where id=v.pendencia_id for update;
   if pend.status::text not in ('aberta','rejeitada') or (pend.responsavel_resolver is not null and pend.responsavel_resolver<>auth.uid()) then raise exception 'solicitacao_indisponivel'; end if;
 end if;
 select * into objeto from storage.objects where bucket_id=v.bucket and name=v.storage_path;
 if not found or (objeto.metadata->>'size')::bigint is distinct from v.tamanho_bytes or objeto.metadata->>'mimetype' is distinct from v.mime_type then raise exception 'arquivo_nao_confirmado'; end if;
 insert into public.proposta_documentos(proposta_id,proponente_id,categoria,tipo,bucket,storage_path,mime_type,tamanho_bytes,enviado_por,origem,status,cliente_documento_versao_id)
 values(v.proposta_id,(select id from public.proponentes where proposta_id=v.proposta_id and cliente_id=d.cliente_id order by principal desc limit 1),d.categoria,d.tipo,v.bucket,v.storage_path,v.mime_type,v.tamanho_bytes,auth.uid(),'cliente','enviado',v.id) returning id into pid;
 update public.cliente_documento_versoes set estado='recebido',recebido_em=now() where id=v.id;
 if v.pendencia_id is not null then update public.proposta_pendencias set status='em_analise',updated_at=now() where id=v.pendencia_id; end if;
 return pid;
end; $$;
revoke all on function public.cliente_documento_finalizar(uuid) from public,anon;
grant execute on function public.cliente_documento_finalizar(uuid) to authenticated;

create function public.cliente_documento_reutilizar(p_documento_origem uuid,p_proposta_id uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.proposta_documentos%rowtype; titular uuid; vid uuid; destino uuid;
begin
 if auth.uid() is null or public.app_user_role() is distinct from 'client' then raise exception 'forbidden' using errcode='42501'; end if;
 select * into d from public.proposta_documentos where id=p_documento_origem and storage_path is not null;
 titular:=public.cliente_documento_titular(p_documento_origem);
 if titular is null or not exists(select 1 from public.clientes where id=titular and usuario_id=auth.uid()) then raise exception 'forbidden' using errcode='42501'; end if;
 if d.status='rejeitado' then raise exception 'documento_rejeitado'; end if;
 if not exists(select 1 from public.propostas p where id=p_proposta_id and status::text not in ('cancelado','completo','standby','simulacao') and (cliente_id=titular or exists(select 1 from public.proponentes pr where pr.proposta_id=p.id and pr.cliente_id=titular))) then raise exception 'forbidden' using errcode='42501'; end if;
 if exists(select 1 from public.proposta_pendencias where proposta_id=p_proposta_id and documento_solicitado_tipo=d.tipo and status::text in ('aberta','rejeitada') and (responsavel_resolver is null or responsavel_resolver=auth.uid())) then raise exception 'atualizacao_solicitada_envie_nova_versao'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_proposta_id::text||titular::text||d.tipo::text,0));
 vid:=public.cliente_acervo_indexar(d.id);
 select id into destino from public.proposta_documentos where proposta_id=p_proposta_id and cliente_documento_versao_id=vid;
 if destino is not null then return destino; end if;
 insert into public.proposta_documentos(proposta_id,proponente_id,categoria,tipo,bucket,storage_path,mime_type,tamanho_bytes,enviado_por,origem,status,cliente_documento_versao_id)
 values(p_proposta_id,(select id from public.proponentes where proposta_id=p_proposta_id and cliente_id=titular order by principal desc limit 1),d.categoria,d.tipo,d.bucket,d.storage_path,d.mime_type,d.tamanho_bytes,auth.uid(),'cliente','enviado',vid) returning id into destino;
 return destino;
end; $$;
revoke all on function public.cliente_documento_reutilizar(uuid,uuid) from public,anon;
grant execute on function public.cliente_documento_reutilizar(uuid,uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('cliente-docs','cliente-docs',false,20971520,array['application/pdf','image/jpeg','image/png']);
create policy cliente_acervo_upload on storage.objects for insert to authenticated with check (
 bucket_id='cliente-docs' and exists(select 1 from public.cliente_documento_versoes v where v.bucket=bucket_id and v.storage_path=name and v.enviado_por=auth.uid() and v.estado='preparado' and v.created_at>now()-interval '24 hours')
);
-- Não conceder leitura global a qualquer usuário autenticado só porque o caminho
-- existe no acervo. Autorizar titular, participantes da proposta ou Admin.
create function public.cliente_acervo_pode_ler(p_bucket text,p_path text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select public.app_is_admin() is true or exists (
   select 1 from public.cliente_documento_versoes v
   join public.cliente_documentos cd on cd.id=v.documento_id
   where v.bucket=p_bucket and v.storage_path=p_path and (
     cd.cliente_id in (select c.id from public.clientes c where c.usuario_id=auth.uid())
     or exists (
       select 1 from public.proposta_documentos pd
       join public.propostas p on p.id=pd.proposta_id
       where pd.cliente_documento_versao_id=v.id and (
         p.partner_id=public.app_partner_id()
         or p.equipe_id=public.app_equipe_id()
         or p.cliente_id in (select c.id from public.clientes c where c.usuario_id=auth.uid())
         or exists(select 1 from public.proponentes pr join public.clientes c on c.id=pr.cliente_id where pr.proposta_id=p.id and c.usuario_id=auth.uid())
       )
     )
   )
 );
$$;
revoke all on function public.cliente_acervo_pode_ler(text,text) from public,anon;
grant execute on function public.cliente_acervo_pode_ler(text,text) to authenticated;
create policy cliente_acervo_storage_read on storage.objects for select to authenticated using (
 bucket_id='cliente-docs' and public.cliente_acervo_pode_ler(bucket_id,name)
);
create policy cliente_acervo_preservar_delete on storage.objects as restrictive for delete to authenticated using (
 not exists(select 1 from public.cliente_documento_versoes v where v.bucket=bucket_id and v.storage_path=name)
);
create policy cliente_acervo_preservar_update on storage.objects as restrictive for update to authenticated using (
 not exists(select 1 from public.cliente_documento_versoes v where v.bucket=bucket_id and v.storage_path=name)
);
-- Nada é migrado em lote. Consulta de diagnóstico para revisão interna.
create function public.admin_cliente_acervo_dry_run() returns table(situacao text,quantidade bigint)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if public.app_is_admin() is not true then raise exception 'forbidden' using errcode='42501'; end if;
 return query select case when d.categoria='imovel' then 'vinculado_ao_imovel' when public.cliente_documento_titular(d.id) is null then 'titular_ambiguo' when d.cliente_documento_versao_id is not null then 'ja_indexado' else 'elegivel_para_reuso' end,count(*) from public.proposta_documentos d where d.storage_path is not null group by 1;
end; $$;
revoke all on function public.admin_cliente_acervo_dry_run() from public,anon;
grant execute on function public.admin_cliente_acervo_dry_run() to authenticated;

-- Mantém as policies de upload do bucket legado para compatibilidade com apps
-- mobile já instalados. O fluxo novo usa as RPCs do acervo; o trigger acima só
-- indexa uploads legados quando consegue provar a titularidade sem ambiguidade.
create function public.cliente_acervo_objeto_preservado(p_bucket text,p_path text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.cliente_documento_versoes where bucket=p_bucket and storage_path=p_path);
$$;
revoke all on function public.cliente_acervo_objeto_preservado(text,text) from public,anon;
grant execute on function public.cliente_acervo_objeto_preservado(text,text) to authenticated;
alter policy cliente_acervo_preservar_delete on storage.objects using (not public.cliente_acervo_objeto_preservado(bucket_id,name));
alter policy cliente_acervo_preservar_update on storage.objects using (not public.cliente_acervo_objeto_preservado(bucket_id,name));

-- Configuração sem valor inventado. A equipe pode preencher a chave no Admin.
insert into public.configuracoes_sistema(chave,valor,descricao) values('cliente_atendimento_whatsapp','null'::jsonb,'WhatsApp oficial de atendimento ao cliente, com DDI e apenas dígitos') on conflict(chave) do nothing;
create function public.cliente_atendimento_contato() returns text
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare numero text;
begin
 if auth.uid() is null then raise exception 'forbidden' using errcode='42501'; end if;
 select valor#>>'{}' into numero from public.configuracoes_sistema where chave='cliente_atendimento_whatsapp';
 if numero ~ '^[0-9]{10,15}$' then return numero; end if;
 return null;
end; $$;
revoke all on function public.cliente_atendimento_contato() from public,anon;
grant execute on function public.cliente_atendimento_contato() to authenticated;
