# Restaurar MERX Pública em produção

**Status:** publicação corretiva concluída; a aba de configuração MERX e o dashboard de fundos estão no mesmo artefato de produção.

## Objetivo

Restaurar no artefato de produção a aba MERX pública em `/admin/configuracoes` e os componentes públicos da MERX, preservando também os ajustes de fundos/Kanban recém-publicados.

## Documentação lida

- `prompts/2026-10-30-publicacao-merx-publica.md` e `prompts/2026-10-30-correcao-merx-publica-faq-nula.md`.
- `prompts/2026-10-30-revisao-dashboard-fundos-kanban.md`.
- `docs/operacao/merx-publica-atendimento.md` e checklist/runbook de release registrados nos planos acima.
- Instruções `AGENTS.md` fornecidas na conversa.

## Diagnóstico e decisão

A implantação de dashboard `dpl_GkwXADRZuoZUW1sJhUfEv3KB5KCv` foi montada a partir de `cfdfc02` e excluiu alterações MERX que ainda estavam apenas no workspace. O bundle público atual não contém a aba `MERX pública`; o workspace local contém a aba em `Configuracoes.tsx`, seu componente e teste. A publicação MERX previamente aprovada está registrada como `dpl_CGKueUKzH1ENT5VsnVc9RYruQDTP` (correção da FAQ) e `dpl_BbwD4bqYMJuuC8gYbiA5xEV6UYjq` (widget e configuração).

Preparar uma única snapshot limpa contendo os arquivos do dashboard já publicados e as alterações específicas da MERX Pública previamente aprovadas. Não incluir mudanças de Serasa, WhatsApp, telas de proposta, nem alterações de dependências do workspace além da entrada de lockfile DOMPurify 3.4.17 já validada no release anterior. Não aplicar migration, chamar endpoints de escrita, submeter lead ou alterar configuração no banco.

## Código inspecionado

- `app/src/pages/admin/Configuracoes.tsx`, `app/src/components/admin/MerxPublicaTab.tsx`, `app/src/lib/merxPublica.ts` e teste da aba.
- `app/src/components/merx/MerxPublicChat.tsx`, `MerxPublicHost.tsx`, `app/src/router.tsx`, estilos MERX em `app/src/index.css`, `emailValidation.ts` e asset `icon-wing.svg`.
- Arquivos dashboard/Kanban listados na seção 17 de `prompts/2026-10-30-revisao-dashboard-fundos-kanban.md`.

## Modelo e segurança

Sem alteração de dados ou modelo. A aba administrativa usa as RPCs existentes e o controle Admin já definido; o cliente não recebe secrets. O widget continua FAQ determinístico e usa a Edge Function pública existente somente após consentimento/validações do fluxo já aprovado. Smoke não envia lead nem executa consulta Serasa/WhatsApp.

## Critérios e verificações

- Snapshot inclui a aba administrativa e o widget aprovado, junto com o dashboard de fundos/Kanban já publicado.
- Lint, typecheck, teste focal MERX, testes focados de fundos e build passam na snapshot.
- Smoke HTTP confirma os chunks publicados e a presença dos identificadores MERX e dashboard. Sem login, persistência, envio de lead ou validação visual autenticada nesta etapa.
- Rollback: reassociar `www.mercuriocapitalsa.com.br` e `mercuriocapitalsa.com.br` ao deployment imediatamente anterior ao release corretivo, preservando a implantação atual como opção de retorno.

## Resultado da publicação (03/11)

- A snapshot foi montada em worktree isolada a partir de `cfdfc02`, trazendo os arquivos de fundos/Kanban usados na publicação anterior, apenas as chamadas de invalidação de cache no detalhe (sem componente Serasa), e o código MERX público/admin já aprovado. Nenhum arquivo de integração Serasa ou WhatsApp foi copiado; nenhum `package.json`, migration ou dado remoto foi alterado.
- A snapshot passou lint (33 avisos preexistentes, zero erros), typecheck, os testes focados MERX/fundos (22/22) e build (com aviso existente de chunk acima de 500 kB).
- Vercel produção: `dpl_DD3evkmFr2qmj32vuPoQtSyC8edm` (`mercurio-digital-57cjrujt7-bonacciniwds-projects.vercel.app`), `READY`.
- Os aliases `www.mercuriocapitalsa.com.br` e `mercuriocapitalsa.com.br` foram apontados para esse deployment. Verificação pública: `/` retorna 200, raiz redireciona para `www`, o HTML usa `index-CwW1hoKL.js`; o chunk remoto de Configurações `Configuracoes-BV5dx65J.js` contém `MERX pública`, `admin_merx_publica_obter`, `Perguntas e respostas` e `Preencha pergunta`. O bundle principal mantém `admin_proposta_fundos_vencedores`, “Fundo vencedor” e “Volume total do recorte”.
- Rollback de roteamento para a implantação que estava ativa imediatamente antes desta correção: `dpl_GkwXADRZuoZUW1sJhUfEv3KB5KCv` (`mercurio-digital-h22xymr35-bonacciniwds-projects.vercel.app`); reassociar os dois aliases com `vercel alias set <deployment> <domínio>`. Nenhum rollback foi executado.
- Não houve teste visual autenticado nesta sessão, nem envio de lead; confirmar a aba ao entrar em `/admin/configuracoes` com a sessão Admin habitual. A validação de RPC e da tela MERX já estava registrada nos releases anteriores.
