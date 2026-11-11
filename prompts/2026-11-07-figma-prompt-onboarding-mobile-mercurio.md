# Prompt para Figma Make — onboarding mobile Mercúrio Capital

Cole o texto abaixo no Figma Make. Use os arquivos de marca anexados ao projeto como referência visual; o briefing orienta a criação de telas e protótipo, não de código de produção.

---

Crie uma proposta visual de onboarding para o aplicativo mobile da **Mercúrio Capital**, em português brasileiro. A experiência deve apresentar a empresa e orientar os dois públicos que usam o app: **Parceiro/originador** e **Cliente**. O resultado será revisado antes de qualquer implementação; portanto, entregue telas editáveis no Figma e um protótipo navegável, sem gerar nem alterar código-fonte.

## Contexto do produto

A Mercúrio Capital conecta clientes interessados em crédito a parceiros que originam e acompanham operações. No app, o parceiro trabalha com propostas e acompanha etapas/documentos; o cliente acompanha a própria proposta e responde a solicitações de documentos. Os produtos do contexto incluem Home Equity, Crédito para Construção e Financiamento Imobiliário. Apresente isso de forma institucional, sem transformar o onboarding em uma oferta comercial ou simulador.

O app atende somente as jornadas de Cliente e Parceiro. Membros de equipe convidados por um parceiro seguem a jornada de Parceiro, com os limites de acesso definidos pela conta. Não criar uma jornada de Administrador, painel Admin, atalhos de demonstração nem controles que sugiram acesso sem autenticação.

## Regras de conteúdo e confiança

- Não prometa aprovação, limite de crédito, taxa, prazo de liberação, resultado de análise ou contratação.
- Prefira expressões como “acompanhe sua proposta”, “organize documentos” e “conheça as etapas da operação”.
- A conta de Cliente é ativada por convite/link seguro associado a uma proposta existente; não apresente cadastro livre de cliente.
- O cadastro de Parceiro pode depender de análise/aprovação. Não sugira que o envio do cadastro libera imediatamente as áreas operacionais.
- Não apresente Serasa, score, análises automatizadas, IA/assistente MERX, WhatsApp ou recursos futuros como disponíveis no app.
- Não invente suporte 24 horas, garantias, números de clientes, resultados ou certificações.
- O onboarding é informativo. A seleção de “Cliente” ou “Parceiro” serve para mostrar conteúdo relevante e orientar a entrada; não altera permissões nem autentica o usuário.

## Direção visual

Crie uma interface mobile premium, simples e confiável, coerente com a identidade já presente no app Mercúrio Capital. Use os assets anexados, priorizando `logowide.png`, `logo-square.png` e `logo-dark.png`; preserve a proporção e não redesenhe a marca. A paleta atual do app usa preto/grafite, branco e vermelho Mercúrio (`#DC2626`), com cinzas neutros. Use o vermelho como acento, sem preencher grandes áreas com cor saturada. Não introduza azul/dourado como identidade principal.

Use tipografia sem serifa, hierarquia evidente, bastante respiro, cartões discretos, ícones consistentes e ilustrações abstratas/editoriais relacionadas a jornada financeira, documentos e acompanhamento. Evite imagens genéricas de banco de imagens, moedas voando, gráficos de crescimento que impliquem retorno e visual de fintech promocional. A marca deve parecer sólida, humana e profissional.

Projete primeiro para iPhone em viewport de **393 × 852 px**, com safe areas e teclado considerados; em seguida, demonstre adaptação para Android e telas menores. Garanta contraste acessível, áreas de toque confortáveis, textos legíveis e indicadores de progresso claros. Inclua estados de movimento reduzido sem depender de animação para comunicar informação.

## Telas e fluxo a prototipar

Crie uma experiência breve, com opção visível de pular e voltar, que conduza à entrada/autenticação existente. Apresente uma proposta principal e, se necessário, uma variante visual. Inclua:

1. **Boas-vindas à Mercúrio Capital** — marca, explicação curta e objetiva do workspace e CTA para começar. Não invente slogan; proponha uma frase institucional baseada no contexto acima.
2. **Escolha do contexto** — dois cartões claramente distintos: “Sou parceiro ou faço parte de uma equipe” e “Sou cliente”. Deixe explícito que isso personaliza a apresentação e não é uma seleção de acesso/permissão.
3. **Jornada do Parceiro** — explique em linguagem simples que o parceiro pode organizar/cadastrar propostas conforme seu acesso, acompanhar etapas e tratar documentos e pendências. Mostre uma representação visual conceitual do acompanhamento, sem dados fictícios que pareçam reais e sem sugerir acesso operacional antes da aprovação.
4. **Jornada do Cliente** — explique que o cliente acompanha uma proposta vinculada ao seu cadastro e pode enviar documentos quando solicitados. Informe de forma acolhedora que o acesso é ativado por link seguro enviado pela Mercúrio/parceiro; não ofereça “criar conta de cliente” livre.
5. **Próximo passo / entrada** — tela final com CTA principal para entrar/ativar acesso e ação secundária para voltar. Use rótulos neutros que possam ser conectados ao fluxo de autenticação real depois da revisão; não desenhe login social ou autenticação fictícia.

No protótipo, demonstre os dois caminhos (Parceiro e Cliente), avanço/retorno, pular onboarding e chegada à tela de entrada. Não crie telas Admin nem navegação interna completa do app. As tabs funcionais internas de Parceiro não fazem parte deste onboarding e não devem ser redesenhadas.

## Entrega no Figma

- Organize as telas em uma página chamada **Onboarding mobile — Mercúrio Capital**.
- Inclua uma visão geral do fluxo, os dois caminhos por público e os frames em ordem.
- Entregue componentes reutilizáveis para botões, cartões de público, progresso, cabeçalho e ações secundárias.
- Inclua estados de foco/pressionado/desabilitado para CTAs e indique onde entram logo e ilustrações.
- Crie ligações de protótipo que permitam testar o caminho de Parceiro e o de Cliente.
- Adicione notas breves para decisões de conteúdo que dependam da autenticação real, sem presumir destinos de rota.
- Priorize fidelidade visual mobile e clareza do conteúdo; mantenha a experiência curta, sem transformar cada recurso do produto em um slide.

Antes de concluir, confira se nenhum texto promete aprovação ou condições financeiras, se o Cliente não recebe uma opção de cadastro livre e se nenhuma tela sugere permissões Admin.

---

## Referências de produto consultadas

- `prompts/2026-11-07-mobile-onboarding-login-sem-admin.md`
- `mobile/tailwind.config.js` e `mobile/assets/logos/`
- `docs/blueprint/02-roles-permissions.md`
- `docs/blueprint/03-routes-navigation.md`
- `docs/blueprint/06-modules-features.md`
- `docs/operacao/merx-publica-atendimento.md`
- `docs/operacao/simulador-publico.md`
