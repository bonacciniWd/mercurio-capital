# Plano — onboarding mobile a partir da referência React/Figma

## Objetivo

Reproduzir no app Expo/React Native o visual fornecido para boas-vindas, escolha de público, jornadas de Parceiro e Cliente, revisão e conclusão. Usar os logos locais da Mercúrio. Na jornada Cliente, distinguir PF (CPF) e PJ (CNPJ) e vincular as informações a uma proposta já existente, conforme confirmação do dono do produto nesta conversa. Proteger a reabertura do app quando houver sessão local em cache com a autenticação do próprio aparelho.

## Fontes lidas

- Instruções `AGENTS.md` fornecidas pelo usuário na conversa; `skills/UX_skills.md`.
- Referência TSX em `/Users/macbook/.codex/attachments/3c209d00-5ba0-4a76-b921-546fe17a94e0/Texto colado.txt` e CSS em `/Users/macbook/.codex/attachments/20a2e096-9ff4-4048-96d6-975957f610da/Texto colado.txt`; imagens fornecidas no chat.
- `mobile/README.md`, `docs/blueprint/02-roles-permissions.md`, `docs/blueprint/06-modules-features.md`, `prompts/2026-11-07-mobile-onboarding-login-sem-admin.md` e `prompts/2026-11-07-figma-prompt-onboarding-mobile-mercurio.md`.
- Documentação oficial do Expo SDK 58: `expo-local-authentication`, `expo-secure-store` e guia de autenticação. Face ID não funciona no Expo Go iOS; requer development build/instalação nativa. `expo-secure-store` com `requireAuthentication` também tem limitação no Expo Go quando há biometria.

## Código inspecionado

- `mobile/app/index.tsx`, `login.tsx`, `cadastro.tsx`, `magic/[token].tsx`, `convite/[token].tsx`, `_layout.tsx`, `mobile/lib/auth.tsx`, `mobile/lib/supabase.ts`, `mobile/tailwind.config.js`, `mobile/app.json`, `mobile/assets/logos/`.
- `mobile/lib/securityConfig.ts`, `mobile/package.json` e `mobile/eas.json`: hoje Supabase persiste sessão em `AsyncStorage`; o `Fingerprint` do login não autentica; há logout por inatividade no `AuthProvider`, sem bloqueio local de reabertura.
- Fluxo web real em `app/src/pages/public/ClienteProposta.tsx` e `Registro.tsx`; `supabase/functions/magic-link-consume/index.ts`; RPCs `cliente_peek_proposta`, `cliente_consume_magic`, `partner_self_register`; tabelas `clientes`, `propostas`, `partners`, `proponentes`, `proposta_consulta_aceites`.

## Decisões e suposições

