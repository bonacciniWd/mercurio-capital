# Plano — Edição dos valores dos imóveis e recálculo do LTV

**Status:** implementado, validado e publicado na Vercel em 2026-10-08, com GO web posterior ao preflight inicial.
**Escopo:** tela administrativa de detalhes da proposta, aba **Imóveis**.

## Objetivo

Permitir que a equipe altere com segurança o valor de cada imóvel já vinculado a uma proposta e visualizar, durante a edição, o valor agregado das garantias e o LTV recalculado. Para vários imóveis, o cálculo deve considerar a soma de todos os valores: `LTV = valor solicitado ÷ soma dos valores dos imóveis`.

## Documentos e skills consultados

- `docs/README.md`
- `docs/operacao/change-management.md`
- `docs/operacao/datas-propostas.md`
- `docs/blueprint/01-architecture.md`
- `docs/blueprint/02-roles-permissions.md`
- `docs/blueprint/04-database-schema.md`
- `docs/blueprint/08-security-compliance.md`
- `docs/handoffs/17-handoff-wizard-proposta.md`
- Não há skill específica aplicável a esta correção.

## Código e configuração inspecionados

- `app/src/pages/admin/PropostaDetalhe.tsx`: estado e formulário de edição dos imóveis, RPC usada ao salvar, invalidação de consultas e LTV exibido.
- `app/src/components/MoneyInput.tsx`: entrada monetária existente, com formatação e parsing `pt-BR`.
- `app/src/lib/credito.ts`: função `calcularLTV`.
- `app/src/pages/partner/Wizard.tsx`: soma dos valores de todos os imóveis no fluxo de criação.
- `supabase/migrations/20260513000003_originacao.sql`: tabela `imoveis` e trigger que recalcula `propostas.valor_imoveis_total` pela soma dos imóveis.
- `supabase/migrations/20260803000002_lote_c_proposta_edicao_responsavel.sql`: RPC `admin_proposta_update_campos`, que atualiza somente imóveis vinculados à proposta e exige autorização operacional de administrador.
- `app/package.json`: comandos de lint, typecheck, teste e build.

## Diagnóstico, decisões e suposições

- O formulário atual usa `input type="number"` para valor monetário, sem apresentação em reais no padrão brasileiro.
- O LTV da tela usa `proposta.valor_imoveis_total`; por isso, não acompanha alterações ainda não salvas no formulário.
- O banco já mantém o total persistido pela soma de todos os imóveis e a RPC atualiza imóveis existentes dentro da proposta; não é necessário alterar o modelo de dados nem criar migration para esta correção.
- Reutilizar `formatReais` e `parseReaisInput` do componente `MoneyInput`, junto com `calcularLTV`; o formulário calculará a soma dos imóveis em edição e exibirá o LTV estimado a partir desse total.
- Após salvar, a RPC e o trigger existentes continuam sendo a autoridade para persistência; a tela atualizará os dados consultados e o LTV confirmado.
- A mudança será limitada a editar imóveis que já pertencem à proposta. O botão existente de inclusão de imóvel e sua persistência não serão alterados nesta etapa, pois isso requer uma mudança adicional no contrato da RPC.
- Nenhuma regra nova de aprovação, bloqueio ou limite de LTV será criada. O cálculo é informativo e segue a política atual.

## Modelo de dados e relacionamentos

Sem alteração de modelo. Cada registro `imoveis` existente pertence a uma `propostas` por `proposta_id`; `valor` é monetário em reais. O campo agregado `propostas.valor_imoveis_total` corresponde à soma de `imoveis.valor` para a proposta e é mantido pelo trigger existente. O LTV é calculado com o valor solicitado dividido pelo total agregado das garantias. Se o total for zero, será preservado o comportamento atual de `calcularLTV` (LTV igual a zero).

## Arquivos esperados

- `app/src/pages/admin/PropostaDetalhe.tsx`: entrada monetária localizada, prévia do total e LTV estimado durante edição; manter persistência pela RPC existente.
- `app/src/lib/credito.ts`: helper de soma de valores de imóveis, se necessário para compartilhar a regra e testá-la isoladamente.
- `app/src/lib/credito.test.ts`: cobertura de cálculo com um e múltiplos imóveis, incluindo total zero.
- `prompts/2026-10-08-editar-valores-imoveis-ltv.md`: plano e registro do resultado após implementação.

## Requisitos e critérios de aceite

1. Na aba **Imóveis** da proposta administrativa, cada valor existente pode ser editado com digitação monetária em `pt-BR` (por exemplo, `R$ 1.250.000,00`).
2. Enquanto houver edição, a interface mostra a soma atualizada dos valores dos imóveis e o LTV estimado, sem usar o total antigo salvo.
3. Com múltiplos imóveis, a soma considera cada imóvel uma única vez; o LTV usa `valor_solicitado ÷ soma_das_garantias`.
4. Salvar altera somente os registros já vinculados à proposta; após sucesso, a tela refaz as consultas e mostra o total/LTV persistidos.
5. Cancelar descarta as alterações não salvas e não altera a proposta.
6. Usuários sem autorização operacional continuam sem poder editar; a autorização da RPC permanece obrigatória no servidor.
7. Não alterar regras de classificação, aprovação de crédito ou limite de LTV.

