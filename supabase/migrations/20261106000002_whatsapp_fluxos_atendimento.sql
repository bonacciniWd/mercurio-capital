-- Additive WhatsApp orchestration. All delivery flags remain disabled.
create table public.whatsapp_template_versoes (
 id uuid primary key default gen_random_uuid(), template_id uuid not null references public.templates_mensagem(id),
 versao int not null check(versao>0), nome_meta text not null check(nome_meta ~ '^[a-z][a-z0-9_]{1,90}$'), idioma text not null default 'pt_BR',
 categoria text not null default 'UTILITY' check(categoria='UTILITY'), componentes jsonb not null, parametros text[] not null default '{}',
 conteudo_hash text not null, estado_local text not null default 'rascunho' check(estado_local in ('rascunho','publicado')),
 conta_id text not null default '', meta_template_id text, estado_meta text, motivo_meta text, sincronizado_em timestamptz,
 publicado_por uuid references public.usuarios(id), created_at timestamptz not null default now(),
 unique(template_id,versao), unique(conta_id,nome_meta,idioma), check(octet_length(componentes::text)<=20000)
);
create table public.whatsapp_fluxo_versoes (
 id uuid primary key default gen_random_uuid(), fluxo_id uuid not null references public.fluxos_evolution(id), versao int not null,
 schema_version int not null default 1, nodes jsonb not null, edges jsonb not null, viewport jsonb not null,
 conteudo_hash text not null, publicado_por uuid not null references public.usuarios(id), publicado_em timestamptz not null default now(),
 flow_json jsonb, meta_flow_id text, estado_meta text, erros_meta jsonb, sincronizado_em timestamptz,
 unique(fluxo_id,versao), check(jsonb_array_length(nodes) between 2 and 60), check(jsonb_array_length(edges)<=100),
 check(octet_length(nodes::text)+octet_length(edges::text)<=100000)
);
alter table public.templates_mensagem add column whatsapp_versao_id uuid references public.whatsapp_template_versoes(id);
alter table public.fluxos_evolution add column modo text check(modo in ('notificacao','atendimento')),
 add column rascunho jsonb, add column whatsapp_versao_id uuid references public.whatsapp_fluxo_versoes(id);
create table public.whatsapp_atendimentos (
 id uuid primary key default gen_random_uuid(), phone_number_id text not null, sender_phone text not null check(sender_phone ~ '^\+[0-9]{8,15}$'),
 estado text not null default 'bot' check(estado in ('bot','fila_humana','humano','encerrado','optout')),
 ultima_mensagem_em timestamptz not null, expira_em timestamptz not null default(now()+interval '60 days'),
 fluxo_versao_id uuid references public.whatsapp_fluxo_versoes(id), no_atual_id text,
 responsavel_id uuid references public.usuarios(id), usuario_id uuid references public.usuarios(id), proposta_id uuid references public.propostas(id),
 contexto jsonb not null default '{}', flow_token_hash text, flow_token_expira_em timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(octet_length(contexto::text)<=4000)
);
create unique index whatsapp_atendimento_aberto on public.whatsapp_atendimentos(phone_number_id,sender_phone) where estado not in ('encerrado','optout');
create table public.whatsapp_consentimentos (
 id uuid primary key default gen_random_uuid(), phone_number_id text not null, telefone text not null check(telefone ~ '^\+[0-9]{8,15}$'),
 finalidade text not null check(finalidade in ('notificacoes','atendimento')), estado text not null check(estado in ('autorizado','revogado')),
 origem text not null, versao_texto text not null, registrado_em timestamptz not null default now(),
 usuario_id uuid references public.usuarios(id), evento_comprovante_id uuid references public.whatsapp_mensagens_recebidas(id) on delete set null,
 revogado_em timestamptz, unique(phone_number_id,telefone,finalidade)
);
create table public.whatsapp_eventos (
 id uuid primary key default gen_random_uuid(), evento text not null, chave_origem text not null,
 fluxo_versao_id uuid not null references public.whatsapp_fluxo_versoes(id), ocorrido_em timestamptz not null default now(),
 proposta_id uuid references public.propostas(id), usuario_id uuid references public.usuarios(id),
 atendimento_id uuid references public.whatsapp_atendimentos(id) on delete set null,
 mensagem_id uuid references public.whatsapp_mensagens_recebidas(id) on delete set null,
 contexto jsonb not null default '{}', status text not null default 'pendente' check(status in ('pendente','processando','concluido','erro')),
 tentativas int not null default 0, disponivel_em timestamptz not null default now(), reserva uuid, reservado_em timestamptz, motivo text,
 unique(chave_origem,fluxo_versao_id), check(octet_length(contexto::text)<=2000)
);
alter table public.fluxo_execucoes add column whatsapp_versao_id uuid references public.whatsapp_fluxo_versoes(id),
 add column whatsapp_evento_id uuid references public.whatsapp_eventos(id), add column simulado boolean not null default false;
