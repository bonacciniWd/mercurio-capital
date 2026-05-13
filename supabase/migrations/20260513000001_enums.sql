-- =============================================
-- MIGRATION 001 — ENUMS & FUNÇÕES HELPER RLS
-- =============================================

-- ENUMS

create type user_role as enum ('admin','partner','team_member','client');

create type partner_status as enum ('pending','approved','rejected','suspended');

create type pessoa_tipo as enum ('PF','PJ');

create type produto_tipo as enum (
  'home_equity',
  'credito_construcao',
  'financiamento_imobiliario'
);

create type imovel_tipo as enum (
  'apartamento','casa','comercial','terreno','vaga'
);

create type correcao_tipo as enum ('pos_fixado','pre_fixado');

create type amortizacao_tipo as enum ('price','sac');

create type proposta_status as enum (
  'simulacao',
  'pre_analise',
  'analise_credito',
  'analise_imovel',
  'analise_juridica',
  'comite',
  'proposta_cliente',
  'resolucao_pendencias',
  'emissao_contrato',
  'aguardando_assinatura',
  'em_registro',
  'contrato_registrado',
  'recurso_liberado',
  'cancelado'
);

create type estado_civil as enum (
  'solteiro','casado','divorciado','viuvo','uniao_estavel'
);

create type documento_tipo as enum (
  'rg','cpf','cnh','contrato_social','comprovante_residencia',
  'comprovante_renda','matricula_imovel','iptu',
  'certidao_casamento','outros'
);

create type pendencia_status as enum (
  'aberta','em_analise','resolvida','rejeitada'
);

create type notificacao_canal as enum (
  'push','email','whatsapp','in_app'
);

create type wallet_movimento_tipo as enum (
  'recarga','debito_consulta','estorno',
  'ajuste_credito','ajuste_debito','tarifa'
);

create type tipo_consulta as enum (
  'bacen_cpf','bacen_cnpj',
  'serasa_pf','serasa_pj',
  'jusbrasil_cnpj','escavador_cnpj',
  'ri_digital_matricula',
  'nacional_consultas_bens','nacional_consultas_certidao'
);

create type stripe_intent_status as enum (
  'requires_payment_method','requires_confirmation',
  'requires_action','processing','succeeded','canceled','failed'
);

-- =============================================
-- FUNÇÕES HELPER PARA RLS (leem JWT app_metadata)
-- =============================================

create or replace function public.app_user_role()
  returns text
  language sql stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'public')
$$;

create or replace function public.app_is_admin()
  returns boolean
  language sql stable
as $$
  select public.app_user_role() = 'admin'
$$;

create or replace function public.app_partner_id()
  returns uuid
  language sql stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'partner_id', '')::uuid
$$;

create or replace function public.app_equipe_id()
  returns uuid
  language sql stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'equipe_id', '')::uuid
$$;

create or replace function public.app_is_approved()
  returns boolean
  language sql stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'approved')::boolean,
    false
  )
$$;

-- =============================================
-- TRIGGER GENÉRICO: updated_at
-- =============================================

create or replace function set_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


