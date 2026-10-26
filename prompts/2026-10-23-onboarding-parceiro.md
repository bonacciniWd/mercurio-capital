# Onboarding do parceiro — proposta para aprovação

## Objetivo
Corrigir o tour do dashboard /p e orientar a primeira proposta com conteúdo baseado no fluxo existente. Screenshots recebidos mostram o problema atual, não um novo layout aprovado.

## Documentação e código inspecionados
- AGENTS.md fornecido na conversa; skills/UX_skills.md (revisão full do onboarding).
- docs/operacao/2026-10-21-auditoria-serasa-merx.md e telas de detalhe de proposta admin/partner para distinguir o classificador atual da MERX futura.
- docs/README.md; blueprint de permissões e rotas; handoff 17 do wizard; trechos do módulo de funcionalidades sobre milestones.
- PartnerOnboardingTour.tsx; integração no Dashboard.tsx; rotas partner; PartnerLayout; etapas e envio do Wizard.tsx; package.json e configuração Tailwind.
- A documentação inteira do repositório ainda não foi revisada; antes da implementação, completar a leitura dos módulos pertinentes e conferir divergências entre documentação e implementação.

## Diagnóstico
- PartnerOnboardingTour.tsx: container do dialog com overflow-hidden sem limite de altura/rolagem; screenshot 2 mostra conteúdo e ações fora da viewport.
- Cabeçalho usa h-76, que precisa ser conferido no CSS gerado do Tailwind 3. Imagens promocionais verticais ocupam a área de instrução.
- Componente declara aria-modal, mas não implementa captura/restauração de foco, Escape ou bloqueio do fundo.
- finish() marca conclusão ao fechar, pular ou seguir um atalho. Chave local global não distingue usuários; não há retomada explícita.
- Texto mistura incentivo comercial, comissões e prêmios; afirma taxa e prazo sem apresentar a regra efetiva. Validar cobrança na RPC antes de escrever orientação financeira.

## Proposta de conteúdo e apresentação
1. Boas-vindas: o que preparar para iniciar e como funciona o guia.
2. Simulação: orientar condições e garantia, explicar que simulação não representa aprovação; link para Simulações.
3. Cadastro: explicar as etapas reais Produto, Cliente/proponentes, Imóveis, Condições e Revisão (confirmar nomes exatos no wizard).
4. Documentos e acompanhamento: orientar uso dos detalhes da proposta, documentos, pendências, protocolo e histórico conforme funcionalidades reais.
5. Carteira, comissões e capacitação: distinguir custos configurados, comissões e campanhas; atalhos existentes e criação da primeira proposta.

### MERX e limite de acesso
O guia terá uma etapa curta “Como a MERX ajudará” que explica a direção do produto: organizar informações da proposta, apontar pendências e acelerar a análise, sempre com revisão humana. O texto identificará o assistente por proposta/chat individual como **futuro**, sem botão que simule disponibilidade. A auditoria atual registra classificação SQL determinística e ausência de IA MERX integrada; por isso o onboarding não atribuirá decisões automatizadas à plataforma atual.

O futuro chat exigirá desenho e aprovação próprios de modelo de dados e acesso: conversas ligadas a `auth.uid()` e `proposta_id`, autorização server-side derivada da relação do usuário com a proposta/parceiro (nunca `partner_id` fornecido pelo navegador), RLS que impeça leitura entre parceiros, e testes de isolamento com dois parceiros e membro de equipe. Consultas, tokens e contexto de IA permanecerão no servidor. Nenhum schema ou endpoint de chat integra este ajuste visual.

Proposta visual para aprovação: modal compacto com título/progresso e navegação estáveis; conteúdo instrutivo com checklist e ícones existentes. Retirar banners promocionais do tour; manter identidade e componentes do sistema. Desktop com índice de etapas e conteúdo; mobile em uma coluna, altura limitada à viewport e rolagem interna. Botões protegidos dos estilos liquid globais.

## Modelo e segurança
Sem novas tabelas, APIs, bibliotecas ou permissões. Progresso local versionado por usuário, somente etapa e estado (adiado/concluído), sem dados pessoais. Fechar permite retomar; concluir exige ação explícita. Oferecer “Rever guia” no dashboard. Falha do armazenamento não bloqueia o painel. A chave v1 era global para todo o navegador; o novo guia v2 aparece uma vez por usuário para não herdar a conclusão de outra conta.
Links respeitam permissões existentes de partner/team_member. Nenhuma ação de onboarding cria proposta, debita carteira ou dispara consulta automaticamente.

## Arquivos esperados
PartnerOnboardingTour.tsx, Dashboard.tsx, módulo de conteúdo/estado se necessário e teste focado; reutilizar Tailwind e primitives existentes. Documentação operacional do guia.

## Aceite e testes
- Conteúdo fiel às rotas e validações reais; sem promessas de prazo, aprovação, comissão ou taxa não verificadas.
- Ações acessíveis em 1440x900, 1280x720, 390x844 e 320px, e zoom 200%.
- Teclado completo, Escape, foco restaurado, fundo bloqueado, movimento reduzido.
- Avançar/voltar, adiar, retomar, concluir, reabrir, troca de conta e storage indisponível.
- Lint, typecheck, build e testes focados; navegador com captura desktop/mobile. Relatar limitações de acesso autenticado.

## Execução local após aprovação
O usuário aprovou a estrutura e a direção MERX. O tour foi refeito em `PartnerOnboardingTour.tsx`, integrado às ações do Dashboard e coberto por teste de pausa, retomada e conclusão. O conteúdo segue as cinco etapas do wizard e as rotas existentes. O chat MERX permanece futuro, sem controle que sugira disponibilidade atual.

Verificações: `npm run typecheck` passou; `npm run lint` passou com 38 avisos preexistentes e nenhum erro; `npm run build` passou com aviso de chunks grandes; teste focado passou 1/1; `git diff --check` passou. Navegador autenticado e captura visual desktop/mobile não foram executados nesta sessão. Deploy não incluído.