## Segurança e impacto por superfície

- Web (`app/`): afetada apenas na tela administrativa da proposta.
- Mobile: não afetado.
- Banco, migrations e RLS: nenhum schema ou migration novo previsto; manter RPC, trigger e autorização existentes.
- Edge Functions e integrações: não afetadas.
- Electron e empacotamento: sem ajuste específico; compartilhará a mudança web existente.
- Segurança/compliance: valores continuam sendo atualizados pela RPC autenticada, com vínculo validado por `proposta_id`; nenhuma escrita direta nova do navegador nem exposição de segredo.
- Documentação, deploy e release: atualizar este registro após implementação. Deploy/release ficam fora deste plano e exigem gate próprio.

## Testes

### Automáticos

- Testar soma e LTV com um imóvel, múltiplos imóveis, valores alterados e total de garantias igual a zero.
- Executar `npm test`, `npm run lint`, `npm run typecheck` e `npm run build` em `app/`.

### Manuais no navegador

1. Abrir uma proposta com um imóvel, editar o valor e confirmar a apresentação em reais e a atualização do LTV antes de salvar.
2. Repetir em proposta com dois ou mais imóveis e confirmar que o valor total é a soma de todos e o LTV usa esse total.
3. Salvar, recarregar a aba e confirmar a persistência e os valores recalculados.
4. Alterar um valor e cancelar; confirmar que o valor persistido permanece inalterado.
5. Verificar que o usuário operacional autorizado consegue editar e que a autorização de servidor continua protegendo a RPC.

Nenhum teste manual usará dados de produção sem autorização específica.

## Rollout e rollback

Mudança local de interface e cálculo, sem migration remota. Rollback consiste em reverter os arquivos locais alterados; não há mudança de dados ou infraestrutura. O dono aprovou separadamente o deploy desta correção, sujeito ao preflight e aos gates operacionais abaixo.

### Preflight de produção — 2026-10-08

Registro histórico da primeira tentativa, superado pela autorização e publicação web abaixo.

- O dono do produto aprovou publicar esta correção específica.
- A Vercel aponta o domínio de produção para um deploy criado em `2026-10-07 17:26 UTC`, associado ao commit `5225be7` com `gitDirty=1`. O conteúdo exato dessa árvore não está versionado no commit.
- A árvore local atual inclui mudanças posteriores a esse deploy, entre elas a nova interface de amortização pública e a reformulação de `/admin/leads/simulacoes`. O plano desta última exclui deploy nesta etapa, e a documentação operacional registra a interface pública de amortização como ainda não publicada. Fazer deploy diretamente de `app/` incluiria código fora do escopo autorizado.
- A reconstrução local exata da origem publicada não está disponível no Git; por isso não foi possível produzir com segurança um artefato contendo somente a edição de imóveis/LTV sem risco de remover mudanças que já estão em produção ou incluir mudanças pendentes.
- A checklist de release vigente mantém o estado `NO-GO`. Auditoria atual do lockfile: `npm audit --omit=dev` encontrou 0 vulnerabilidades High/Critical; auditoria completa encontrou 2 Critical, 9 High, 14 Moderate e 1 Low, ainda sem decisão documentada para os achados de dependências.
- Nenhum deploy, migration, escrita de dados ou alteração em produção foi executado. Para liberar esta correção, é necessário reconciliar uma origem limpa com o deploy atual e fechar os gates de segurança aplicáveis ao canal web.

## Resultado da implementação e validação

- A edição dos valores usa entrada monetária `pt-BR`; a prévia soma os imóveis carregados e recalcula o LTV durante a edição.
- A persistência continua pela RPC administrativa existente; o recálculo definitivo do total continua no trigger do banco.
- Testes automatizados: 28 arquivos e 103 testes passaram.
- `npm run lint`: passou sem erros; reportou 38 avisos em arquivos existentes do projeto.
- `npm run typecheck`: passou.
- `npm run build`: passou; Vite reportou o aviso existente de bundle acima de 500 kB.
- Checagem manual: o preview local sem sessão redireciona ao login. Sem fixture autenticada isolada, não foi feito teste manual de edição/salvamento; não houve alteração de dados.
- A persistência de novos imóveis pelo botão já existente permanece fora deste escopo aprovado.
- A publicação foi impedida pelo preflight descrito acima; a autorização para esta correção não foi estendida às demais mudanças locais.

### Publicação web posterior — 2026-10-08

O dono autorizou a publicação da versão web atual com os demais ajustes aprovados, mantendo o release Electron separado. Publicação final confirmada no deploy `dpl_HprnEB7yyi6wBAn8upRfuRqEh338`, em `https://www.mercuriocapitalsa.com.br`. Plano e evidências: [publicação web](./2026-10-08-deploy-web-vercel.md).

Smoke autenticado local conferiu o valor existente em reais, edição para R$ 500.000,00, atualização imediata do total e LTV para 62% e cancelamento restaurando valor de R$ 600.000,00 e LTV anterior. Nenhuma proposta real foi salva. Casos com múltiplos imóveis permanecem cobertos pelos testes automatizados de soma/LTV; persistência real por salvar não foi exercitada neste smoke.
