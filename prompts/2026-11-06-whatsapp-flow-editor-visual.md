# Plano — editor visual de fluxos WhatsApp

## Objetivo

Atualizar a experiência de `/admin/fluxos` para que a edição do fluxo possa ocupar a tela inteira, com canvas escuro, conexões vermelhas animadas e controles explícitos `btn-no-liquid`. Facilitar seleção, edição, conexão e remoção de nós, preservando o modelo e as ações existentes.

## Skills e documentos lidos

- `skills/UX_skills.md`: consistência com os padrões do projeto, acessibilidade por teclado, foco visível e respeito a `prefers-reduced-motion`.
- `docs/blueprint/07-integrations-flows.md`: contexto dos fluxos WhatsApp e suas etapas.
- `app/src/components/admin/whatsapp/FlowEditor.tsx`: implementação atual do editor, operações, estados, nodes, edges e formulário de edição.
- `app/src/components/rede/NetworkCanvas.tsx`: convenções locais para React Flow e botões `btn-no-liquid`.
- `app/src/index.css`: estilos globais de botões e proteção contra o estilo líquido.
- `app/package.json`: React, `@xyflow/react`, ícones e comandos de lint, typecheck, testes e build já disponíveis.

## Código inspecionado

- O editor atual mantém criação, seleção e edição de nodes, conexão de edges, simulação, salvamento, publicação interna e ações Meta.
- O canvas atual tem altura fixa de 480px e fundo claro; o editor e o inspetor ficam em fluxo vertical.
- A remoção atual existe no inspetor; a conexão usa os handles existentes.
- `@xyflow/react` e `lucide-react` já estão instalados. Os botões do editor já usam `btn-no-liquid`.

## Decisões e suposições

- O editor abrirá diretamente em tela cheia. O modo será reversível pelo botão de saída ou Escape, mantendo o contexto/rota administrativa e o rascunho.
- Nodes e edges continuam usando o formato atual persistido; nenhum campo ou RPC será alterado.
- A remoção rápida será oferecida por ação acessível no node e pelo inspetor, preservando o node de entrada. Remover um node também remove suas conexões.
- Novas conexões terão traço vermelho animado; animação será desativada quando o usuário tiver `prefers-reduced-motion`.
- O visual escuro ficará restrito ao editor/canvas, sem alterar tema global ou outras telas.
- Não haverá alteração em templates, envio, publicação externa, banco, Edge Functions ou credenciais.

## Arquivos esperados

- `app/src/components/admin/whatsapp/FlowEditor.tsx`
- `app/src/components/admin/whatsapp/FlowEditor.css` (novo, estilos escopados do editor)
- `prompts/2026-11-06-whatsapp-flow-editor-visual.md` (este plano)

## Requisitos e critérios de aceite

1. A ação “Tela cheia” expande o editor para a viewport e “Sair da tela cheia” retorna à página sem perder nodes, edges ou alterações pendentes.
2. Em tela cheia, a lista de fluxos, canvas e inspetor de edição ficam organizados para uso amplo; em viewport estreita, os painéis refluem sem ocultar controles.
3. Todo botão novo ou reorganizado usa `btn-no-liquid`.
4. O canvas usa fundo escuro, nodes legíveis nesse tema, handles visíveis e conexões vermelhas pulsantes.
5. Usuários conseguem selecionar e editar nodes, conectar handles e remover nodes sem procurar uma ação escondida; o node de entrada não pode ser removido.
6. Exclusão de node também remove edges incidentes e marca o rascunho como alterado.
7. Foco de teclado permanece visível; animação atende `prefers-reduced-motion`.
8. Simulação, validação, salvar rascunho, publicação interna e operações Meta continuam funcionando como antes.

## Considerações de segurança

- Nenhuma credencial ou dado privado será introduzido no cliente.
- Não haverá mudança de persistência, autorização, RLS, RPC ou integração externa.
- Publicar/enviar continua sujeito aos controles e confirmações já existentes.

## Testes

- Automáticos: `npm run lint`, `npm run typecheck`, `npm test -- --run` e `npm run build` no diretório `app`.
- Manuais: abrir/sair da tela cheia com rascunho alterado; editar campos; conectar dois nós; remover node e verificar remoção das conexões; confirmar proteção do node de entrada; testar zoom, enquadrar, viewport estreita e preferência de movimento reduzido; validar que simulação e salvamento continuam disponíveis.
