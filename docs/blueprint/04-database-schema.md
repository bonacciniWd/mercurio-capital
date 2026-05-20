# 04 — Modelagem do Banco (PostgreSQL / Supabase)

> Convenções: `uuid` como PK (`gen_random_uuid()`), nomes em `snake_case`, datas em `timestamptz`, FKs com `on delete restrict` por padrão e `on delete cascade` apenas em entidades-filhas estritas. RLS habilitada em todas as tabelas com dados privados.

## 1. Visão geral por domínio

```
┌─ Identidade ─────────────────────┐  ┌─ Originação ─────────────────────┐
│ usuarios, perfis, sessoes_2fa    │  │ propostas, simulacoes,           │
│ partners, partner_documentos,    │  │ proponentes, imoveis,            │
│ equipes, equipe_membros,         │  │ proposta_documentos,             │
│ clientes, magic_links            │  │ proposta_status_historico,       │
└──────────────────────────────────┘  │ proposta_pendencias              │
                                       └──────────────────────────────────┘
┌─ Universidade ───────────────────┐  ┌─ Operações ──────────────────────┐
│ cursos, modulos, capitulos,      │  │ contratos, assinaturas,          │
│ aulas, inscricoes, progresso,    │  │ liberacoes_recurso,              │
│ certificados, assinaturas_uni    │  │ comissoes                        │
└──────────────────────────────────┘  └──────────────────────────────────┘
┌─ Integrações ────────────────────┐  ┌─ Plataforma ─────────────────────┐
│ logs_consultas, consultas_bacen, │  │ notificacoes, push_devices,      │
│ consultas_serasa, consultas_jud, │  │ audit_log, feature_flags,        │
│ ri_digital_matriculas,           │  │ configuracoes_sistema,           │
│ fluxos_evolution, fluxo_execucoes│  │ campanhas                        │
│ whatsapp_mensagens               │  │                                  │
└──────────────────────────────────┘  └──────────────────────────────────┘┌─ Carteira (Wallet) ───────────────┐  ┌─ Faturamento ───────────────────┐
│ partner_wallets, wallet_ledger,  │  │ stripe_payment_intents,          │
│ precos_consulta, wallet_topups   │  │ stripe_webhooks_inbox            │
└───────────────────────────────────┘  └───────────────────────────────────┘```

## 2. Enums

```sql
create type user_role as enum ('admin','partner','team_member','client');
create type partner_status as enum ('pending','approved','rejected','suspended');
create type pessoa_tipo as enum ('PF','PJ');
create type produto_tipo as enum ('home_equity','credito_construcao','financiamento_imobiliario');
create type imovel_tipo as enum ('apartamento','casa','comercial','terreno','vaga');
create type correcao_tipo as enum ('pos_fixado','pre_fixado');
create type amortizacao_tipo as enum ('price','sac');
create type proposta_status as enum (
  'simulacao','pre_analise','analise_credito','analise_imovel','analise_juridica',
  'comite','proposta_cliente','resolucao_pendencias','emissao_contrato',
  'aguardando_assinatura','em_registro','contrato_registrado','recurso_liberado','cancelado'
);
create type estado_civil as enum ('solteiro','casado','divorciado','viuvo','uniao_estavel');
create type documento_tipo as enum (
  'rg','cpf','cnh','contrato_social','comprovante_residencia','comprovante_renda',
  'matricula_imovel','iptu','certidao_casamento','outros'
);
create type pendencia_status as enum ('aberta','em_analise','resolvida','rejeitada');
create type notificacao_canal as enum ('push','email','whatsapp','in_app');
create type wallet_movimento_tipo as enum (
  'recarga','debito_consulta','estorno','ajuste_credito','ajuste_debito','tarifa'
);
create type tipo_consulta as enum (
  'bacen_cpf','bacen_cnpj','serasa_pf','serasa_pj','jusbrasil_cnpj','escavador_cnpj',
  'ri_digital_matricula','nacional_consultas_bens','nacional_consultas_certidao'
);
create type stripe_intent_status as enum (
  'requires_payment_method','requires_confirmation','requires_action',
  'processing','succeeded','canceled','failed'
);
```

## 3. Identidade & Acesso

