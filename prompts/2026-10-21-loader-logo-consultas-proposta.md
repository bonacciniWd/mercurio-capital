# Plano — loader Mercúrio para proposta e consultas

Data: 21/10/2026
Status: implementado e validado em 21/10/2026.

## Objetivo

Usar `app/src/assets/logos/logo.svg` como loader visual da Mercúrio em operações que podem durar alguns segundos, especialmente o envio da nova proposta e a execução de consultas externas. Exibir a mensagem `Carregando` com animação discreta e acessível, mantendo os loaders compactos já usados em tabelas, queries e botões.

## Documentação e código inspecionados

- `AGENTS.md` e fluxo de release local.
- `app/src/assets/logos/logo.svg`, SVG animado fornecido pelo produto.
- `app/src/pages/partner/Wizard.tsx`, fluxo de nova proposta e submissão.
- `app/src/components/PropostaConsultas.tsx`, execução autenticada de consultas e estados `executingTipo`/`isPending`.
- `app/src/index.css`, tokens e estilos globais existentes.

## Decisões e premissas

- Criar um componente React reutilizável, sem nova dependência.
- O SVG continuará sendo servido pelo bundle; não será convertido em base64 nem carregará tokens/dados.
- O loader será um overlay local da área de trabalho, com `role="status"`, texto visível e `aria-live="polite"`.
- O overlay bloqueará cliques apenas durante a operação ativa para evitar envio/consulta duplicados.
- O texto será configurável para distinguir `Carregando proposta` e `Consultando dados` quando necessário; a animação visual exibirá `Carregando` de forma consistente.
- Respeitar `prefers-reduced-motion`: manter a logo visível e remover a animação do texto/efeitos adicionais quando solicitado pelo sistema.
- Não alterar contratos Supabase, Edge Functions, timeouts, débito ou reconciliação.

## Arquivos esperados

- `app/src/components/BrandLoading.tsx` — componente de overlay e texto animado.
- `app/src/index.css` — estilos responsivos, acessibilidade e redução de movimento.
- `app/src/pages/partner/Wizard.tsx` — overlay durante submissão efetiva da proposta.
- `app/src/components/PropostaConsultas.tsx` — overlay durante consulta externa ativa, preservando mensagens de erro e reconciliação.
- Teste direcionado do componente/estados, se a infraestrutura existente permitir sem criar teste superficial.

## Critérios de aceite

1. A logo `logo.svg` aparece durante o envio da nova proposta e durante consultas externas.
2. O estado mostra `Carregando`/mensagem contextual e impede ações duplicadas enquanto ativo.
3. Ao concluir ou falhar, o overlay desaparece e a mensagem de erro/sucesso existente continua funcional.
4. O loader não aparece em carregamentos comuns de tabelas, autenticação ou queries sem operação demorada.
5. Layout funciona em desktop e mobile, sem criar rolagem horizontal ou fundo preto inesperado.
6. Leitores de tela recebem um status compreensível; `prefers-reduced-motion` é respeitado.
7. Nenhum token, CPF/CNPJ, resposta bruta ou dado de consulta é renderizado pelo componente.

## Segurança e limites

- Alteração somente de frontend visual/estado local.
- Nenhum segredo ou chamada externa será movido para o navegador.
- A reconciliação de consultas continua sendo tratada pelo backend; o loader não fará retry automático.

## Verificações

- `npm run lint` em `app/`.
- `npm run typecheck` em `app/`.
- `npm run build` em `app/`.
- Teste manual no navegador: abrir nova proposta, submeter; executar uma consulta; verificar estado ativo, bloqueio de duplicidade, conclusão, erro e viewport mobile.
