-- =============================================
-- MIGRATION 018 — Notificações automáticas + RPC OCR
-- =============================================

-- ============ Notificações: adicionar à publication Realtime ============
do $$
declare
  v_exists boolean;
begin
  select exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'notificacoes'
  ) into v_exists;

  if not v_exists then
    execute 'alter publication supabase_realtime add table public.notificacoes';
  end if;
end$$;

-- ============ Helper: usuario_id do cliente da proposta ============
create or replace function public.app_cliente_usuario_id(p_proposta_id uuid)
  returns uuid
  language sql
  stable
  security definer
  set search_path = public
as $$
  select c.usuario_id
    from propostas p
    join clientes c on c.id = p.cliente_id
   where p.id = p_proposta_id
   limit 1
$$;

-- ============ Trigger: notificar cliente em mudança de status ============
create or replace function public.trg_notif_status_proposta()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_usuario uuid;
  v_protocolo text;
begin
  v_usuario := public.app_cliente_usuario_id(NEW.proposta_id);
  if v_usuario is null then return NEW; end if;

  select protocolo into v_protocolo from propostas where id = NEW.proposta_id;

  insert into notificacoes(usuario_id, canal, titulo, mensagem, link, metadata)
  values (
    v_usuario,
    'in_app',
    'Sua proposta mudou de status',
    coalesce('Protocolo ' || v_protocolo || ' agora está em "' || NEW.status_novo::text || '".',
             'Status atualizado.'),
    '/c',
    jsonb_build_object(
      'proposta_id', NEW.proposta_id,
      'status_novo', NEW.status_novo,
      'status_anterior', NEW.status_anterior
    )
  );
  return NEW;
end$$;

drop trigger if exists trg_notif_status_proposta on proposta_status_historico;
create trigger trg_notif_status_proposta
  after insert on proposta_status_historico
  for each row execute function public.trg_notif_status_proposta();

-- ============ Trigger: notificar cliente em nova pendência ============
create or replace function public.trg_notif_pendencia_nova()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_usuario uuid;
begin
  if NEW.status <> 'aberta' then return NEW; end if;

  v_usuario := public.app_cliente_usuario_id(NEW.proposta_id);
  if v_usuario is null then return NEW; end if;

  insert into notificacoes(usuario_id, canal, titulo, mensagem, link, metadata)
  values (
    v_usuario,
    'in_app',
    'Nova pendência aberta',
    coalesce(NEW.descricao, 'Uma nova pendência foi aberta em sua proposta.'),
    '/c',
    jsonb_build_object(
      'proposta_id', NEW.proposta_id,
      'pendencia_id', NEW.id
    )
  );
  return NEW;
end$$;

drop trigger if exists trg_notif_pendencia_nova on proposta_pendencias;
create trigger trg_notif_pendencia_nova
  after insert on proposta_pendencias
  for each row execute function public.trg_notif_pendencia_nova();

-- ============ Trigger: notificar cliente quando documento é validado ============
create or replace function public.trg_notif_doc_validado()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_usuario uuid;
begin
  if NEW.validado = true and (OLD.validado is distinct from NEW.validado) then
    v_usuario := public.app_cliente_usuario_id(NEW.proposta_id);
    if v_usuario is null then return NEW; end if;

    insert into notificacoes(usuario_id, canal, titulo, mensagem, link, metadata)
    values (
      v_usuario,
      'in_app',
      'Documento aprovado',
      'Um dos seus documentos foi validado pela equipe.',
      '/c',
      jsonb_build_object('proposta_id', NEW.proposta_id, 'documento_id', NEW.id)
    );
  end if;
  return NEW;
end$$;

drop trigger if exists trg_notif_doc_validado on proposta_documentos;
create trigger trg_notif_doc_validado
  after update on proposta_documentos
  for each row execute function public.trg_notif_doc_validado();

-- ============ RPC: marcar notificação como lida ============
create or replace function public.notificacao_marcar_lida(p_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  update notificacoes
     set lida_em = now()
   where id = p_id
     and usuario_id = auth.uid()
     and lida_em is null;
end$$;

revoke all on function public.notificacao_marcar_lida(uuid) from public;
grant execute on function public.notificacao_marcar_lida(uuid) to authenticated;

-- ============ RPC: marcar todas como lidas ============
create or replace function public.notificacao_marcar_todas_lidas()
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  update notificacoes
     set lida_em = now()
   where usuario_id = auth.uid()
     and lida_em is null;
end$$;

revoke all on function public.notificacao_marcar_todas_lidas() from public;
grant execute on function public.notificacao_marcar_todas_lidas() to authenticated;

-- ============ RPC: gravar texto OCR num documento ============
create or replace function public.set_documento_ocr(
  p_id uuid,
  p_texto text
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_proposta_id uuid;
begin
  select proposta_id into v_proposta_id from proposta_documentos where id = p_id;
  if v_proposta_id is null then
    raise exception 'documento nao encontrado';
  end if;

  -- Cliente dono OU partner/team OU admin
  if not (
    public.app_can_manage_proposta(v_proposta_id)
    or v_proposta_id in (
      select id from propostas
       where cliente_id in (select id from clientes where usuario_id = auth.uid())
    )
  ) then
    raise exception 'sem permissao para atualizar OCR deste documento';
  end if;

  update proposta_documentos
     set ocr_texto = p_texto
   where id = p_id;
end$$;

revoke all on function public.set_documento_ocr(uuid, text) from public;
grant execute on function public.set_documento_ocr(uuid, text) to authenticated;
