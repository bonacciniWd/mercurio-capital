# Correção — calendário do dashboard e reabertura no Electron

## Status

Implementação aprovada e concluída localmente. Nenhuma migration, deploy, instalador ou release foi gerado.

## Objetivo

Corrigir o estado visual do seletor de período usado no dashboard e no financeiro e substituir a captura nativa do motivo de reabertura por um modal React profissional, compatível com navegador e Electron empacotado.

## Skills e documentos lidos

- instruções `AGENTS.md` fornecidas ao repositório;
- skill `browser:control-in-app-browser` para a futura validação visual;
- `prompts/2026-09-02-fase-2-dashboard-financeiro.md`;
- `prompts/2026-09-02-fase-2-1-dashboard-ui-profissional.md`;
- `docs/handoffs/20-handoff-fase2-1-dashboard-ui.md`;
- documentação e CSS locais de `react-day-picker` v9;
- configuração atual do Electron e do `electron-builder`.

## Código e artefatos inspecionados

- `app/src/components/ui/date-range-picker.tsx`;
- `app/src/components/ui/popover.tsx`;
- `app/src/components/ui/button.tsx`;
- `app/src/pages/admin/Dashboard.tsx`;
- `app/src/pages/admin/Financeiro.tsx`;
- `app/src/index.css`;
- `app/desktop/electron/main.cjs`;
- `app/desktop/electron/preload.cjs`;
- `app/electron-builder.json`;
- testes atuais de inicialização desktop;
- `app.asar` dos artefatos locais `v0.1.6` para macOS e Windows.

## Diagnóstico confirmado

### Calendário

O `DateRangePicker` sobrescreve a classe `selected` com `bg-red-700 text-white`. No modo `range`, o `react-day-picker` marca todos os dias compreendidos como selecionados, além de aplicar `range_start`, `range_middle` e `range_end`. A classe vermelha genérica disputa com o fundo claro do miolo do intervalo e deixa a faixa inteira vermelha ou visualmente inconsistente.

### Motivo de reabertura

`FechamentoTab` usa `window.prompt` dentro da mutation. Esse diálogo nativo não faz parte da UI React, não oferece os estados necessários e não é confiável no renderer do Electron empacotado. A RPC já exige e audita `p_motivo`; portanto, a correção é somente de cliente e não requer alteração no banco.

### Artefato desktop

Os `app.asar` locais identificados como `v0.1.6` não contêm os textos nem a RPC da implementação financeira atual, indicando que esses pacotes são anteriores à Fase 2. Eles não serão sobrescritos nem publicados nesta correção. Após a implementação, será validado o bundle web destinado ao Electron; um novo instalador/release continuará dependendo de autorização separada.

## Decisões e suposições

- Manter a identidade Mercúrio: vermelho apenas nas extremidades selecionadas e em ações primárias; miolo do intervalo em vermelho muito claro com texto cinza/preto.
- Remover a classe vermelha genérica de `selected` e estilizar explicitamente `range_start`, `range_middle` e `range_end` conforme a API local instalada.
- Substituir somente o `window.prompt` da reabertura por modal controlado em React, sem alterar a RPC nem a regra mínima de cinco caracteres.
- O modal mostrará a competência, explicará o efeito auditável, exibirá contador/erro, impedirá confirmação inválida e terá estados cancelar, confirmar, carregando e erro.
- Fechar por `Escape`, clique no backdrop e botão fechar somente quando não houver envio em curso.
- Não alterar `main.cjs`, `preload.cjs` ou políticas de segurança do Electron, salvo se uma verificação posterior revelar uma causa adicional.
- Não criar migration, gravar dados remotos, publicar preview, produzir instaladores ou gerar release nesta etapa.

## Arquivos esperados

- `app/src/components/ui/date-range-picker.tsx`;
- novo componente local de diálogo em `app/src/components/ui/`, se a reutilização não estiver disponível;
- `app/src/pages/admin/Financeiro.tsx`;
- testes focados do calendário e do modal de reabertura;
- atualização do handoff da Fase 2.1 após validação.

## Requisitos e critérios de aceite

- O calendário exibe início e fim em vermelho Mercúrio, sem pintar todo o intervalo de vermelho sólido.
- O intervalo intermediário permanece legível, com fundo claro e sem texto azul.
- Hoje, datas externas e datas desabilitadas continuam distinguíveis.
- A seleção e o botão `Aplicar período` continuam funcionando no dashboard e no financeiro.
- `Reabrir com justificativa` abre um modal interno em vez de `window.prompt`.
- O modal permanece visível e utilizável no navegador e no renderer Electron.
- Motivos com menos de cinco caracteres não chamam a RPC.
- Confirmação válida chama `financeiro_reabrir_competencia` uma única vez com competência e motivo normalizado.
- Sucesso fecha o modal, atualiza dados e mostra feedback; erro mantém o modal aberto e apresenta mensagem.
- Nenhuma mudança de schema, RLS, autenticação, versão ou release.

## Segurança

- A reabertura continua autorizada e executada pela RPC Supabase existente.
- A justificativa não será persistida localmente nem enviada para logs do cliente.
- O botão ficará bloqueado durante o envio para evitar chamadas duplicadas.
- Nenhuma redução de `contextIsolation`, `sandbox` ou demais proteções do Electron.

## Testes automáticos

- teste do calendário para classes distintas de começo, meio e fim do intervalo;
- teste do modal: abrir, cancelar, validação mínima, confirmação, carregamento e erro;
- teste garantindo ausência de `window.prompt` no fluxo de reabertura;
- `npm run typecheck`;
- `npm run lint -- --quiet`;
- `npm test -- --run`;
- `npm run build`;
- `npm run build:desktop:web`.

## Testes manuais

- dashboard: abrir calendário, trocar início/fim, aplicar e conferir URL e métricas;
- financeiro: repetir o date range;
- fechamento: abrir reabertura, testar vazio, quatro caracteres, motivo válido, cancelar e erro de RPC;
- executar o renderer Electron local e confirmar que o modal aparece sobre `/admin/financeiro`;
- se o navegador integrado continuar indisponível, registrar a limitação e não declarar validação visual concluída.

## Fora de escopo

- refatorar os outros `window.prompt` já existentes em cancelamento de lançamento e exceção de comissão;
- alterar regras de fechamento ou auditoria;
- reconstruir/publicar instaladores `v0.1.6`;
- criar a próxima versão ou release GitHub.