create unique index whatsapp_evento_execucao on public.fluxo_execucoes(whatsapp_evento_id) where whatsapp_evento_id is not null;
alter table public.whatsapp_mensagens add column atendimento_id uuid references public.whatsapp_atendimentos(id) on delete set null,
 add column template_versao_id uuid references public.whatsapp_template_versoes(id), add column whatsapp_evento_id uuid references public.whatsapp_eventos(id),
 add column idempotency_key text, add column payload_envio jsonb, add column reserva uuid, add column reservado_em timestamptz,
 add column expires_at timestamptz not null default(now()+interval '60 days');
create unique index whatsapp_saida_idempotencia on public.whatsapp_mensagens(idempotency_key);
alter table public.whatsapp_mensagens drop constraint if exists whatsapp_mensagens_status_check;
alter table public.whatsapp_mensagens add constraint whatsapp_mensagens_status_check check(status in ('pendente','processando','enviado','entregue','lido','erro','bloqueado','incerto'));
alter table public.whatsapp_mensagens_recebidas add column atendimento_id uuid references public.whatsapp_atendimentos(id) on delete set null,
 add column interacao jsonb check(octet_length(interacao::text)<=4000);

-- Restricted operators see only explicitly assigned proposal context, never unmatched inbox.
create function public.whatsapp_pode_atender(p_id uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.app_is_admin_full() or (public.app_is_admin() and exists(
 select 1 from public.whatsapp_atendimentos a join public.propostas p on p.id=a.proposta_id
 where a.id=p_id and a.responsavel_id=auth.uid() and p.responsavel_id=auth.uid() and a.usuario_id is not null));
$$;
revoke all on function public.whatsapp_pode_atender(uuid) from public;
grant execute on function public.whatsapp_pode_atender(uuid) to authenticated;
do $$ declare t text; begin
 foreach t in array array['whatsapp_template_versoes','whatsapp_fluxo_versoes','whatsapp_eventos','whatsapp_consentimentos'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy whatsapp_full_read on public.%I for select to authenticated using(public.app_is_admin_full())',t);
 end loop;
end $$;
alter table public.whatsapp_atendimentos enable row level security;
revoke all on public.whatsapp_atendimentos from public,anon,authenticated;
grant select on public.whatsapp_atendimentos to authenticated; grant all on public.whatsapp_atendimentos to service_role;
create policy whatsapp_atendimento_read on public.whatsapp_atendimentos for select to authenticated using(public.whatsapp_pode_atender(id));
drop policy if exists whatsapp_mensagens_admin_read on public.whatsapp_mensagens;
create policy whatsapp_mensagens_admin_read on public.whatsapp_mensagens for select to authenticated using(public.app_is_admin_full() or public.whatsapp_pode_atender(atendimento_id));
drop policy if exists whatsapp_mensagens_recebidas_admin_read on public.whatsapp_mensagens_recebidas;
create policy whatsapp_mensagens_recebidas_admin_read on public.whatsapp_mensagens_recebidas for select to authenticated using(public.app_is_admin_full() or public.whatsapp_pode_atender(atendimento_id));

create function public.whatsapp_preservar_versao() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if TG_TABLE_NAME='whatsapp_fluxo_versoes' and (to_jsonb(old)-array['flow_json','meta_flow_id','estado_meta','erros_meta','sincronizado_em']) is distinct from (to_jsonb(new)-array['flow_json','meta_flow_id','estado_meta','erros_meta','sincronizado_em']) then raise exception 'versao_imutavel'; end if;
 if TG_TABLE_NAME='whatsapp_template_versoes' and (old.estado_local='publicado' or old.meta_template_id is not null) and (to_jsonb(old)-array['estado_meta','motivo_meta','sincronizado_em','estado_local','meta_template_id','publicado_por','conta_id']) is distinct from (to_jsonb(new)-array['estado_meta','motivo_meta','sincronizado_em','estado_local','meta_template_id','publicado_por','conta_id']) then raise exception 'versao_imutavel'; end if;
 return new;
end $$;
create trigger whatsapp_fluxo_imutavel before update on public.whatsapp_fluxo_versoes for each row execute function public.whatsapp_preservar_versao();
create trigger whatsapp_template_imutavel before update on public.whatsapp_template_versoes for each row execute function public.whatsapp_preservar_versao();

-- Persist a validated draft and publish its immutable snapshot atomically. Service-only.
create function public.whatsapp_fluxo_salvar(p_id uuid,p_nome text,p_modo text,p_graph jsonb,p_actor uuid,p_publicar boolean default false) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_version uuid; v_event text; begin
 if p_modo not in ('notificacao','atendimento') or length(btrim(p_nome)) not between 1 and 120 or jsonb_array_length(p_graph->'nodes') not between 2 and 60 or jsonb_array_length(p_graph->'edges')>100 then raise exception 'fluxo_invalido'; end if;
 select n->'data'->>'event' into v_event from jsonb_array_elements(p_graph->'nodes') n where n->'data'->>'kind'='entry';
 if p_id is null then
 insert into public.fluxos_evolution(nome,trigger_evento,modo,rascunho,ativo,created_by) values(p_nome,v_event,p_modo,p_graph,false,p_actor) returning id into v_id;
 else
 perform 1 from public.fluxos_evolution where id=p_id and modo is not null for update; if not found then raise exception 'fluxo_nao_encontrado'; end if;
 update public.fluxos_evolution set nome=p_nome,trigger_evento=v_event,modo=p_modo,rascunho=p_graph,updated_at=now() where id=p_id returning id into v_id;
 end if;
 if p_publicar then
 insert into public.whatsapp_fluxo_versoes(fluxo_id,versao,nodes,edges,viewport,conteudo_hash,publicado_por)
 select v_id,coalesce(max(versao),0)+1,p_graph->'nodes',p_graph->'edges',p_graph->'viewport',md5(p_graph::text),p_actor from public.whatsapp_fluxo_versoes where fluxo_id=v_id returning id into v_version;
 update public.fluxos_evolution set whatsapp_versao_id=v_version where id=v_id;
 end if;
 insert into public.audit_log(usuario_id,acao,entidade,entidade_id) values(p_actor,case when p_publicar then 'whatsapp_fluxo_publicado' else 'whatsapp_fluxo_rascunho' end,'fluxos_evolution',v_id);
 return v_id;
end $$;

-- Flags are checked before capturing any events; there is no backfill.
create function public.whatsapp_capturar_evento() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare j jsonb:=to_jsonb(new); o jsonb; ev text; pid uuid; uid uuid; cfg jsonb; source text; begin
 select configuracoes into cfg from public.integracoes_config where chave='whatsapp' and ativo;
 if not coalesce((cfg->>'automacoes_habilitadas')::boolean,false) then return new; end if;
 if TG_OP='UPDATE' then o:=to_jsonb(old); end if;
 case TG_TABLE_NAME
 when 'usuarios' then ev:='conta_criada'; uid:=new.id;
 when 'partners' then if j->>'status'=o->>'status' or j->>'status'<>'approved' then return new; end if; ev:='partner_aprovado'; uid:=(j->>'usuario_id')::uuid;
 when 'propostas' then pid:=new.id; if TG_OP='INSERT' then ev:='proposta_criada'; elsif j->>'status' is distinct from o->>'status' then ev:='proposta_status_changed'; else return new; end if;
 when 'proposta_pendencias' then ev:='pendencia_aberta'; pid:=(j->>'proposta_id')::uuid; uid:=(j->>'responsavel_resolver')::uuid;
 when 'contratos' then if j->>'provider_envelope_id' is null or j->>'provider_envelope_id'=o->>'provider_envelope_id' then return new; end if; ev:='contrato_disponivel'; pid:=(j->>'proposta_id')::uuid;
 else return new; end case;
 source:=TG_TABLE_NAME||':'||(j->>'id')||':'||coalesce(j->>'updated_at',j->>'created_at',clock_timestamp()::text)||':'||ev;
 insert into public.whatsapp_eventos(evento,chave_origem,fluxo_versao_id,proposta_id,usuario_id,contexto)
 select ev,source,f.whatsapp_versao_id,pid,uid,jsonb_strip_nulls(jsonb_build_object('evento',ev,'status',j->>'status','produto',j->>'produto','pendencia_id',case when TG_TABLE_NAME='proposta_pendencias' then j->>'id' end))
 from public.fluxos_evolution f where f.modo='notificacao' and f.ativo and f.whatsapp_versao_id is not null and f.trigger_evento=ev on conflict do nothing;
 if TG_TABLE_NAME='propostas' and TG_OP='UPDATE' and j->>'status'='recurso_liberado' and j->>'status' is distinct from o->>'status' then
 insert into public.whatsapp_eventos(evento,chave_origem,fluxo_versao_id,proposta_id,contexto)
 select 'recurso_liberado',source||':liberado',f.whatsapp_versao_id,pid,jsonb_build_object('evento','recurso_liberado','status',j->>'status') from public.fluxos_evolution f where f.modo='notificacao' and f.ativo and f.trigger_evento='recurso_liberado' and f.whatsapp_versao_id is not null on conflict do nothing;
 end if;
 return new;
end $$;
create trigger whatsapp_event_usuario after insert on public.usuarios for each row execute function public.whatsapp_capturar_evento();
create trigger whatsapp_event_partner after update of status on public.partners for each row execute function public.whatsapp_capturar_evento();
create trigger whatsapp_event_proposta after insert or update of status on public.propostas for each row execute function public.whatsapp_capturar_evento();
create trigger whatsapp_event_pendencia after insert on public.proposta_pendencias for each row execute function public.whatsapp_capturar_evento();
create trigger whatsapp_event_contrato after insert or update of provider_envelope_id on public.contratos for each row execute function public.whatsapp_capturar_evento();

create function public.whatsapp_recebida_enfileirar() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare cfg jsonb; aid uuid; vid uuid; begin
 select configuracoes into cfg from public.integracoes_config where chave='whatsapp' and ativo;
 if not coalesce((cfg->>'atendimento_habilitado')::boolean,false) then return new; end if;
 select f.whatsapp_versao_id into vid from public.fluxos_evolution f where f.id=nullif(cfg->>'atendimento_fluxo_id','')::uuid and f.ativo and f.modo='atendimento';
 if vid is null then return new; end if;
 insert into public.whatsapp_atendimentos(phone_number_id,sender_phone,ultima_mensagem_em,fluxo_versao_id) values(new.phone_number_id,new.sender_phone,new.received_at,vid)
 on conflict(phone_number_id,sender_phone) where estado not in ('encerrado','optout') do update set ultima_mensagem_em=greatest(whatsapp_atendimentos.ultima_mensagem_em,excluded.ultima_mensagem_em),expira_em=now()+interval '60 days' returning id into aid;
 update public.whatsapp_mensagens_recebidas set atendimento_id=aid where id=new.id;
 insert into public.whatsapp_eventos(evento,chave_origem,fluxo_versao_id,atendimento_id,mensagem_id)
 select 'mensagem_recebida','inbound:'||new.provider_message_id,fluxo_versao_id,aid,new.id from public.whatsapp_atendimentos where id=aid on conflict do nothing;
 return new;
end $$;
create trigger whatsapp_event_inbound after insert on public.whatsapp_mensagens_recebidas for each row execute function public.whatsapp_recebida_enfileirar();

create function public.whatsapp_eventos_pull(p_limit int default 10) returns setof public.whatsapp_eventos language plpgsql security definer set search_path=public,pg_temp as $$
begin
 return query with picked as (select id from public.whatsapp_eventos where status='pendente' and disponivel_em<=now() order by ocorrido_em limit least(20,greatest(1,p_limit)) for update skip locked)
 update public.whatsapp_eventos e set status='processando',reserva=gen_random_uuid(),reservado_em=now(),tentativas=e.tentativas+1 from picked where e.id=picked.id returning e.*;
end $$;

-- Resolve consent-bound identities from trusted relational data, not from payload phone numbers.
create function public.whatsapp_evento_destinatarios(p_id uuid,p_roles text[]) returns table(usuario_id uuid,nome text,telefone text,papel text,variaveis jsonb)
language sql stable security definer set search_path=public,pg_temp as $$
 with ev as(select * from public.whatsapp_eventos where id=p_id), pr as(select p.* from public.propostas p join ev on p.id=ev.proposta_id),
 candidates as (
 select ev.usuario_id id,'titular' papel from ev where ev.usuario_id is not null
 union select c.usuario_id,'principal' from pr join public.clientes c on c.id=pr.cliente_id
 union select pa.usuario_id,'originador' from pr join public.partners pa on pa.id=pr.partner_id
 union select pr.responsavel_id,'responsavel' from pr
 union select u.id,'signatario' from pr join public.contratos ct on ct.proposta_id=pr.id join public.assinaturas_contrato a on a.contrato_id=ct.id join public.usuarios u on lower(u.email)=lower(a.signatario_email)
 where (select count(*) from public.usuarios uu where lower(uu.email)=lower(a.signatario_email))=1
 )
 select distinct on (u.id) u.id,u.nome_completo,c.telefone,k.papel,
 jsonb_build_object('nome',split_part(u.nome_completo,' ',1),'protocolo',pr.protocolo,'status',replace(initcap(coalesce(ev.contexto->>'status',pr.status::text)),'_',' '),'nome_doc',coalesce((select documento_solicitado_tipo::text from public.proposta_pendencias where id=nullif(ev.contexto->>'pendencia_id','')::uuid),'documentos'),
 'link',case when pr.id is null then 'https://www.mercuriocapitalsa.com.br/'||case when u.role::text='admin' then 'admin' when u.role::text='client' then 'c' else 'p' end||'/login' else case when u.role::text='admin' then 'https://www.mercuriocapitalsa.com.br/admin/propostas/' when u.role::text='client' then 'https://www.mercuriocapitalsa.com.br/c/propostas/' else 'https://www.mercuriocapitalsa.com.br/p/propostas/' end||coalesce(pr.id::text,'') end)
 from candidates k join public.usuarios u on u.id=k.id and u.ativo cross join ev left join pr on true
 join public.whatsapp_consentimentos c on c.usuario_id=u.id and c.finalidade='notificacoes' and c.estado='autorizado'
 and c.phone_number_id=(select configuracoes->>'phone_number_id' from public.integracoes_config where chave='whatsapp')
 and regexp_replace(c.telefone,'\D','','g')=public.wa_normalizar_telefone(u.telefone_ddi,u.telefone)
 where k.papel=any(p_roles) and not exists(select 1 from public.partner_notif_prefs pref join public.partners pp on pp.id=pref.partner_id where pp.usuario_id=u.id and not pref.whatsapp)
 order by u.id,k.papel;
$$;

-- Commit outbox actions and checkpoint in one transaction. A losing/stale worker cannot commit.
create function public.whatsapp_evento_concluir(p_id uuid,p_reserva uuid,p_saidas jsonb,p_caminho jsonb,p_atendimento jsonb default null) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.whatsapp_eventos%rowtype; s jsonb; mid uuid; begin
 select * into e from public.whatsapp_eventos where id=p_id and reserva=p_reserva and status='processando' for update;
 if not found then raise exception 'reserva_invalida'; end if;
 if jsonb_array_length(p_saidas)>50 then raise exception 'limite_saidas'; end if;
 if e.atendimento_id is not null then
 perform 1 from public.whatsapp_atendimentos where id=e.atendimento_id and estado='bot' for update;
 if not found then p_saidas:='[]'; p_atendimento:=null; end if;
 end if;
 for s in select * from jsonb_array_elements(p_saidas) loop
 insert into public.whatsapp_mensagens(usuario_id,telefone,corpo,status,atendimento_id,template_versao_id,whatsapp_evento_id,idempotency_key,payload_envio,origem,destinatario_papel)
 values(nullif(s->>'usuario_id','')::uuid,s->>'telefone',s->>'corpo','pendente',e.atendimento_id,nullif(s->>'template_versao_id','')::uuid,e.id,e.id||':'||(s->>'node')||':'||md5(regexp_replace(s->>'telefone','\D','','g')),s->'payload','fluxo',s->>'destinatario_papel') on conflict(idempotency_key) do nothing;
 end loop;
 if e.atendimento_id is not null and p_atendimento is not null then
 update public.whatsapp_atendimentos set no_atual_id=p_atendimento->>'node',estado=coalesce(p_atendimento->>'estado',estado),flow_token_hash=p_atendimento->>'flow_token_hash',flow_token_expira_em=(p_atendimento->>'flow_token_expira_em')::timestamptz,contexto=coalesce(p_atendimento->'contexto','{}'),updated_at=now()
 where id=e.atendimento_id and estado='bot';
 end if;
 insert into public.fluxo_execucoes(fluxo_id,gatilho,status,resultado,whatsapp_versao_id,whatsapp_evento_id,finalizado_em)
 select fluxo_id,e.evento,'sucesso',jsonb_build_object('caminho',p_caminho,'saidas',jsonb_array_length(p_saidas)),e.fluxo_versao_id,e.id,now() from public.whatsapp_fluxo_versoes where id=e.fluxo_versao_id;
 update public.whatsapp_eventos set status='concluido',contexto='{}' where id=e.id;
end $$;

create or replace function public.whatsapp_outbox_pull(p_limit int default 20) returns setof public.whatsapp_mensagens language plpgsql security definer set search_path=public,pg_temp as $$
begin
 -- A crashed request has unknown delivery outcome; never retry it blindly.
 update public.whatsapp_mensagens set status='incerto',erro='reserva_expirada_reconciliar' where status='processando' and reservado_em<now()-interval '5 minutes';
 return query with picked as(select id from public.whatsapp_mensagens where status='pendente' and agendado_para<=now() and expires_at>now() order by agendado_para limit least(50,greatest(1,p_limit)) for update skip locked)
 update public.whatsapp_mensagens m set status='processando',reserva=gen_random_uuid(),reservado_em=now(),tentativas=m.tentativas+1,atualizado_em=now() from picked where m.id=picked.id returning m.*;
end $$;
create or replace function public.whatsapp_mensagem_marcar(p_id uuid,p_status text,p_erro text default null,p_evolution_id text default null) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_status not in ('enviado','entregue','lido','erro','bloqueado','incerto') then raise exception 'status_invalido'; end if;
 update public.whatsapp_mensagens set status=p_status,erro=p_erro,evolution_message_id=coalesce(p_evolution_id,evolution_message_id),enviado_em=case when p_status='enviado' then coalesce(enviado_em,now()) else enviado_em end,atualizado_em=now()
 where id=p_id and status not in ('entregue','lido') or id=p_id and status='entregue' and p_status='lido';
end $$;

-- Minimum content retention; immutable audit records and opt-out are not deleted.
create function public.whatsapp_conteudo_expurgar() returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.whatsapp_mensagens set corpo='[conteúdo expirado]',payload_envio=null,metadata='{}',telefone='[expirado]' where expires_at<=now() and corpo<>'[conteúdo expirado]';
 update public.whatsapp_atendimentos set contexto='{}',flow_token_hash=null,flow_token_expira_em=null,sender_phone='+00000000',estado='encerrado' where expira_em<=now() and sender_phone<>'+00000000';
 update public.whatsapp_eventos set contexto='{}' where ocorrido_em<now()-interval '60 days' and contexto<>'{}';
end $$;
select cron.schedule('whatsapp-conteudo-expurgo-diario','20 3 * * *','select public.whatsapp_conteudo_expurgar();');

-- No callable worker/mutation function is granted to application users.
revoke all on function public.whatsapp_fluxo_salvar(uuid,text,text,jsonb,uuid,boolean),public.whatsapp_eventos_pull(int),public.whatsapp_evento_destinatarios(uuid,text[]),public.whatsapp_evento_concluir(uuid,uuid,jsonb,jsonb,jsonb),public.whatsapp_conteudo_expurgar() from public,anon,authenticated;
grant execute on function public.whatsapp_fluxo_salvar(uuid,text,text,jsonb,uuid,boolean),public.whatsapp_eventos_pull(int),public.whatsapp_evento_destinatarios(uuid,text[]),public.whatsapp_evento_concluir(uuid,uuid,jsonb,jsonb,jsonb),public.whatsapp_conteudo_expurgar() to service_role;
revoke all on function public.whatsapp_capturar_evento(),public.whatsapp_recebida_enfileirar(),public.whatsapp_preservar_versao() from public,anon,authenticated;
update public.integracoes_config set configuracoes=configuracoes||jsonb_build_object('envio_habilitado',false,'automacoes_habilitadas',false,'atendimento_habilitado',false) where chave='whatsapp';

insert into public.templates_mensagem(codigo,canal,nome,corpo,variaveis,ativo,wa_template_nome,wa_idioma) values
('wa_conta_criada_v1','whatsapp','WhatsApp · Conta criada','Olá {{nome}}, sua conta na Mercúrio Capital foi criada. Acesse o workspace para acompanhar as informações do seu cadastro.','{nome}',false,'mercurio_conta_criada_v1','pt_BR') on conflict(codigo) do nothing;

-- Atomic quota reservation; metadata records only a timestamp, never the provider payload.
create function public.whatsapp_envio_permitir(p_id uuid) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.whatsapp_mensagens%rowtype; cfg jsonb; h int; begin
 perform pg_advisory_xact_lock(hashtext('whatsapp-envio-quota'));
 select * into r from public.whatsapp_mensagens where id=p_id and status='processando' for update;
 if not found then return false; end if;
 select configuracoes into cfg from public.integracoes_config where chave='whatsapp' and ativo;
 if not coalesce((cfg->>'envio_habilitado')::boolean,false) then return false; end if;
 h:=extract(hour from now() at time zone 'America/Sao_Paulo');
 if r.atendimento_id is null and (h<coalesce((cfg->>'hora_inicio')::int,8) or h>=coalesce((cfg->>'hora_fim')::int,20)) then return false; end if;
 if (select count(*) from public.whatsapp_mensagens where (metadata->>'envio_autorizado_em')::timestamptz>now()-interval '1 day')>=coalesce((cfg->>'limite_diario')::int,100) then return false; end if;
 if (select count(*) from public.whatsapp_mensagens where telefone=r.telefone and (metadata->>'envio_autorizado_em')::timestamptz>now()-interval '1 hour')>=coalesce((cfg->>'limite_destinatario_hora')::int,10) then return false; end if;
 update public.whatsapp_mensagens set metadata=metadata||jsonb_build_object('envio_autorizado_em',now()) where id=p_id;
 return true;
end $$;
revoke all on function public.whatsapp_envio_permitir(uuid) from public,anon,authenticated;
grant execute on function public.whatsapp_envio_permitir(uuid) to service_role;

-- Opt-out is handled independently of the bot flag, before any future dispatch.
create or replace function public.whatsapp_recebida_enfileirar() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare cfg jsonb; aid uuid; vid uuid; stop boolean; begin
 stop:=lower(btrim(coalesce(new.text_body,''))) ~ '^(sair|parar|stop|cancelar|nao quero receber mensagens|não quero receber mensagens)$';
 if stop then
 insert into public.whatsapp_consentimentos(phone_number_id,telefone,finalidade,estado,origem,versao_texto,evento_comprovante_id,revogado_em)
 select new.phone_number_id,new.sender_phone,p,'revogado','whatsapp_inbound','optout_v1',new.id,now() from unnest(array['notificacoes','atendimento']) p
 on conflict(phone_number_id,telefone,finalidade) do update set estado='revogado',revogado_em=now(),evento_comprovante_id=new.id;
 update public.whatsapp_atendimentos set estado='optout',flow_token_hash=null,flow_token_expira_em=null where phone_number_id=new.phone_number_id and sender_phone=new.sender_phone;
 return new;
 end if;
 update public.whatsapp_atendimentos set ultima_mensagem_em=greatest(ultima_mensagem_em,new.received_at),expira_em=now()+interval '60 days'
 where phone_number_id=new.phone_number_id and sender_phone=new.sender_phone and estado not in ('encerrado','optout');
 select configuracoes into cfg from public.integracoes_config where chave='whatsapp' and ativo;
 if not coalesce((cfg->>'atendimento_habilitado')::boolean,false) then return new; end if;
 if exists(select 1 from public.whatsapp_consentimentos where phone_number_id=new.phone_number_id and telefone=new.sender_phone and estado='revogado') then return new; end if;
 select f.whatsapp_versao_id into vid from public.fluxos_evolution f where f.id=nullif(cfg->>'atendimento_fluxo_id','')::uuid and f.ativo and f.modo='atendimento';
 if vid is null then return new; end if;
 insert into public.whatsapp_atendimentos(phone_number_id,sender_phone,ultima_mensagem_em,fluxo_versao_id) values(new.phone_number_id,new.sender_phone,new.received_at,vid)
 on conflict(phone_number_id,sender_phone) where estado not in ('encerrado','optout') do update set ultima_mensagem_em=greatest(whatsapp_atendimentos.ultima_mensagem_em,excluded.ultima_mensagem_em),expira_em=now()+interval '60 days' returning id into aid;
 update public.whatsapp_mensagens_recebidas set atendimento_id=aid where id=new.id;
 insert into public.whatsapp_eventos(evento,chave_origem,fluxo_versao_id,atendimento_id,mensagem_id)
 select 'mensagem_recebida','inbound:'||new.provider_message_id,fluxo_versao_id,aid,new.id from public.whatsapp_atendimentos where id=aid on conflict do nothing;
 return new;
end $$;
create or replace function public.whatsapp_eventos_pull(p_limit int default 10) returns setof public.whatsapp_eventos language plpgsql security definer set search_path=public,pg_temp as $$
begin
 -- Event workers have no external side effects: a lost lease can safely resume.
 update public.whatsapp_eventos set status='pendente',reserva=null,reservado_em=null where status='processando' and reservado_em<now()-interval '5 minutes';
 return query with picked as (
 select e.id from public.whatsapp_eventos e where e.status='pendente' and e.disponivel_em<=now()
 and (e.atendimento_id is null or (not exists(select 1 from public.whatsapp_eventos earlier where earlier.atendimento_id=e.atendimento_id and (earlier.status='processando' or earlier.status='pendente' and (earlier.ocorrido_em,earlier.id)<(e.ocorrido_em,e.id)))))
 order by e.ocorrido_em,e.id limit least(20,greatest(1,p_limit)) for update skip locked)
 update public.whatsapp_eventos e set status='processando',reserva=gen_random_uuid(),reservado_em=now(),tentativas=e.tentativas+1 from picked where e.id=picked.id returning e.*;
end $$;

-- Background scheduling reads a dedicated credential from Vault, never from source.
create function public.whatsapp_workers_tick() returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare cfg jsonb; token text; base text; begin
 select configuracoes into cfg from public.integracoes_config where chave='whatsapp' and ativo;
 if not(coalesce((cfg->>'envio_habilitado')::boolean,false) or coalesce((cfg->>'atendimento_habilitado')::boolean,false) or coalesce((cfg->>'automacoes_habilitadas')::boolean,false)) then return; end if;
 select decrypted_secret into token from vault.decrypted_secrets where name='WHATSAPP_WORKER_SECRET' limit 1;
 base:=cfg->>'functions_base_url';
 if length(token)<32 or base !~ '^https://[a-z0-9]+\.supabase\.co/functions/v1$' or token is null or base is null then return; end if;
 perform net.http_post(url:=base||'/whatsapp-worker',headers:=jsonb_build_object('Authorization','Bearer '||token,'Content-Type','application/json'),body:='{}'::jsonb);
 perform net.http_post(url:=base||'/whatsapp-dispatcher',headers:=jsonb_build_object('Authorization','Bearer '||token,'Content-Type','application/json'),body:='{}'::jsonb);
end $$;
revoke all on function public.whatsapp_workers_tick() from public,anon,authenticated,service_role;
select cron.schedule('whatsapp-worker-dispatch','* * * * *','select public.whatsapp_workers_tick();');

-- Closed sessions are immutable to a late worker; an operator checkpoint wins.
create or replace function public.whatsapp_operador_estado(p_id uuid,p_actor uuid,p_estado text,p_esperado text,p_updated timestamptz) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_estado not in ('humano','bot','encerrado') then raise exception 'estado_invalido'; end if;
 update public.whatsapp_atendimentos set estado=p_estado,responsavel_id=p_actor,no_atual_id=case when p_estado='bot' then null else no_atual_id end,contexto='{}',flow_token_hash=null,flow_token_expira_em=null,updated_at=now()
 where id=p_id and estado=p_esperado and estado<>'optout' and updated_at=p_updated;
 if not found then raise exception 'atendimento_alterado_recarregue'; end if;
 insert into public.audit_log(usuario_id,acao,entidade,entidade_id) values(p_actor,'whatsapp_operador_'||p_estado,'whatsapp_atendimentos',p_id);
end $$;
revoke all on function public.whatsapp_operador_estado(uuid,uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.whatsapp_operador_estado(uuid,uuid,text,text,timestamptz) to service_role;

alter table public.whatsapp_atendimentos add column vinculado_em timestamptz;
create function public.whatsapp_mensagem_visivel(p_atendimento uuid,p_em timestamptz) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.app_is_admin_full() or (public.whatsapp_pode_atender(p_atendimento) and exists(select 1 from public.whatsapp_atendimentos where id=p_atendimento and vinculado_em<=p_em));
$$;
revoke all on function public.whatsapp_mensagem_visivel(uuid,timestamptz) from public;
grant execute on function public.whatsapp_mensagem_visivel(uuid,timestamptz) to authenticated;
drop policy whatsapp_mensagens_admin_read on public.whatsapp_mensagens;
create policy whatsapp_mensagens_admin_read on public.whatsapp_mensagens for select to authenticated using(public.whatsapp_mensagem_visivel(atendimento_id,created_at));
drop policy whatsapp_mensagens_recebidas_admin_read on public.whatsapp_mensagens_recebidas;
create policy whatsapp_mensagens_recebidas_admin_read on public.whatsapp_mensagens_recebidas for select to authenticated using(public.whatsapp_mensagem_visivel(atendimento_id,created_at));
create function public.whatsapp_vincular(p_id uuid,p_email text,p_proposta uuid,p_actor uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.whatsapp_atendimentos%rowtype; uid uuid; owner uuid; begin
 select * into a from public.whatsapp_atendimentos where id=p_id for update;
 if not found or a.estado in ('encerrado','optout') then raise exception 'atendimento_indisponivel'; end if;
 if (select count(*) from public.usuarios where lower(email)=lower(btrim(p_email)) and ativo)<>1 then raise exception 'identidade_ambigua'; end if;
 select id into uid from public.usuarios where lower(email)=lower(btrim(p_email)) and ativo;
 if not exists(select 1 from public.usuarios where id=uid and public.wa_normalizar_telefone(telefone_ddi,telefone)=regexp_replace(a.sender_phone,'\D','','g')) then raise exception 'telefone_divergente'; end if;
 if a.usuario_id is not null and (a.usuario_id<>uid or a.proposta_id is distinct from p_proposta) then raise exception 'encerre_o_contexto_anterior_primeiro'; end if;
 if p_proposta is not null then
 if not exists(select 1 from public.propostas p left join public.clientes c on c.id=p.cliente_id left join public.partners pa on pa.id=p.partner_id where p.id=p_proposta and (c.usuario_id=uid or pa.usuario_id=uid or p.responsavel_id=uid or exists(select 1 from public.contratos ct join public.assinaturas_contrato s on s.contrato_id=ct.id join public.usuarios u on u.id=uid and lower(u.email)=lower(s.signatario_email) where ct.proposta_id=p.id) or exists(select 1 from public.proponentes pr join public.clientes pc on pc.id=pr.cliente_id where pr.proposta_id=p.id and pc.usuario_id=uid))) then raise exception 'usuario_sem_vinculo_com_proposta'; end if;
 select responsavel_id into owner from public.propostas where id=p_proposta;
 end if;
 update public.whatsapp_atendimentos set usuario_id=uid,proposta_id=p_proposta,responsavel_id=coalesce(owner,p_actor),vinculado_em=coalesce(vinculado_em,now()),updated_at=now() where id=p_id;
 insert into public.audit_log(usuario_id,acao,entidade,entidade_id,payload_depois) values(p_actor,'whatsapp_contexto_verificado','whatsapp_atendimentos',p_id,jsonb_build_object('usuario_id',uid,'proposta_id',p_proposta));
end $$;
create function public.whatsapp_autorizacao_registrar(p_id uuid,p_actor uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.whatsapp_atendimentos%rowtype; mid uuid; begin
 select * into a from public.whatsapp_atendimentos where id=p_id and usuario_id is not null and vinculado_em is not null for update;
 if not found then raise exception 'verifique_o_contexto_primeiro'; end if;
 -- The human operator verifies identity separately; an inbound affirmative records the recipient's decision.
 select id into mid from public.whatsapp_mensagens_recebidas where atendimento_id=a.id and lower(btrim(text_body)) in ('autorizo notificacoes','autorizo notificações') and received_at>=a.vinculado_em order by received_at desc limit 1;
 if mid is null then raise exception 'aguardando_autorizacao_explicita_do_titular'; end if;
 insert into public.whatsapp_consentimentos(phone_number_id,telefone,finalidade,estado,origem,versao_texto,usuario_id,evento_comprovante_id)
 values(a.phone_number_id,a.sender_phone,'notificacoes','autorizado','atendimento_humano_verificado','notificacoes_v1',a.usuario_id,mid)
 on conflict(phone_number_id,telefone,finalidade) do update set estado='autorizado',origem=excluded.origem,versao_texto=excluded.versao_texto,usuario_id=excluded.usuario_id,evento_comprovante_id=excluded.evento_comprovante_id,registrado_em=now(),revogado_em=null;
 -- A separately revoked service session is not silently re-enabled by notification opt-in.
 insert into public.audit_log(usuario_id,acao,entidade,entidade_id) values(p_actor,'whatsapp_autorizacao_titular','whatsapp_atendimentos',p_id);
end $$;
revoke all on function public.whatsapp_vincular(uuid,text,uuid,uuid), public.whatsapp_autorizacao_registrar(uuid,uuid) from public,anon,authenticated;
grant execute on function public.whatsapp_vincular(uuid,text,uuid,uuid), public.whatsapp_autorizacao_registrar(uuid,uuid) to service_role;

alter table public.whatsapp_mensagens add column solicitado_por uuid references public.usuarios(id);
alter table public.whatsapp_mensagens add column destinatario_papel text;
create function public.whatsapp_outbox_destinatario_valido(p_id uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(
   select 1 from public.whatsapp_mensagens m
   join public.whatsapp_eventos e on e.id=m.whatsapp_evento_id
   cross join lateral public.whatsapp_evento_destinatarios(e.id,array[m.destinatario_papel]) d
   where m.id=p_id and m.template_versao_id is not null and m.destinatario_papel is not null
     and d.usuario_id=m.usuario_id
     and regexp_replace(d.telefone,'[^0-9]','','g')=regexp_replace(m.telefone,'[^0-9]','','g')
 );
$$;
revoke all on function public.whatsapp_outbox_destinatario_valido(uuid) from public,anon,authenticated;
grant execute on function public.whatsapp_outbox_destinatario_valido(uuid) to service_role;
