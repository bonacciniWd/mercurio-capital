# Publicação — relatório detalhado Serasa PF

Data: 29/10/2026. Estado atualizado: preview promovida para produção em 29/10/2026; migration e Edge Function já publicadas.

## Objetivo e escopo

Publicar o relatório PF visual baseado no PDF aprovado, mantendo o fluxo atual de consulta e os controles por proposta/proponente. O rollout requer migration aditiva `20261029000001_serasa_pf_relatorio_detalhado.sql`, a nova versão de `consulta-executar` e o frontend que lê a nova RPC.

Não executar consulta Serasa, ativar SCORE/RENDA_MAIS, alterar configuração comercial, fazer backfill, publicar Electron, alterar GitHub ou aplicar outras migrations.

## Inspeção e evidências

- Instruções `AGENTS.md` fornecidas na conversa; `docs/operacao/change-management.md`, `docs/operacao/release-checklist.md`, plano de implementação `prompts/2026-10-29-serasa-pf-padrao-relatorio-referencia.md` e mapeamento `docs/operacao/serasa-pf-relatorio-referencia.md`.
- Verificações locais concluídas: Vitest 175/175; normalizador 7/7; Deno check aprovado; lint 0 erros (33 avisos); typecheck e build aprovados; `git diff --check` aprovado.
- `supabase migration list --linked`: migrations até `20261028000003` constam aplicadas; `20261029000001` é a única migration local recente pendente.
- SQL remoto read-only confirmou os pré-requisitos principais existentes: tabela de aceite, vínculo `proponente_id`, RPC `consulta_iniciar_serasa_proponente` e colunas da view. Confirmou também ausência de `features_pf`, `parametros_pf`, `consulta_relatorio_obter` e `admin_serasa_pf_features_atualizar`, que são introduzidos pela migration deste release.
- Produção Vercel atual: `dpl_9PJQaHnv9BU5qTCdMYnCaf6EFzyN` (`https://mercurio-digital-8zomq5jqn-bonacciniwds-projects.vercel.app`), aliases públicos ativos.
- Supabase Edge atual: `consulta-executar` v48 (`verify_jwt=true`) e `magic-link-consume` v41 (`verify_jwt=false`, configuração existente). Apenas `consulta-executar` precisa mudar neste release; `magic-link-consume` permanece na versão ativa.

## Execução parcial — 29/10/2026

- Snapshot limpo em `/tmp/mercurio-serasa-pf-preview.o4KFjj`, derivado de `HEAD` com a allowlist de frontend e lockfile. Nenhum arquivo alheio foi copiado.
- `npm ci --include=dev` e `npm run build` passaram no snapshot. Dois avisos Moderate de dependências e aviso existente de chunks grandes.
- Preview criado: `dpl_BouAt7RmXjnfFfjEyo8F3dJEZdbJ` (`https://mercurio-digital-fl14gbmyu-bonacciniwds-projects.vercel.app`), `READY`; rota `/admin` respondeu HTTP 200 via Vercel CLI.
- Migration `20261029000001` aplicada sozinha após dry-run confirmar que era a única pendente. Verificados `features_pf`, `parametros_pf`, ambas RPCs presentes; `authenticated` pode executar `consulta_relatorio_obter`, `anon` não pode.
- `consulta-executar` publicada v49, `verify_jwt=true`, SHA-256 do bundle `707a9c51cfed94d98ab2afddd02aac879e90785fadaaa964f7593aef8ccf4a1e`. Nenhuma outra Edge Function foi alterada.
- Backup remoto da v48 salvo em `supabase/manual/rollback-20261029-serasa-pf-v48/`, com hashes e instruções. `magic-link-consume` permaneceu na v41.
- O preview redirecionou o navegador conectado ao login Vercel; a captura visual autenticada ainda não foi feita. Produção Vercel permanece em `dpl_9PJQaHnv9BU5qTCdMYnCaf6EFzyN` e não foi promovida.
- Nenhuma consulta Serasa, ativação de feature, backfill ou débito foi executado.

## Promoção da preview — 29/10/2026