1. A referência define o visual, a ordem e o texto base. O JSX/CSS web é somente referência: UI será traduzida para componentes React Native, NativeWind e bibliotecas já instaladas, sem WebView. O bloqueio local requer apenas dois módulos oficiais do Expo SDK 58, `expo-local-authentication` e `expo-secure-store`, a instalar com `npx expo install` para compatibilidade de versão; nenhuma framework nova.
2. Logo oficial local substitui o placeholder “M”; acolhimento usa `logowide.png`, etapas usam `logo-square.png`/variante adequada após conferência visual. Fundo preto/grafite, branco e vermelho `#DC2626`, conforme o app e a referência. Botões usam estilo sem efeito líquido.
3. Escolha “Parceiro/Cliente” personaliza o onboarding; servidor continua decidindo role, sessão e permissões. `team_member` segue jornada de parceiro. Admin não recebe rota operacional mobile.
4. A referência simula convite válido quando ambos os campos têm texto. Na implementação, só um token de convite real, válido e não expirado pode liberar a jornada de Cliente. O link existente é token opaco (`/magic/:token`); não aceitar protocolo da proposta ou e-mail como credencial. O campo “código do convite” da arte vira entrada segura para token/link real ou é pré-preenchido pelo deep link. “Convite reconhecido” aparece apenas depois de resposta positiva do servidor.
5. A ativação e autenticação do Cliente passam pelo fluxo real `magic-link-consume`/Supabase Auth. A coleta e o envio de dados PF/PJ ocorrem somente depois de sessão Cliente válida; não enviar dados pessoais antes de vincular a conta à proposta. Aceite de consulta Serasa é separado do aceite de termos/privacidade, opcional e nunca implícito.
6. O Parceiro usa cadastro real equivalente ao web (`signUp` + `partner_self_register`) e permanece `pending` até aprovação. O botão de conclusão só confirma envio se a operação real tiver sucesso.
7. O modelo Cliente PF exibe nome completo, CPF, e-mail e telefone; o PJ exibe razão social, CNPJ, e-mail e telefone do responsável, além de segmento, cidade/UF e faixa de faturamento compatível. A seleção PF/PJ deriva da proposta vinculada, não é uma troca livre do tipo de cliente.
8. E-mail associado à conta e CPF/CNPJ já registrados não serão sobrescritos pelo formulário sem verificação/revisão. Se o cliente informar divergência, a resposta fica registrada para análise, sem alterar a identidade usada por propostas ou consultas existentes.
9. As opções de objetivo e atuação da referência são dados de contexto, não alteram produto, valor, status ou aprovação da proposta.
10. A sessão recém-criada por login, magic link ou convite não pede autenticação local novamente no mesmo instante. Na próxima abertura com sessão persistida, o app cobre qualquer conteúdo protegido até o aparelho ser desbloqueado. Ao retornar do segundo plano após o intervalo configurado em `configuracoes_sistema.mobile_relock_segundos` (padrão proposto: 60 segundos), volta a bloquear; logout por inatividade já existente continua encerrando a sessão no limite próprio. A biometria/código do aparelho não cria sessão Supabase nem substitui senha, magic link, MFA ou autorização do servidor.
11. O prompt usa o mecanismo do sistema operacional (Face ID/Touch ID/biometria Android e fallback de credencial do dispositivo quando disponível). Cancelamento, falha, biometria ausente ou bloqueio deixam o app na tela de desbloqueio, com opção de tentar de novo ou sair/entrar novamente. Não haverá PIN próprio nem armazenamento de senha para desbloqueio.
12. Dados de sessão persistidos passam do `AsyncStorage` para `expo-secure-store` por um adaptador compatível com Supabase Auth. Uma migração local de sessões antigas precisa tratar ausência/falha de leitura sem expor tokens, sem registrar valores em logs e sem diminuir a segurança silenciosamente. O gate visual não deve disparar múltiplos prompts por refresh de token ou mudança de rota.
13. Se o cadastro de Parceiro exigir confirmação de e-mail, guardar temporariamente apenas os dados complementares necessários em `expo-secure-store`, sem senha. O rascunho expira logicamente após sete dias e é apagado no próximo acesso; o armazenamento do aparelho não oferece expiração em segundo plano garantida. Após autenticação com o mesmo e-mail, concluir as RPCs autenticadas e apagar o rascunho. Enquanto isso, mostrar “confirme seu e-mail”, sem afirmar que o cadastro foi enviado para análise.

## Modelo de dados aprovado e extensão de configuração local

**Registros existentes:** `propostas.id` identifica a operação e referencia `clientes.id` por `cliente_id`; `clientes.usuario_id` vincula a conta autenticada; `clientes.pessoa_tipo` define PF/PJ. `partners.usuario_id` identifica a conta do parceiro. `proponentes` e dados usados em consultas permanecem intactos até uma revisão explícita.

**Nova tabela `proposta_onboarding_respostas` (1 linha por proposta e cliente):** `proposta_id` e `cliente_id` como chaves vinculadas; `usuario_id` do cliente que enviou; `pessoa_tipo`; `nome_informado`, `documento_informado`, `email_informado`, `telefone_informado`; `nome_fantasia`, `ramo_atuacao`, `cidade`, `uf`, `faixa_faturamento` somente PJ; `objetivo`; `avisos_versao`, `privacidade_versao`, `aceito_em`; `enviado_em`, `atualizado_em`, `status_revisao`. Obrigatórios: chaves de vínculo, tipo, nome, documento válido do tipo, contato, objetivo e aceite dos avisos e da política de privacidade. `status_revisao` diferencia dados coincidentes de divergências que exigem ação administrativa. O objetivo e os dados adicionais ficam associados à proposta, sem alterar automaticamente seus campos operacionais. Não registrar aceite de Termos de Uso inexistentes: o app só tem Política de Privacidade publicada; incluir Termos em uma entrega posterior com texto aprovado pelo dono do produto.

**Nova tabela `partner_onboarding_respostas` (1 linha por parceiro):** `partner_id` e `usuario_id`; organização informada, cidade/UF, áreas de atuação, declaração de correção, versão do texto e horário de envio. O registro complementa o cadastro real de parceiro, não substitui `partners.status` nem documentos exigidos.

**Escrita:** RPCs autenticadas, restritas ao dono real da proposta/parceiro, validam vínculo `propostas.cliente_id -> clientes.usuario_id = auth.uid()` ou `partners.usuario_id = auth.uid()`. RLS permite leitura do próprio registro e da equipe Admin autorizada; cliente/parceiro não listam dados alheios. `usuario_id` é preenchido no envio e pode ficar nulo apenas após exclusão posterior da conta, sem bloquear a limpeza de Auth. Auditoria de envio sem armazenar token de convite, senha ou payload de sessão. A migration será local e revisada em dry-run antes de aplicação remota.