### `usuarios`
Espelha `auth.users` do Supabase com dados de perfil.
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` |
| `nome_completo` | text | |
| `email` | text unique | |
| `telefone_ddi` | text | default `'55'` |
| `telefone` | text | E.164 |
| `role` | user_role | |
| `avatar_url` | text | |
| `ativo` | boolean | default true |
| `ultimo_login_at` | timestamptz | |
| `created_at` / `updated_at` | timestamptz | |

### `partners`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `usuario_id` | uuid FK → usuarios | unique |
| `cpf` | text unique | |
| `endereco_cep` | text | |
| `endereco_logradouro` | text | |
| `endereco_numero` | text | |
| `endereco_complemento` | text | |
| `endereco_bairro` | text | |
| `endereco_cidade` | text | |
| `endereco_estado` | text | UF |
| `dados_bancarios` | jsonb | `{banco, agencia, conta, tipo, titular}` |
| `status` | partner_status | default `pending` |
| `aprovado_por` | uuid FK → usuarios | |
| `aprovado_em` | timestamptz | |
| `motivo_rejeicao` | text | |
| `comissao_percentual` | numeric(5,2) | |
| `created_at` / `updated_at` | timestamptz | |

### `partner_documentos`
Documentos enviados na aprovação.
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `partner_id` | uuid FK |
| `tipo` | documento_tipo |
| `storage_path` | text | bucket `partner-docs` privado |
| `mime_type` | text |
| `tamanho_bytes` | bigint |
| `validado` | boolean default false |
| `validado_por` | uuid FK |
| `validado_em` | timestamptz |
| `observacoes` | text |
| `created_at` | timestamptz |

### `equipes`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `partner_id` | uuid FK |
| `nome` | text |
| `isolamento_estrito` | boolean default false |
| `created_at` / `updated_at` | timestamptz |

### `equipe_membros`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `equipe_id` | uuid FK |
| `usuario_id` | uuid FK |
| `papel_equipe` | text check `('admin_equipe','membro')` |
| `permissoes` | jsonb | overrides finos |
| `convite_token` | text |
| `convite_expira_em` | timestamptz |
| `aceito_em` | timestamptz |
| `created_at` | timestamptz |

### `clientes`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `usuario_id` | uuid FK | nullable até cliente ativar conta |
| `pessoa_tipo` | pessoa_tipo |
| `nome_completo` | text |
| `cpf` | text |
| `cnpj` | text |
| `data_nascimento` | date |
| `estado_civil` | estado_civil |
| `email` | text |
| `telefone_ddi` | text |
| `telefone` | text |
| `created_at` / `updated_at` | timestamptz |
| UNIQUE(`cpf`) WHERE pessoa_tipo='PF' |
| UNIQUE(`cnpj`) WHERE pessoa_tipo='PJ' |

### `magic_links`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `token_hash` | text unique | armazenado como hash (`pgcrypto`) |
| `finalidade` | text | `cliente_ativacao`, `partner_ativacao`, `membro_convite`, `consulta_protocolo` |
| `payload` | jsonb | `{proposta_id?, equipe_id?, partner_id?}` |
| `expires_at` | timestamptz | ≤ 30 min |
| `used_at` | timestamptz | nullable |
| `tentativas` | int default 0 |
| `created_by` | uuid |
| `created_at` | timestamptz |

### `sessoes_2fa`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `usuario_id` | uuid FK |
| `secret_encrypted` | text |
| `verificado` | boolean default false |
| `recovery_codes` | text[] |
| `created_at` | timestamptz |

## 4. Originação (Propostas)

### `simulacoes`
Pré-cadastro antes de virar proposta.
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `partner_id` | uuid FK |
| `equipe_id` | uuid FK | nullable |
| `responsavel_id` | uuid FK → usuarios |
| `produto` | produto_tipo |
| `pessoa_tipo` | pessoa_tipo |
| `cliente_nome` | text |
| `cliente_cpf` | text |
| `cliente_email` | text |
| `cliente_telefone` | text |
| `imovel_estado` | text |
| `imovel_cidade` | text |
| `imovel_bairro` | text |
| `imovel_cep` | text |
| `valor_credito` | numeric(14,2) |
| `valor_imovel` | numeric(14,2) |
| `correcao` | correcao_tipo default `pos_fixado` |
| `amortizacao` | amortizacao_tipo default `price` |
| `prazo_meses` | int check (between 12 and 240) |
| `carencia_meses` | int default 0 check (between 0 and 3) |
| `taxa_juros_mensal` | numeric(6,4) | default 1.39 (sobre IPCA) |
| `convertida_em_proposta_id` | uuid FK |
| `created_at` / `updated_at` | timestamptz |

### `propostas`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `protocolo` | text unique | gerado: `MERC-YYYY-NNNNNN` |
| `simulacao_id` | uuid FK | nullable |
| `partner_id` | uuid FK | |
| `equipe_id` | uuid FK | |
| `responsavel_id` | uuid FK | |
| `cliente_id` | uuid FK | |
| `produto` | produto_tipo | |
| `status` | proposta_status default `pre_analise` | |
| `valor_solicitado` | numeric(14,2) | |
| `valor_imoveis_total` | numeric(14,2) | computed por trigger |
| `taxa_juros_mensal` | numeric(6,4) | |
| `indexador` | text | default `IPCA` |
| `correcao` | correcao_tipo | |
| `amortizacao` | amortizacao_tipo | |
| `prazo_meses` | int | |
| `carencia_meses` | int | |
| `motivo_cancelamento` | text | |
| `dados_vendedor_imovel` | jsonb | financiamento imobiliário |
| `created_at` / `updated_at` | timestamptz | |

### `proponentes`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `proposta_id` | uuid FK |
| `cliente_id` | uuid FK | nullable (proponente secundário) |
| `principal` | boolean default false |
| `pessoa_tipo` | pessoa_tipo |
| `nome` | text |
| `cpf_cnpj` | text |
| `estado_civil` | estado_civil |
| `relacao` | text | `conjuge`, `socio`, `outro` |
| `dados_complementares` | jsonb |
| `created_at` | timestamptz |

### `imoveis`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `proposta_id` | uuid FK |
| `tipo` | imovel_tipo |
| `cep` | text |
| `estado` | text |
| `cidade` | text |
| `bairro` | text |
| `logradouro` | text |
| `numero` | text |
| `sem_numero` | boolean default false |
| `complemento` | text |
| `valor` | numeric(14,2) |
| `vagas_garagem` | int default 0 |
| `alugado` | boolean default false |
| `valor_aluguel` | numeric(14,2) |
| `financiado` | boolean default false |
| `instituicao_financiadora` | text |
| `saldo_devedor` | numeric(14,2) |
| `possui_debitos` | boolean default false |
| `debitos_iptu` | numeric(14,2) |
| `debitos_condominio` | numeric(14,2) |
| `created_at` / `updated_at` | timestamptz |

### `imovel_proprietarios`
N:N entre `proponentes` e `imoveis`.
| Coluna | Tipo |
|---|---|
| `imovel_id` | uuid FK |
| `proponente_id` | uuid FK |
| `percentual` | numeric(5,2) |
| PK (`imovel_id`,`proponente_id`) |

### `proposta_documentos`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `proposta_id` | uuid FK |
| `proponente_id` | uuid FK | nullable |
| `imovel_id` | uuid FK | nullable |
| `categoria` | text | `pessoa_fisica`, `pessoa_juridica`, `imovel` |
| `tipo` | documento_tipo |
| `storage_path` | text |
| `bucket` | text | `proposta-docs` (privado) |
| `mime_type` | text |
| `tamanho_bytes` | bigint |
| `enviado_por` | uuid FK |
| `origem` | text | `cliente`, `parceiro`, `protocolo_publico`, `ocr` |
| `validado` | boolean default false |
| `validado_por` | uuid FK |
| `validado_em` | timestamptz |
| `ocr_texto` | text | nullable |
| `created_at` | timestamptz |

### `proposta_status_historico`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `proposta_id` | uuid FK |
| `status_anterior` | proposta_status |
| `status_novo` | proposta_status |
| `alterado_por` | uuid FK |
| `motivo` | text |
| `metadata` | jsonb |
| `created_at` | timestamptz |

### `proposta_pendencias`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `proposta_id` | uuid FK |
| `descricao` | text |
| `solicitado_por` | uuid FK |
| `responsavel_resolver` | uuid FK | (cliente ou partner) |
| `documento_solicitado_tipo` | documento_tipo |
| `status` | pendencia_status default `aberta` |
| `prazo` | timestamptz |
| `resolvida_em` | timestamptz |
| `created_at` / `updated_at` | timestamptz |

## 5. Operações & Financeiro

### `contratos`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `proposta_id` | uuid FK unique |
| `pdf_storage_path` | text |
| `provedor_assinatura` | text | `d4sign`, `clicksign` |
| `provider_envelope_id` | text |
| `gerado_por` | uuid FK |
| `gerado_em` | timestamptz |
| `assinado_em` | timestamptz |
| `registrado_em` | timestamptz |
| `created_at` / `updated_at` | timestamptz |

### `assinaturas_contrato`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `contrato_id` | uuid FK |
| `signatario_nome` | text |
| `signatario_email` | text |
| `signatario_cpf_cnpj` | text |
| `papel` | text | `tomador`, `conjuge`, `vendedor`, `testemunha` |
| `status` | text | `pendente`, `assinado`, `rejeitado` |
| `assinado_em` | timestamptz |
| `ip_assinatura` | inet |

### `liberacoes_recurso`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `proposta_id` | uuid FK |
| `valor_liberado` | numeric(14,2) |
| `data_liberacao` | date |
| `comprovante_storage_path` | text |
| `created_at` | timestamptz |

### `comissoes`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `proposta_id` | uuid FK |
| `partner_id` | uuid FK |
| `percentual` | numeric(5,2) |
| `valor` | numeric(14,2) |
| `status` | text | `prevista`, `aprovada`, `paga` |
| `paga_em` | timestamptz |

## 6. Universidade Mercurio (LMS)

### `cursos`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `slug` | text unique |
| `titulo` | text |
| `descricao` | text |
| `capa_url` | text |
| `gratuito` | boolean default true |
| `requer_assinatura` | boolean default false |
| `carga_horaria_min` | int |
| `emite_certificado` | boolean default false |
| `criterios_certificado` | jsonb | `{progresso_min:80, prova_min:70}` |
| `publicado` | boolean default false |
| `created_at` / `updated_at` | timestamptz |

### `modulos`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `curso_id` | uuid FK |
| `ordem` | int |
| `titulo` | text |

### `capitulos`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `modulo_id` | uuid FK |
| `ordem` | int |
| `titulo` | text |

### `aulas`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `capitulo_id` | uuid FK |
| `ordem` | int |
| `titulo` | text |
| `tipo` | text | `video`, `texto`, `quiz` |
| `video_url` | text |
| `duracao_seg` | int |
| `conteudo_md` | text |

### `inscricoes`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `curso_id` | uuid FK |
| `usuario_id` | uuid FK |
| `status` | text | `cursando`, `concluido`, `cancelado` |
| `progresso_pct` | numeric(5,2) default 0 |
| `iniciado_em` | timestamptz |
| `concluido_em` | timestamptz |
| UNIQUE(`curso_id`,`usuario_id`) |

### `aula_progresso`
| Coluna | Tipo |
|---|---|
| `inscricao_id` | uuid FK |
| `aula_id` | uuid FK |
| `assistido` | boolean default false |
| `posicao_seg` | int default 0 |
| `concluido_em` | timestamptz |
| PK (`inscricao_id`,`aula_id`) |

### `certificados`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `inscricao_id` | uuid FK unique |
| `codigo_validacao` | text unique |
| `pdf_storage_path` | text |
| `emitido_em` | timestamptz |

### `assinaturas_universidade`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `usuario_id` | uuid FK |
| `plano` | text |
| `status` | text | `ativa`, `cancelada`, `inadimplente` |
| `provedor` | text | `stripe`, `asaas` |
| `provider_subscription_id` | text |
| `inicio` | timestamptz |
| `fim` | timestamptz |

## 7. Integrações & Logs

### `logs_consultas` (genérico)
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `usuario_id` | uuid FK |
| `tipo` | text | `bacen`, `serasa`, `juridico`, `ri_digital`, `nacional_consultas` |
| `documento` | text |
| `request_payload` | jsonb |
| `response_payload` | jsonb |
| `status_http` | int |
| `protocolo_externo` | text |
| `custo_centavos` | int |
| `created_at` | timestamptz |

### `consultas_bacen`, `consultas_serasa`, `consultas_juridicas`, `ri_digital_matriculas`
Tabelas específicas com payloads tipados (referências a `logs_consultas.id`).

### `whatsapp_mensagens`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `proposta_id` | uuid FK | nullable |
| `usuario_id` | uuid FK | nullable |
| `direcao` | text | `out`, `in` |
| `numero` | text |
| `template` | text |
| `payload` | jsonb |
| `evolution_message_id` | text |
| `status` | text | `enviado`, `entregue`, `lido`, `erro` |
| `created_at` | timestamptz |

### `fluxos_evolution`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `nome` | text |
| `publico_alvo` | text | `cliente`, `parceiro`, `membro` |
| `gatilho` | text | ex: `proposta.status_changed` |
| `definicao_json` | jsonb |
| `ativo` | boolean default true |
| `versao` | int default 1 |
| `created_at` / `updated_at` | timestamptz |

### `fluxo_execucoes`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `fluxo_id` | uuid FK |
| `entidade` | text |
| `entidade_id` | uuid |
| `status` | text | `pendente`, `executando`, `sucesso`, `falha` |
| `log` | jsonb |
| `created_at` / `concluido_em` | timestamptz |

## 8. Plataforma

### `notificacoes`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `usuario_id` | uuid FK |
| `canal` | notificacao_canal |
| `titulo` | text |
| `mensagem` | text |
| `link` | text |
| `lida_em` | timestamptz |
| `metadata` | jsonb |
| `created_at` | timestamptz |

### `push_devices`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `usuario_id` | uuid FK |
| `plataforma` | text | `web`, `android`, `ios` |
| `token` | text unique |
| `ultimo_uso` | timestamptz |

### `audit_log`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `usuario_id` | uuid |
| `acao` | text |
| `entidade` | text |
| `entidade_id` | uuid |
| `payload_antes` | jsonb |
| `payload_depois` | jsonb |
| `ip` | inet |
| `user_agent` | text |
| `created_at` | timestamptz |

### `configuracoes_sistema`
Chave/valor versionado para parâmetros como taxa padrão, prazo padrão, links de integrações.
| Coluna | Tipo |
|---|---|
| `chave` | text PK |
| `valor` | jsonb |
| `descricao` | text |
| `updated_by` | uuid |
| `updated_at` | timestamptz |

### `feature_flags`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `chave` | text unique |
| `descricao` | text |
| `regras` | jsonb | `{roles:[], partner_ids:[], percent: 50}` |
| `ativo` | boolean default false |

### `campanhas`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `nome` | text |
| `publico_alvo` | jsonb |
| `canais` | text[] |
| `template` | text |
| `agendado_para` | timestamptz |
| `status` | text | `rascunho`, `agendada`, `enviada`, `cancelada` |
| `metricas` | jsonb |
| `created_by` | uuid FK |
| `created_at` / `updated_at` | timestamptz |

## 9. Buckets de Storage

| Bucket | Privacidade | Conteúdo | Acesso |
|---|---|---|---|
| `partner-docs` | privado | Docs de aprovação do parceiro | admin + dono |
| `proposta-docs` | privado | Documentos de propostas | admin + partner dono + cliente dono |
| `contratos` | privado | PDFs de contratos | admin + partes |
| `cursos-videos` | privado | Vídeos LMS | inscritos / assinantes |
| `cursos-capas` | público | Imagens de capa | leitura pública |
| `certificados` | privado | PDFs de certificados | dono + admin |
| `protocolo-uploads` | privado | Uploads via consulta protocolo | edge function (signed URL) |
| `avatares` | público | Avatares de usuário | leitura pública |

## 10. Índices recomendados

- `propostas (status, partner_id, created_at desc)`
- `propostas (equipe_id, responsavel_id)`
- `propostas (protocolo)` único
- `proposta_status_historico (proposta_id, created_at desc)`
- `proposta_documentos (proposta_id, categoria)`
- `imoveis (proposta_id)`
- `proponentes (proposta_id, principal)`
- `magic_links (token_hash)` único, `expires_at`
- `whatsapp_mensagens (proposta_id, created_at desc)`
- `audit_log (entidade, entidade_id, created_at desc)`
- `notificacoes (usuario_id, lida_em nulls first, created_at desc)`

## 11. Triggers / regras-chave

1. `propostas`: trigger `before update of status` → insere em `proposta_status_historico` validando transição (matriz §02-roles-permissions §5).
2. `imoveis`: trigger `after insert/update/delete` → recalcula `propostas.valor_imoveis_total`.
3. `magic_links`: trigger `before insert` → hash do token com `pgcrypto`.
4. `partner_documentos`: trigger `after update of validado` → audit_log.
5. `inscricoes.progresso_pct`: recalculado por trigger em `aula_progresso`.
6. Tabelas sensíveis (`propostas`, `proposta_documentos`, `partners`, `contratos`, `comissoes`, `configuracoes_sistema`): triggers de auditoria em `audit_log`.

## 12. Seeds iniciais

- `configuracoes_sistema`: taxa default `1.39`, indexador `IPCA`, prazo padrão `120`.
- `cursos`: "Guia do Parceiro" (gratuito).
- `fluxos_evolution`: fluxo `cliente_status_changed`, `parceiro_proposta_atribuida`, `magic_link_cliente`.
- `precos_consulta`: tabela inicial com preços por `tipo_consulta` (ver §13).
- Admin master via SQL seguro (variável de ambiente).

## 13. Carteira do parceiro (Wallet)

> Toda consulta paga (Bacen, Serasa, Jusbrasil, Escavador, RI Digital, Nacional Consultas) **debita** da carteira do parceiro. Recargas chegam via Stripe. Implementação **append-only ledger** + saldo materializado + lock pessimista durante débito.

### `partner_wallets`
Saldo materializado por parceiro (1:1).
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `partner_id` | uuid FK → partners | unique |
| `saldo_centavos` | bigint default 0 | sempre `>= 0` (check) |
| `moeda` | text default `'BRL'` | |
| `limite_diario_centavos` | bigint | nullable (sem limite por padrão) |
| `bloqueada` | boolean default false | admin pode bloquear |
| `motivo_bloqueio` | text | |
| `versao` | bigint default 0 | OCC; incrementa a cada UPDATE |
| `created_at` / `updated_at` | timestamptz | |

### `wallet_ledger`
**Append-only** — fonte da verdade. `partner_wallets.saldo_centavos` é mantido por trigger.
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `wallet_id` | uuid FK → partner_wallets | |
| `partner_id` | uuid FK | denormalizado para queries |
| `tipo` | wallet_movimento_tipo | |
| `valor_centavos` | bigint | sempre **positivo**; o tipo define sinal |
| `saldo_antes` | bigint | snapshot |
| `saldo_depois` | bigint | snapshot |
| `referencia_tipo` | text | `consulta`, `topup`, `manual`, `assinatura_lms` |
| `referencia_id` | uuid | aponta para `logs_consultas.id`, `wallet_topups.id`, etc. |
| `correlation_id` | uuid | mesmo id em débito + estorno |
| `descricao` | text | |
| `metadata` | jsonb | |
| `criado_por` | uuid FK → usuarios | nullable (sistema) |
| `created_at` | timestamptz | |
| INDEX `(wallet_id, created_at desc)` |
| INDEX `(referencia_tipo, referencia_id)` |
| INDEX `(correlation_id)` |

> **Regra**: nenhum `UPDATE`/`DELETE` permitido em `wallet_ledger` (RLS + revoke). Toda correção é uma nova entrada `ajuste_credito`/`ajuste_debito` com `correlation_id` ligando à entrada anterior.

### `precos_consulta`
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `tipo` | tipo_consulta |
| `preco_centavos` | bigint |
| `custo_fornecedor_centavos` | bigint | margem operacional |
| `vigente_de` | timestamptz |
| `vigente_ate` | timestamptz | nullable; `NULL` = vigente |
| `descricao` | text |
| `criado_por` | uuid FK |
| `created_at` | timestamptz |
| UNIQUE(`tipo`) WHERE `vigente_ate IS NULL` |

### `wallet_topups`
Recargas (relação 1:1 com `stripe_payment_intents`).
| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `partner_id` | uuid FK |
| `wallet_id` | uuid FK |
| `valor_centavos` | bigint |
| `provedor` | text default `'stripe'` |
| `provider_intent_id` | text unique |
| `status` | stripe_intent_status |
| `confirmado_em` | timestamptz |
| `ledger_id` | uuid FK → wallet_ledger | preenchido após confirmação |
| `metadata` | jsonb |
| `created_at` / `updated_at` | timestamptz |

### `stripe_payment_intents`
Cache leve do Stripe (também serve para assinaturas LMS).
| Coluna | Tipo |
|---|---|
| `id` | text PK | `pi_xxx` do Stripe |
| `cliente_stripe_id` | text |
| `usuario_id` | uuid FK |
| `partner_id` | uuid FK | nullable |
| `proposito` | text | `wallet_topup`, `lms_subscription` |
| `valor_centavos` | bigint |
| `status` | stripe_intent_status |
| `payload` | jsonb | última atualização |
| `created_at` / `updated_at` | timestamptz |

### `stripe_webhooks_inbox`
Idempotência de webhooks.
| Coluna | Tipo |
|---|---|
| `id` | text PK | `evt_xxx` |
| `tipo` | text |
| `recebido_em` | timestamptz default now |
| `processado_em` | timestamptz |
| `payload` | jsonb |

### Função de débito atômico

```sql
-- pseudo, definitivo no SQL real
create or replace function wallet_debit(
  p_partner uuid,
  p_tipo wallet_movimento_tipo,
  p_valor bigint,
  p_ref_tipo text,
  p_ref_id uuid,
  p_correlation uuid,
  p_descricao text
) returns wallet_ledger
language plpgsql security definer as $$
declare
  v_wallet partner_wallets%rowtype;
  v_entry wallet_ledger%rowtype;
