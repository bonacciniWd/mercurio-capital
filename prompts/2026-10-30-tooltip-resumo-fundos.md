# Plano — explicação do resumo de fundos

## Objetivo

Adicionar um pequeno botão de informação junto ao resumo superior de distribuição por fundos. Ao passar o mouse ou focar/ativar pelo teclado, ele deve explicar o que significam “Volume total do recorte” e “Operações únicas”. Não alterar consultas, fórmulas ou filtros.

## Skills/documentos lidos

- `skills/UX_skills.md`: preservar conteúdo acessível ao expor explicações por tooltip.
- `prompts/2026-10-30-revisao-dashboard-fundos-kanban.md`: regra vigente do resumo e primeiro fundo aprovado.
- `AGENTS.md` fornecido na conversa: fidelidade ao escopo, plano antes do código e verificações.

## Código inspecionado

- `app/src/components/FundoDistribuicaoCard.tsx`: resumo superior construído com `Metric`; recebe agregados da RPC `admin_dashboard_fundos_analytics`.
- A lógica de totalização segue sem alteração: proposta contada uma vez no primeiro fundo aprovado; Standby excluído; canceladas permanecem no volume solicitado.

## Decisões e suposições

- O botão `i` explica o resumo inteiro, incluindo ambas as métricas, em vez de mudar cada valor.
- Tooltip aparece em hover e foco; botão acessível por teclado, com `aria-label` e conteúdo associado via `aria-describedby`.
- A explicação informa que o escopo vem do período/filtros gerais do Dashboard, o volume é solicitado (não liberado), canceladas continuam incluídas e Standby é excluído.
- Usar `btn-no-liquid`; sem dependências ou alterações de backend.

## Arquivos esperados

- `app/src/components/FundoDistribuicaoCard.tsx`
- Este plano, atualizado com verificações ao concluir.

## Critérios de aceite

- Ícone de informação discreto ao lado do resumo.
- Mouse hover e foco/teclado exibem a explicação; leitor de tela recebe nome e descrição.
- Tooltip não cobre os próprios números nem muda o layout de forma perceptível em desktop/mobile.
- Valores, consultas, permissões e regras de cálculo permanecem intactos.

## Implementação e verificações (30/10/2026)

- Adicionado botão de informação junto aos indicadores com tooltip acessível por hover e foco, usando `btn-no-liquid`.
- O texto documenta período/filtros globais, volume solicitado, atribuição única ao primeiro fundo aprovado, canceladas incluídas, Standby excluído e que o total não representa valores liberados.
- `npm run typecheck`: passou.
- `npm run lint`: passou sem erros; 33 avisos existentes em outros arquivos.
- `npm run build`: passou; permanece aviso de bundle acima de 500 kB.
- `git diff --check`: passou.
- Não foi feita verificação visual manual no navegador; não houve deploy nem alteração de dados ou backend.

## Correção de legibilidade (30/10/2026)

- Após retorno de que a caixa estava estreita e alta, aumentei a largura do tooltip para 24rem (limitada pela viewport), explicitei quebra de texto e reduzi o texto e a densidade vertical.
- ESLint focado no componente, typecheck e build passaram. O build mantém o aviso de bundle acima de 500 kB.
- A confirmação visual no navegador continua pendente.

## Segunda correção de layout (30/10/2026)

- Para remover ambiguidade do comportamento inline/arbitrário, o conteúdo passou a ser um `div`, com posicionamento e largura explícitos limitados à viewport.
- Mantidos quebra normal de linhas, foco/hover e conteúdo conciso.
- ESLint do componente, typecheck, build e `git diff --check` passaram. Build ainda avisa sobre chunk >500 kB.
- O servidor local respondeu em `localhost:5173`, mas este ambiente não tem Playwright nem Chrome disponível para verificação visual automatizada.

## Publicação (30/10/2026)

- Deploy feito a partir de snapshot isolado no commit `cfdfc02`, incluindo somente `FundoDistribuicaoCard.tsx` e o helper `fundProposalFilter.ts` necessários ao componente. Alterações locais de outros módulos não foram enviadas.
- Preview validada: `dpl_HBTieCu5EodaRFWG6nBdfwn5CmbQ` (`mercurio-digital-i7lz49hao-bonacciniwds-projects.vercel.app`). O bundle confirmou os textos do resumo e tooltip.
- Produção: `dpl_5FrwStYJLARxz4yJoxV2g9Mp6xZS` (`mercurio-digital-hgf4691zq-bonacciniwds-projects.vercel.app`). Os aliases `mercuriocapitalsa.com.br` e `www.mercuriocapitalsa.com.br` apontam para essa deployment.
- Smoke check: domínio público respondeu HTTP 200 (o domínio sem `www` redireciona com 308 para `www`); bundle público contém “Volume total do recorte”, “Operações filtradas” e a explicação do tooltip.
- Rollback de produção disponível: `dpl_CGKueUKzH1ENT5VsnVc9RYruQDTP` (`mercurio-digital-dnr28ch6z-bonacciniwds-projects.vercel.app`).
- Uma tentativa inicial acidental a partir do workspace completo foi revertida antes de promover a versão pretendida; a deployment acidental foi removida e os domínios foram verificados/restaurados antes da publicação isolada.

## Segurança

- Somente texto explicativo fixo; sem dados pessoais, chamadas de rede, escrita ou mudança de permissões.

## Testes

- `npm run typecheck`, lint e build foram executados no snapshot isolado de deploy.
- Verificar no navegador hover, foco via Tab, leitura acessível e viewport mobile; se não houver sessão local disponível, registrar essa limitação.
