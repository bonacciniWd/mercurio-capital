# Correção — MERX Pública com FAQ vazia

**Status:** correção publicada em produção e smoke HTTP concluído.

## Objetivo

Corrigir a falha `undefined is not an object (evaluating 'config.faq.length')` ao abrir Configurações > MERX pública, preservando a FAQ padrão quando a RPC retornar FAQ vazia ou inválida.

## Documentação lida

- Instruções `AGENTS.md` fornecidas pelo dono do projeto nesta conversa.
- `docs/operacao/change-management.md` e `docs/operacao/release-checklist.md`.
- `docs/operacao/merx-publica-atendimento.md`.
- Plano da publicação `prompts/2026-10-30-publicacao-merx-publica.md`.

## Código inspecionado

- `app/src/components/admin/MerxPublicaTab.tsx`.
- `app/src/components/merx/MerxPublicChat.tsx`.
- `app/src/lib/merxPublica.ts`.
- RPCs em `supabase/migrations/20261030000001_merx_public_faq.sql`.
- Testes atuais `app/src/test/merxPublicChat.test.tsx`.

## Diagnóstico e decisão

A RPC administrativa retorna `faq: []` quando ainda não há configuração salva. `readConfig()` transforma esse array vazio em `undefined`, e o spread em `setConfig(current => ({ ...current, ...incoming }))` substitui a FAQ inicial por `undefined`. A renderização posterior acessa `config.faq.length` e lança o erro reportado.

Manter a FAQ padrão quando a resposta não contiver uma lista válida e não sobrescrever campos atuais com valores `undefined`. Sem mudança de modelo, migration, Edge Function ou regra de negócio.

## Arquivos esperados

- Alterar `app/src/components/admin/MerxPublicaTab.tsx` para normalizar/mesclar configuração com segurança.
- Criar ou atualizar teste focal da aba MERX para resposta `faq: []`, resposta sem `faq` e erro/retorno nulo da RPC.
- Atualizar este plano com evidência dos checks.

## Critérios de aceite

- A aba não lança exceção se FAQ vier vazia, ausente, malformada ou se a RPC retornar erro.
- FAQ padrão permanece disponível para edição nos casos sem configuração válida.
- Configuração válida retornada pela RPC continua carregando normalmente.
- Nenhuma escrita no banco, Serasa, WhatsApp ou captação de lead é executada durante os testes.

## Segurança e impacto

- Frontend administrativo somente; sem exposição de dados, credenciais ou ampliação de permissões.
- Sem alteração no Supabase remoto ou nos secrets.
- O workspace já possui outras mudanças locais não relacionadas; limitar o diff aos arquivos deste plano.

## Verificação

- Teste unitário/regressão para os formatos vazios e válidos.
- `npm run lint`, `npm run typecheck`, `npm test -- --maxWorkers=1`, `npm run build` dentro de `app/`.
- A publicação Vercel e o smoke HTTP ficam registrados abaixo; não foi possível validar a aba com sessão Admin autenticada nesta execução.

## Resultado

- `MerxPublicaTab` agora só mescla propriedades válidas; FAQ ausente, vazia ou malformada mantém a FAQ padrão. Falha de rede deixa a tela padrão acessível e mostra feedback.
- Novo teste `app/src/test/merxPublicaTab.test.tsx`: 5 casos passaram.
- Suíte completa: 199 testes em 49 arquivos passaram.
- Typecheck e build passaram.
- Lint passou sem erros e com 33 avisos preexistentes.
- Nenhuma chamada de escrita, migration, consulta Serasa/WhatsApp ou captação foi executada.

## Publicação autorizada e smoke (2026-10-30)

- Vercel produção: deployment `dpl_CGKueUKzH1ENT5VsnVc9RYruQDTP`, READY, alias `https://www.mercuriocapitalsa.com.br`.
- O pacote de deploy foi o staging isolado da publicação MERX anterior, atualizado somente com `MerxPublicaTab.tsx`; o teste de regressão ficou fora do bundle.
- GET retornou 200 em `/`, `/admin/configuracoes`, `/simulador` e `/credito-para-construcao`.
- O chunk `Configuracoes-8GNDBI3_.js` publicado contém o fallback de erro de rede novo.
- Nenhuma migration, gravação de lead, chamada Serasa/WhatsApp, commit ou push foi realizada.
- Rollback Vercel para a deployment imediatamente anterior: `dpl_BbwD4bqYMJuuC8gYbiA5xEV6UYjq`.

## Rollback

Reverter apenas o diff do componente/teste. Se a correção for publicada e houver regressão, promover a deployment Vercel anterior à correção.