begin
  select * into v_wallet from partner_wallets
    where partner_id = p_partner for update;
  if not found then raise exception 'wallet_nao_encontrada'; end if;
  if v_wallet.bloqueada then raise exception 'wallet_bloqueada'; end if;
  if v_wallet.saldo_centavos < p_valor then
    raise exception 'saldo_insuficiente';
  end if;
  insert into wallet_ledger(
    wallet_id, partner_id, tipo, valor_centavos,
    saldo_antes, saldo_depois,
    referencia_tipo, referencia_id, correlation_id, descricao
  ) values (
    v_wallet.id, p_partner, p_tipo, p_valor,
    v_wallet.saldo_centavos, v_wallet.saldo_centavos - p_valor,
    p_ref_tipo, p_ref_id, p_correlation, p_descricao
  ) returning * into v_entry;
  update partner_wallets
    set saldo_centavos = saldo_centavos - p_valor,
        versao = versao + 1,
        updated_at = now()
    where id = v_wallet.id;
  return v_entry;
end;
$$;
```

Função análoga `wallet_credit(...)` para `recarga`, `estorno`, `ajuste_credito`.

### Triggers

- `wallet_ledger`: `before insert` valida `saldo_antes - sinal*valor = saldo_depois`.
- `wallet_ledger`: `revoke update,delete` para todos exceto role de manutenção.
- `partner_wallets`: criada automaticamente em `after insert on partners` (saldo zero).
- `audit_log`: registra todo `bloqueio`, `ajuste_*` e mudança de `limite_diario_centavos`.

### Fluxo na Edge Function de consulta

1. `select preco from precos_consulta where tipo=$1 and vigente_ate is null`.
2. `BEGIN; SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`
3. `select wallet_debit(partner_id, 'debito_consulta', preco, 'consulta', logs_consultas_id, correlation_id, ...)`.
4. Chama API externa.
5. Em sucesso: `COMMIT` + grava `logs_consultas`.
6. Em erro externo: `wallet_credit(... 'estorno' ..., correlation_id)` na mesma transação ou compensatória.

### Telas relacionadas (parceiro)

- `/p/carteira` — saldo, botão "Adicionar saldo", histórico de movimentações.
- `/p/carteira/recarga` — seletor de valor, fluxo Stripe Elements.
- `/p/carteira/extrato` — filtros por tipo, data, exportação CSV.
- `/p/configuracoes/limites` — limite diário (se permitido).

### Telas relacionadas (admin)

- `/admin/financeiro/carteiras` — visão de todas as carteiras, saldo, bloqueios.
- `/admin/financeiro/carteiras/:partnerId` — extrato + ajustes manuais.
- `/admin/financeiro/precos` — gestão da tabela `precos_consulta` (versionamento).
- `/admin/financeiro/recargas` — recargas Stripe (status).
