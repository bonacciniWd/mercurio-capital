# Publicação Vercel — Home, CPC e detalhe da proposta

Data: 21/10/2026. Status: publicado em produção; smoke pós-publicação concluído.

## Objetivo

Publicar a Home com os ajustes aprovados, incluindo as imagens locais e a seção de crédito para construção, a rota pública `/credito-para-construcao` e a interface de detalhe de proposta em `/admin/propostas/:id`.

## Escopo e dependências

- Base de publicação: snapshot local completo de `app/` congelado para esta release. A aplicação Vite é compilada como um único SPA; os componentes aprovados são parte deste bundle. Nenhum arquivo de `supabase/`, `mobile/` ou `desktop/` será enviado.
- Vercel: projeto `mercurio-digital`, Root Directory `app`; domínio atual `https://www.mercuriocapitalsa.com.br`.
- O checkout contém mudanças de outras áreas e a migration Serasa `20261021000001` ainda não aplicada remotamente. O artefato será congelado em Preview antes de promover. A produção já contém o fluxo visual de autorização Serasa; esta release não publica backend nem executa consultas, e o estado de compatibilidade desse fluxo permanece pendente da coordenação Serasa.
- O CPC usa a Edge Function `public-cpc-lead` já ativa (versão 1). A listagem remota registra as migrations até `20261020000002`; somente a migration Serasa local está pendente.
- Nenhum deploy de Supabase, migration, função, desktop ou mobile faz parte desta publicação.

## Arquivos/áreas selecionadas

- `app/src/pages/Landing.tsx` e `app/src/index.css` para as seções públicas aprovadas da Home.
- `LandingConstructionSection`, `CreditoParaConstrucao`, seus estilos, `CpcLeadForm`/cliente de captura e os assets locais usados por essas telas.
- `app/src/pages/admin/PropostaDetalhe.tsx` e `proposta-detalhe.css`, com somente dependências necessárias e consultas compatíveis com as funções já implantadas.
- `app/src/router.tsx`: rota CPC e configuração necessária ao escopo, sem outras rotas adicionadas localmente.

## Segurança e compatibilidade

- Manter tokens e variáveis de ambiente no ambiente Vercel; não copiar `.env` para a candidata.
- Nenhuma migration ou Edge Function será publicada. O frontend atual já inclui o fluxo visual Serasa que consta na produção; nenhuma consulta Serasa será feita no smoke.
- Não enviar formulários, criar propostas, alterar status real ou fazer consulta paga em smoke.
- Preservar a implantação atual como rollback; deploy anterior conhecido antes da promoção: `dpl_46AJUdEKHFePwT7Waz53acmE9FdN`.

## Critérios de aceite e verificações

1. `npm run lint`, `npm run typecheck`, teste de detalhe da proposta e `npm run build` em `app/`.
2. Vercel build de produção usando as variáveis da produção; criar deployment de produção sem domínio (`--skip-domain`) com o artefato congelado.
3. Smoke na URL isolada: Home, assets/imagem local, CTA e rota CPC, carregamento autenticado da tela de proposta quando a sessão existente permitir; sem mutações reais.
4. Promover exatamente o artefato aprovado e verificar domínio, status do deployment, rotas e assets após a publicação.
5. Se a candidata apresentar erro, manter o domínio no deploy atual. Se houver regressão após promoção, reverter para `dpl_46AJUdEKHFePwT7Waz53acmE9FdN`.

## Autorização

O usuário autorizou a publicação Vercel e selecionou explicitamente “Home + CPC + detalhe da proposta” em 21/10/2026. A autorização não inclui alterações backend ou a integração Serasa pendente.

## Ajuste no preflight Vercel

O CLI recusou o uso do build de produção como Preview por incompatibilidade entre os ambientes do artefato e do deployment. Nenhum deployment foi criado nessa tentativa. O preflight usará a URL de uma candidata Production com `--skip-domain`; após smoke e inspeção, o domínio será promovido para esse mesmo deployment.

## Candidata isolada e promoção concluída

- `vercel build --prod` concluiu com as variáveis configuradas no projeto; a compilação foi igual ao build local.
- Audit runtime do pacote web: 3 alertas (1 baixo, 2 moderados); nenhum High/Critical no escopo de dependências instaladas para execução. O audit completo do install reportou 11 High e 2 Critical em ferramentas/dependências fora do bundle; sem atualização nesta release.
- Manifesto do snapshot `app/src` + `app/public`: `1d960ceb28720de2fb2f213bd03ba98a160116071ba899dd7b07f47d2f7470a0`.
- Deployment candidato READY, sem domínio customizado: `dpl_95s2VfJevMPa2ngVaAt1EfrGgxGc`, `https://mercurio-digital-kcacor7kc-bonacciniwds-projects.vercel.app`.
- `vercel curl` autenticado por CLI confirmou `/` e `/credito-para-construcao` com HTTP 200; o bundle contém o título da nova seção e o código de detalhe da proposta; CSS do detalhe responde HTTP 200; `construcao-CAjS0DqY.jpg` responde HTTP 200, `image/jpeg`, 1.000.170 bytes.
- O deployment candidato estava protegido por SSO e não foi aberto em navegador. As interfaces foram verificadas no Chrome local durante implementação; uma tentativa de automação do Chrome em produção foi bloqueada pela permissão do macOS.
- Promoção executada com sucesso: `dpl_95s2VfJevMPa2ngVaAt1EfrGgxGc`. O domínio público passou a servir o HTML e os assets desse artefato.
- Smoke pós-publicação por HTTP: `/` e `/credito-para-construcao` retornaram `200`; Home serviu `index-D6vkL4We.js` e `index-Dor_SopA.css`; imagem `construcao-CAjS0DqY.jpg` retornou `200 image/jpeg` (1.000.170 bytes); CSS do detalhe `PropostaDetalhe-CUKoDFJq.css` retornou `200`; bundles publicados contêm as seções de construção e as áreas “Alterar status”, “Condições da proposta” e “Garantia”.
- Nenhum formulário foi enviado e nenhum dado real foi alterado. Backend, migrations e funções Supabase não foram publicados; a migration Serasa permanece pendente.
- Arquivo temporário `.vercel/.env.production.local` removido após o build.