**Configuração de bloqueio:** adicionar a chave `mobile_relock_segundos` à tabela existente `configuracoes_sistema`, com valor inicial 60 e leitura pelo app via `mobile/lib/securityConfig.ts`. A chave controla apenas o tempo de tolerância no segundo plano; abertura a frio com sessão cacheada sempre requer desbloqueio. Expor a chave na configuração Admin existente, sem rota adicional. Se estiver indisponível/offline, usar 60 segundos.

## Arquivos esperados

- Telas/componentes em `mobile/app/` e `mobile/components/` para boas-vindas, seleção, etapas, formulário PF/PJ, revisão, estados de validação/erro e conclusão.
- `mobile/app/index.tsx`, `login.tsx`, `magic/[token].tsx`, `_layout.tsx`, `cadastro.tsx` e guards de sessão/role necessários.
- `mobile/lib/` para tipos, validação de CPF/CNPJ/e-mail/telefone, vínculo seguro e envio autenticado.
- `mobile/lib/supabase.ts`, `mobile/lib/auth.tsx`, componente de bloqueio de sessão e `mobile/app.json` (mensagem de uso do Face ID); `mobile/package.json`/lockfile para os dois módulos oficiais do Expo.
- Configuração Admin existente em `app/src/pages/admin/Configuracoes.tsx` para editar `mobile_relock_segundos` e migration local para semear a chave; sem alterar papéis/RLS.
- Migration SQL nova em `supabase/migrations/` com tabelas, índices, RLS e RPCs; smoke tests SQL focados.
- `mobile/README.md` e plano base do onboarding para refletir as rotas e regras finais.

## Critérios de aceite

- Telas reproduzem as referências em iPhone e se ajustam a Android, telas menores, teclado aberto e texto ampliado; rolagem mantém CTA alcançável. Acessibilidade de botões, campos, seleção e erros; animação reduzida respeitada.
- Login existente continua real; `Já tenho acesso` abre login. Nenhum atalho mock abre áreas protegidas. Sessão ativa vai à área permitida sem repetir o onboarding.
- Convite inválido, expirado ou usado não avança. Convite válido não é consumido duas vezes. Deep link preserva token e chega ao fluxo correto.
- PF nunca vê campos exclusivos PJ; PJ não é tratado como CPF. CPF/CNPJ têm validação real. Identidade divergente fica pendente de revisão.
- Envio do Cliente fica vinculado somente à proposta correspondente; Parceiro só grava o próprio cadastro; status da proposta e permissões não são alterados.
- Leitura da política de privacidade e concordância com os avisos do onboarding têm versão, horário e ação explícita; Serasa não é autorizado por esses checkboxes genéricos. Termos de Uso serão oferecidos quando houver documento publicado e aprovado.
- Administradores não acessam telas Admin no app mobile; web e backend Admin permanecem fora do escopo.
- Sessão já persistida mostra bloqueio antes de dados do Cliente/Parceiro; desbloqueio do aparelho libera somente a visualização daquela sessão válida. Ao cancelar/falhar, não aparece nenhum dado protegido. Login novo não pede uma segunda autenticação local imediata. Sem sessão, o app mostra onboarding/login normalmente.
- A sessão persistida é armazenada com proteção do SO. Dispositivo sem mecanismo de desbloqueio configurado não contorna o bloqueio: oferece login normal. Logout invalida a sessão e limpa o estado de desbloqueio local.

## Verificações

- `cd mobile && npm run typecheck`; lint do projeto se houver script/configuração aplicável; `npx expo config --type public`; bundle/build quando a mudança de rota exigir; `git diff --check`.
- Testes de validação PF/PJ, roteamento por papel, token inválido/válido, falha de rede, duplicidade de envio e RLS para outro cliente/parceiro.
- Testes de sessão: instalação com cache antigo, abertura com cache protegido, retorno do segundo plano, cancelamento/falha do prompt, aparelho sem biometria, fallback para credencial do aparelho, sessão expirada, logout, retorno por deep link e ausência de flash de dados protegidos.
- Teste manual em iPhone/Android: fluxo completo, voltar/editar, teclado, campos vazios e inválidos, sucesso real, reabertura com sessão, texto ampliado. Face ID iOS deve ser validado em development build/TestFlight, não apenas no Expo Go. Não declarar smoke físico sem executá-lo.

## Limites de publicação

Não aplicar migration remota, Edge Functions ou publicar app sem revisão separada do SQL e do impacto da distribuição mobile. Este plano cobre a implementação local e a validação disponível.