- O dono autorizou promover a preview para produção.
- Antes da promoção, a Vercel mostrava como preview mais recente `dpl_2rfQTUvxn5rNR8BBcRXeqpDFy6Fr` (`https://mercurio-digital-q1sm0xozc-bonacciniwds-projects.vercel.app`), status `READY`. Foi promovido esse deployment existente; esta operação não fez upload do working tree local.
- Produção imediatamente antes da promoção: `dpl_9PJQaHnv9BU5qTCdMYnCaf6EFzyN`, aliases públicos ativos.
- Verificações locais antes da promoção: lint 0 erros e 33 avisos; typecheck passou; build passou. A suíte completa teve 173/176 testes, com três expirando em 5 s (`adminPropostaDetalhe`, `publicAmortizationSimulator` e `publicSimulator`); repetição isolada passou 10/10 testes. Testes do normalizador Serasa: 7/7.
- Após promover, a Vercel criou `dpl_6s7mYUtSHyboxWZuLhXWqhn4cncs` (`https://mercurio-digital-d8c5v9x4j-bonacciniwds-projects.vercel.app`), status `READY`, com aliases `www.mercuriocapitalsa.com.br`, `mercuriocapitalsa.com.br`, `mercurio-digital-alpha.vercel.app` e `mercurio-digital-bonacciniwds-projects.vercel.app`.
- Inspeção da Vercel confirmou que os dois domínios públicos resolvem para `dpl_6s7mYUtSHyboxWZuLhXWqhn4cncs`. Smoke HTTP: `/`, `/admin` e `/admin/propostas` responderam 200.
- Rollback web: `vercel promote dpl_9PJQaHnv9BU5qTCdMYnCaf6EFzyN --yes`; depois conferir que os aliases voltaram ao deployment anterior.
- Esta publicação não alterou Supabase, migrations, Edge Functions, consultas/cotas Serasa, Electron, GitHub ou estado da conta Meta/WhatsApp.

## Artefatos permitidos

- Migration: `supabase/migrations/20261029000001_serasa_pf_relatorio_detalhado.sql`.
- Edge: `supabase/functions/consulta-executar/index.ts` e `supabase/functions/_shared/serasa-reports.ts`.
- Frontend: `app/src/components/PropostaConsultas.tsx`, `app/src/components/SerasaPFReport.tsx`, `app/src/components/SerasaPFReport.css`, `app/src/pages/admin/Integracoes.tsx`, `app/src/pages/admin/PropostaDetalhe.tsx`, `app/src/pages/partner/PropostaDetalhe.tsx` e `app/src/pages/public/ClienteProposta.tsx`.
- Reutilizar o lockfile corrigido que já está na produção, validando sua compatibilidade com o `package.json` do snapshot.
- Excluir `app/vercel.json`, metadados de pacote, imagens, testes, arquivos temporários, documentos, arquivos de dados, migrations anteriores, smoke tests e toda mudança fora da allowlist.
- Preparar o snapshot a partir de base compatível com o deployment de produção atual; confirmar o diff final do snapshot antes do preview.

## Rollout proposto

1. Antes de qualquer mutação, salvar a versão remota atual de `consulta-executar` v48 em backup local e confirmar SHA-256; registrar novamente o deployment Vercel atual.
2. Construir snapshot limpo e publicar preview. Validar visualmente o relatório e os estados sem dados com usuário autorizado; nenhum botão de executar consulta será acionado. Falha ou ausência de validação: parar.
3. Aplicar somente `20261029000001` e conferir colunas, grants e RPCs. Não usar `supabase db push` sem limitar/confirmar que nenhuma outra migration será aplicada.
4. Publicar somente `consulta-executar`, preservando `verify_jwt=true`; confirmar versão ativa e logs sem conteúdo de PII.
5. Publicar o snapshot frontend aprovado na produção, confirmar aliases e smoke sem consulta paga.

## Rollback

- Web: restaurar o deployment que está atualmente em produção no início do rollout, `dpl_9PJQaHnv9BU5qTCdMYnCaf6EFzyN`; confirmar aliases após rollback.
- Edge: se necessário, redeploy do backup exato de `consulta-executar` v48 capturado antes do rollout. Não alterar `magic-link-consume`.
- Banco: a migration é aditiva. Não remover colunas/RPC nem apagar relatórios, consultas, autorizações ou auditoria em rollback; manter o schema e corrigir para frente. As features começam desligadas.
- Consultas: nenhum teste ou smoke deve chamar o provedor nem debitar carteira/cota.

## Critérios de aceite e gate

- A promoção copiou o artefato exato da preview `dpl_2rfQTUvxn5rNR8BBcRXeqpDFy6Fr`; nenhum novo build com o working tree local foi enviado.
- O relatório foi observado visualmente no Chrome local; a preview Vercel tem proteção SSO. Após a promoção, o smoke direto em produção confirmou HTTP 200 em `/`, `/admin` e `/admin/propostas`; o smoke autenticado visual de produção permanece pendente.
- Migration única aplicada e verificada; Edge ativa com JWT; Vercel READY com aliases corretos.
- Relatório aparece apenas para Admin/equipe/parceiro autorizados pela relação vigente; sem acesso direto ao `response` e sem exposição a cliente/anon.
- O dono do produto autorizou explicitamente a promoção da preview para produção em 29/10/2026.
