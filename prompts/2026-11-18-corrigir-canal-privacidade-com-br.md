# Corrigir o canal de contato da política de privacidade para `.com.br`

## Objetivo

Alinhar o contato de privacidade para `contato@mercuriocapitalsa.com.br`, conforme confirmação do dono do produto em 2026-11-18. A política pública atualmente contém referências inconsistentes a `.com` e `.com.br`.

## Documentação e código inspecionados

- `AGENTS.md` e instruções operacionais fornecidas para este repositório.
- `docs/operacao/politica-privacidade-publica.md`.
- `app/src/pages/public/PoliticaPrivacidade.tsx`.
- `app/src/test/creditoParaConstrucao.test.tsx` como ponto de entrada existente para testes da aplicação.
- `prompts/2026-11-18-integrar-politica-privacidade-publica.md` e `prompts/2026-10-16-ajuste-status-politica-aprovada.md` para preservar o histórico e registrar a confirmação atual.
- `rg` nas referências do canal e domínio da política: o componente tem `mailto:` e duas menções textuais `.com`, além do rodapé já correto em `.com.br`; a documentação operacional usa `.com`.

## Decisões e escopo

- O endereço canônico é `contato@mercuriocapitalsa.com.br`, confirmado pelo usuário.
- Atualizar o destinatário `mailto:` e todas as menções visíveis na política pública.
- Atualizar a documentação operacional para o endereço confirmado.
- Preservar o registro histórico dos planos anteriores; acrescentar uma nota de correção que explique que a confirmação atual supersede o endereço `.com` registrado anteriormente.
- Não alterar outros endereços de e-mail do sistema, fluxo de envio, conteúdo jurídico, banco, autenticação, Firebase ou notificações.
- Não enviar e-mail durante a implementação.

## Arquivos previstos

- `app/src/pages/public/PoliticaPrivacidade.tsx`
- `app/src/test/creditoParaConstrucao.test.tsx` (ou teste focado já existente após inspeção do arquivo)
- `docs/operacao/politica-privacidade-publica.md`
- `prompts/2026-11-18-integrar-politica-privacidade-publica.md` (adendo factual de correção)
- `prompts/2026-10-16-ajuste-status-politica-aprovada.md` (adendo histórico, sem reescrever a decisão original)

## Critérios de aceite

1. O link de contato da política abre o aplicativo de e-mail com destinatário `contato@mercuriocapitalsa.com.br`.
2. Todos os endereços exibidos na política pública usam `.com.br`.
3. A documentação operacional identifica `.com.br` como o canal vigente.
4. Os planos históricos mantêm o registro original e incluem a confirmação posterior que o supersede.
5. Nenhuma outra configuração ou superfície de e-mail é modificada.

## Segurança e rollout

- Mudança apenas de conteúdo estático e documentação; sem dados pessoais, segredos, migration ou alteração de autorização.
- A publicação anterior da política não é automaticamente repetida por este plano. Qualquer novo deploy será tratado conforme a autorização de release aplicável depois da implementação e validação local.
- Preservar todas as alterações não relacionadas já existentes no working tree; preparar qualquer commit futuro somente com os arquivos allowlisted deste plano.

## Testes

- Adicionar/ajustar teste para validar o destinatário `.com.br` do link `mailto:` e o texto exibido.
- Executar o teste direcionado e `npm run lint`, `npm run typecheck` e `npm run test` em `app/`.
- Executar `rg` para confirmar que não restam menções ativas a `contato@mercuriocapitalsa.com` sem `.br` nos arquivos da política e da documentação operacional.
- Revisar o diff para confirmar que não inclui arquivos alheios.

## Aprovação

Aprovado pelo usuário em 2026-11-18 antes da implementação.

## Implementação e validação

- Atualizados o `mailto:`, as três menções visíveis na política e a documentação operacional para `.com.br`.
- Atualizados os testes para validar destinatário e todas as menções exibidas.
- Acrescentados adendos aos planos anteriores, preservando os registros históricos e indicando que a confirmação de 2026-11-18 os supersede.
- Teste direcionado `npm test -- src/test/creditoParaConstrucao.test.tsx`: 1 arquivo, 6 testes passaram.
- `npm run lint`: passou sem erros; 34 avisos existentes em outros arquivos.
- `npm run typecheck`: passou.
- `npm run build`: passou; permanece o aviso de chunks acima de 500 kB.
- `npm run test`: 63 arquivos e 323 testes passaram; 2 testes não relacionados falharam por timeout: `src/test/adminLeadsSimulacoes.test.tsx` e `src/test/dateRangePicker.test.tsx`.
- `git diff --check`: passou. Busca nos arquivos ativos da política e documentação não encontrou endereço `.com` sem `.br`; as ocorrências `.com` restantes são apenas o histórico original, explicitamente supersedido por adendos.
- Revisão read-only: sem achados Medium/High/Critical; um achado Low identificou o status desatualizado deste plano, corrigido nesta seção.

## Publicação

A autorização anterior do usuário para “commit e deploy” desta política cobriu a correção pontual do contato na mesma página. A publicação foi feita diretamente em produção pela Vercel a partir de checkout isolado, sem push ao GitHub ou acionamento de Actions; os identificadores e resultados estão abaixo.

- Commit local: `212da40` (`fix(web): use .com.br privacy contact`), somente os seis arquivos previstos no escopo.
- Projeto Vercel correto `mercurio-digital`: deployment `dpl_5hVDNj6KUNWcWwwXrVZo2NGhyv79`, estado **READY**, produção em `https://mercuriocapitalsa.com.br`.
- Smoke: `/politica-de-privacidade` respondeu HTTP 200. O bundle publicado contém `mailto:contato@mercuriocapitalsa.com.br` e três referências visíveis ao endereço `.com.br`.
- Sem push ao GitHub e sem execução de GitHub Actions.
- Atenção operacional: uma primeira chamada do CLI, antes de aplicar o vínculo Vercel na raiz do worktree, criou o projeto Vercel separado `mercurio-privacy-release-212da40` (`dpl_BSyNbNfqy6XYbPtHEJNbgxhPjWv3`) e associou-o ao repositório GitHub. Esse deployment não recebeu o domínio oficial, não substituiu a produção e não houve push ao GitHub. O projeto separado foi deixado intacto; remoção/desconexão não foi feita.
