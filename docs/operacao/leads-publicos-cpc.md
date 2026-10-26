# Leads públicos de Crédito para Construção (CPC)

## Escopo

A página `/credito-para-construcao` pode apresentar um formulário de contato CPC. O formulário coleta nome, e-mail, telefone, fase do projeto e, opcionalmente, cidade/UF e resumo curto. Não coleta valor de crédito, parcela, LTV, CPF, documentos ou endereço completo.

O CTA e o consentimento apontam para `/politica-de-privacidade`, cuja aprovação jurídica foi informada pelo usuário. A rota já apresenta a política. A captura CPC continua sujeita à configuração independente no servidor.

## Estado de ativação

A configuração `cpc_captura_publica_ativa` é criada como `false`. A Edge Function `public-cpc-lead` verifica essa configuração no servidor e recusa gravações enquanto estiver desligada. A aprovação da política não altera nem ativa esse controle; qualquer ativação e publicação do fluxo devem ser tratadas separadamente.

## Dados e acesso

- A tabela própria é `cpc_leads_publicos`; ela não altera `simulacao_leads_publicos`.
- A idempotência usa `idempotency_key`; origem e versão do consentimento são definidas no servidor.
- O envio passa pela Edge Function, que valida POST, payload, consentimento, honeypot e rate limit por e-mail/rede.
- RLS permite leitura apenas por `app_is_admin()`. Não existe insert público e parceiros não leem leads CPC.
- `v_admin_leads_publicos` combina CPC e calculadoras para exibição em `/admin/leads/simulacoes`.
- A migration `20261023000001_lead_status_comercial.sql` foi aplicada em 2026-10-23 no projeto Supabase `mercurio` (`bhagksfvszeogtjvjtpx`). O estado comercial aplica-se também ao CPC sem alterar os dados capturados. `novo` é o padrão visual para registros sem acompanhamento; `em_contato` e `qualificado` exigem alteração manual de admin operacional pela RPC auditada. É separado do estado de e-mail e não dispara contato.
- CPC não dispara e-mail nem cria proposta. O operador pode abrir um WhatsApp preparado com o tipo CPC e nome do contato, revisar e enviar manualmente.

## Validação

Executar `supabase/smoke-tests/fase-44-leads-publicos-cpc.sql` em ambiente de teste. O estado da configuração de captura em produção não foi verificado. A ativação da captura e publicação da função em produção exigem autorização independente.

## Prontidão da candidata isolada — 16/10/2026

- A rota e o formulário CPC passaram na suíte de testes da candidata: 22 arquivos e 80 testes no total; lint sem erros (38 avisos), typecheck, build e validador de release passaram.
- O endpoint e a migration não foram alterados neste trabalho. O estado atual do gate remoto não foi revalidado por leitura SQL somente leitura; não enviar payload de formulário até confirmar que `cpc_captura_publica_ativa` está `false`.
- O Preview Vercel não foi enviado porque o audit completo ainda contém 5 High e 12 Moderate, e o gate remoto permanece sem confirmação. Nenhuma migration, ativação ou gravação de lead ocorreu.
