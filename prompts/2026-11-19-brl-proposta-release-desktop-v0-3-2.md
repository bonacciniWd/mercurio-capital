# Plano — valor solicitado em BRL e release desktop v0.3.2

## Objetivo
Formatar o valor solicitado na edição da proposta em BRL e preparar uma nova release consistente para macOS Intel/ARM, Windows x64 e Linux x64, com artefatos realmente recompilados. Sem GitHub Actions. v0.3.1 publicada é a referência de comportamento do updater, ainda que o branch declare0.3.0.

## Documentos e skills lidos
AGENTS.md; docs/README.md; docs/operacao/change-management.md e release-checklist.md; docs/operacao/desktop-release-macos-signing.md; planos2026-11-06-hotfix-updater-runtime-v0-3-1 e release-web-desktop-v0-3-0; plano de release manual2026-09-03; auditoria de propostas19/11. Memória de governança consultada apenas como orientação; estado de releases/configuração conferido ao vivo. Nenhuma skill especializada aplicável: React/TypeScript e ferramentas existentes do Electron.

## Inspeção e divergências encontradas
- app/src/pages/admin/PropostaDetalhe.tsx: campo solicitado type=number, estado como string em reais; payload enviado à RPC admin_proposta_update_campos. Campo imóvel já usa formatReais/parseReaisInput.
- app/src/components/MoneyInput.tsx: máscara BRL existente, com conversão de dígitos/100; testes existentes currencyFormatting.test.ts. Reutilizar padrão, sem alterar parser global por iniciativa própria.
- app/package.json e lock, marcadores de docs e landing atualmente0.3.0; tag/publicação estável real0.3.1. A release0.3.1 tem macOS0.3.1 e instaladores Windows/Linux0.2.2.
- A tag0.3.1 contém app/scripts/validate-desktop-runtime.mjs e execução pós-pack; branch atual não contém o validador. Recuperar proteção antes de empacotar para não repetir Cannot find module fs-extra.
- app/electron-builder.json, desktop/electron/{main,preload,updater}.cjs, workflow desktop (somente leitura), Download.tsx e validador de consistência inspecionados. Runtime desktop/config builder sem diferenças contra tag0.3.1; package/lock divergem por outras atualizações de dependência e precisam de auditoria atual.
- Mac localIntel; Developer ID Application do Team29U8L34KC9 disponível; Wine e Docker disponíveis. Disponibilidade de ferramentas não comprova build final nem instalação Windows/Linux.
- CI e Desktop Release estão disabled_manually. Manter assim.

## Decisões e suposições
- Próxima patch: **0.3.2**. Não sobrescrever assets0.3.1 nem publicar novamente a mesma versão.
- Edição Admin é o ponto identificado. Substituir input numérico pelo padrão MoneyInput, label associado, preservando permissões/ações. Estado/payload persistem valor em **reais numéricos**, sem R$, pontos de milhar ou vírgula; exibir150000 comoR$150.000,00 e salvar150000, nunca15000000.
- Digitação/colagem seguem a semântica centesimal do componente existente; verificar explicitamente colagem de BRL formatado, centavos, apagamento, zero e reabertura. Não adicionar regra de teto/LTV nem corrigir dados históricos neste lote. Máscara não garante a validade econômica de um valor.
- Preservar appId desktop br.com.mercuriocapital.desktop, canal stable e compatibilidade de atualização da0.3.1; bundleID mobile é outro produto e não será alterado.
- Todos os novos artefatos serão0.3.2. MacARM/Intel DMG+ZIP; Windowsx64 NSIS; Linuxx64 AppImage+DEB. Não copiar executáveis0.2.2 para simular cobertura nova.
- Windows segue o histórico de distribuição sem Authenticode, pois não há certificado configurado; não apresentar como assinado. Falha de empacotamento impede declarar essa plataforma pronta. macOS exige assinatura/notarização/staple reais.
- Usar worktree/snapshot isolado e allowlist; preservar arquivos sujos de outras frentes. Candidato inclui versão commitada da web atual e este ajusteBRL; alterações locais de Dashboard/Protocolo/mobile e backend não entram silenciosamente.

## Implementação e arquivos esperados
1. Ajustar campo solicitado e acrescentar teste de integração do valor exibido/salvo. Arquivos: PropostaDetalhe.tsx e teste pertinente; MoneyInput só se necessidade confirmada dentro do padrão, sem regressão de consumidores.
2. Recuperar da tag0.3.1 o validador de runtime e adaptar, se necessário, a cobertura para ASARs macOS/Windows/Linux; verificar cadeia completa electron-updater/fs-extra, entrypoints e versão antes de release.
3. Bump coerente em app/package.json, lock, marcador da landing e docs/operacao/{change-management,release-checklist}. Não alterar mobile ou seus manifests.
4. Preparar scripts/configuração de build local apenas quando necessário, usando ferramentas existentes. Sem dependência nova/framework sem aprovação específica.
5. Gerar builds com publish never, assinar/notarizar Mac com identidade e perfilmercurio-notary existentes. Não imprimir credenciais. Linux pelo Docker local e Windows por Wine conforme compatibilidade real; se faltar ambiente, registrar bloqueio e não publicar matriz incompleta.
6. Validar artefatos; preparar notas, checksums, feeds e checklist para revisão final.

## Modelo de dados e segurança
Sem mudança de schema/RLS/RPC, sem migration e sem backfill. Nenhuma correção da auditoria financeira além da máscara solicitada. Não incluir arquivos .env, credenciais, dados reais de clientes, .local-secrets ou estado de sessão no pacote/repositório. Manter CSP/preload/contextIsolation atuais. Auditar dependências atuais; Critical/High exige triagem concreta e resolução/revisão antes de GO, sem force/legacy-peer-deps para mascarar problemas.

## Critérios e testes
- InputBRL permite editar/salvar/reabrirR$150.000,00 como150000reais, inclusive com centavos. Valor enviado à RPC é conferido em teste isolado; sem gravar proposta real como teste.
- Lint, typecheck, testes web e build; separar falhas externas já observadas na auditoria. validate:release para0.3.2 e tag candidata. Build desktop renderer com env pública de produção correta e sem secrets; sem fallbacklocalhost.
- Revisão Revisor Mercurio Capital read-only; Critical/High bloqueiam release.
- ASAR de cada plataforma possui runtime/updater e versão correta; executável/arquitetura compatíveis. Abrir apps Mac quando compatível e verificar processo principal; inspeção de binário não substitui instalação realWindows/Linux ou execuçãoARM sem dispositivo.
- Mac: codesign deep/strict, notarização aceita, staple app/DMG e spctl; regenerar metadata/hashes/blockmaps após alterações que mudem bytes.
- Feeds stable-mac.yml, stable.yml, stable-linux.yml com versão, tamanho, SHA512 e nomes conferidos; SHA256 geral. Verificar download público e ausência de links antigos na matriz0.3.2.
- /download deve encontrar MacARM/Intel, WindowsNSIS, LinuxAppImage/DEB na release mais recente. Verificar atualização de Mac0.3.1→0.3.2 com aparelho autorizado; não declarar instalaçãoWindows/Linux sem executá-la.

## Impacto e publicação
Web e desktop afetados; mobile, banco e integrações não afetados. Build e publicação de Electron são independentes deExpo/AppStore. Não acionar Actions, criar servidor/staging ou alterar projetoSupabase.

Aprovação deste plano libera implementação e geração/validação **local** dos artefatos. Após checks/revisão e checklist concreto, solicitar GO separado para commit/push, tag/releaseGitHub0.3.2 e deployVercel do frontend. Publicar a release como latest somente com toda a matriz validada e feeds coerentes. Não liberar auto-update antes de concluir gates e conferência de assets.

## Rollback
Preservar release0.3.1 e seus assets. Não apagar tags/instaladores anteriores. Se houver falha antes doGO, não publicar. Após publicação, retirar candidata do canal latest conforme decisão de incidente e oferecer reinstalação anterior; updater normalmente não faz downgrade automático. Reverter apenas o diff de UI/versão em novo commit se necessário; nenhum dado de usuário será limpo. Guardar deploymentVercel anterior antes da promoção.

## Aprovação
Plano e candidata0.3.2 aprovados explicitamente pelo dono; implementação/builds locais autorizados. Pedido original já define todas as plataformas; a aprovação final de publicação ocorrerá com resultados revisáveis, conforme AGENTS.md seção12.


## Execução local em andamento —19/11
- Campo Admin reutiliza MoneyInput; estado/payload conserva string numérica em reais. Teste integra edição formatada e RPC150000.99;7/7 testes direcionados e navegador isolado aprovados.
- Validador recuperado da tag0.3.1, com alvos explícitos mac-x64/mac-arm64/win-x64/linux-x64, versão, renderer,main/preload/updater e árvore completa do updater. Scripts validam artefatos após pack,publish never.
- Candidata isolada `/tmp/mercurio-v032-candidate`, baseada059dc60 com allowlist. Build rendererdesktop aprovado; versão0.3.2 coerente. Corrigido tipo de opção em teste antes de typecheck final.
- npmci limpo aprovado. Env de produção obtida para build, copiadas exclusivamente variáveisVITE públicas. SupabaseURL/anon conferidos para projetoMercurio, origem pública canônica.com.br; nenhumplaceholder sensível no renderer. Arquivo completo temporário de env removido depois da seleção; nenhumsecret copiado ao candidato.
- Notary profilemercurio-notary respondeu com sucesso; assinaturaDeveloperID29U8L34KC9 disponível. Isso não substitui notarização dos novos apps.
- Linux inicialmente instalado em builder22; runtimeFirebaseAuth exigeNode24 e build final usará builder24 (Node24.22.1), sem alterar lock/dependências.
- Lint0erros/32warnings; typecheck final e validate:release aprovados. Suíte geral355/356, falha textual pré-existente em clientePropostaAceiteConsultas; não declarar suíte integralmente verde.
- Revisão fonte RevisorMercurio: Approved with reservations, nenhumCritical/High no diff. QuatroalertasHigh deFirestore/gRPC: nenhum servidorgrpc/importNode desse módulo no main/preload/updater e renderer sóapp/messaging; pacote final ainda precisa de inspeção. Não removidos os alertas nem aplicado npm auditfix/downgrade.

## Evidência parcial e bloqueio de sistema
WindowsNSISx64 e LinuxAppImage/DEBx64 gerados0.3.2. ASARs MacIntel/Win/Linux verificaram16pacotes updater; renderer idêntico e sem.env/credenciais locais. Windows comprovadamente semAuthenticode; Linuxdpkg metadataamd64/0.3.2. Roteiros finais preparados, não publicados.
Apple emitiu ticket do MacIntel e spctl reconheceNotarized Developer ID, porém staple falhou73: Operation not permitted ao escreverContents/CodeResources. Permissão deGerenciamento deApps paraVisualStudioCode solicitada ao dono via pergunta assíncrona. Não removidosACL/provenance nem desativadoGatekeeper. MacARM ainda não construído, pois builder interrompeuIntel. SmokePlaywrightElectronfalhou ao iniciar, não considerado aprovado. Detalhes em docs/operacao/releases/v0.3.2-validacao.md. Aguardando ação do dono para finalizar Mac e a matriz local antes doGO de publicação.

## Aditivo para aprovação — impedir downgrade do updater
O smoke nativo Intel abriu a 0.3.2 e renderizou login sem exceção JS, mas exibiu download da 0.3.1. Fonte confirmada: configureAutoUpdater define allowDowngrade=false antes de channel; o setter channel de electron-updater redefine allowDowngrade=true.

Objetivo: configurar channel antes de allowDowngrade=false, preservando stable, assinatura e mecanismo existente. Arquivos esperados: app/desktop/electron/updater.cjs e teste de regressão do updater. Sem biblioteca nova, banco ou alteração mobile. Critério: versão inferior não é oferecida; versão superior continua elegível; configuração real permanece allowDowngrade=false depois de configurar canal. Teste focado deve reproduzir o efeito do setter real/contrato e validar a ordem final; repetir checks proporcionais e smoke nativo.

Rollout: após aprovação do aditivo, corrigir localmente, revisar e reconstruir todos os quatro alvos para conter a mesma proteção. Artefatos anteriores ficam descartados como candidatos de publicação. Rollback: reverter diff local antes de publicar. Nenhum tag, release ou deploy autorizado por este aditivo. Status: APROVADO pelo dono em 2026-11-19; implementação e reconstrução autorizadas, publicação permanece com GO separado.

## Fechamento local após aditivo
Quatro alvos reconstruídos; oito testes direcionados aprovados; smoke Intel com login sem exceção JS e updater=no-update (sem downgrade). Apps/DMGs Mac assinados, notarizados, stapled e aceitos por Gatekeeper; ZIPs íntegros; Windows/Linux validados estruturalmente. Stage final com16 assets,15/15SHA256 e três feeds com SHA512/tamanhos corretos. Revisor final Approved with reservations, nenhumCritical/High bloqueante. Detalhes e limites em docs/operacao/releases/v0.3.2-validacao.md; notas em v0.3.2-notas.md. GO final para commit/push/tag/release/Vercel ainda necessário. Suíte final352/355 (três falhas textuais HEAD), sem executar ARM/Windows/Linux; alertas transitivos e WindowssemAuthenticode registrados.

## GO de publicação
Dono autorizou explicitamente: “GO: publicar v0.3.2 e web”. Escopo: commit/push isolado, tag, GitHub Release latest com16 assets, deploy web Vercel; Actions desativados. Ressalvas apresentadas e aceitas. Issue #39 registra execução. Nenhuma migration ou build mobile.

## Publicação concluída e conferida — 20/11/2026
Commit706a4fd/tagv0.3.2; release latest451912788 com16 assets remotos conferidos por digest/tamanho,16linksHTTP200,feeds/manifesto idênticos. Vercel dpl_BSuMb4JsfXU7p3PbUsht9uUuuDaW Ready, site/download testados no Chrome semexceçãoJS. Cópia Intel0.3.1 detectou/baixou0.3.2; instalação/reinício não executados. ZeroActions, workflowsdesativados. Evidências e rollback em docs/operacao/releases/v0.3.2-validacao.md. Issue#39 encerrada por publicação; #16permaneceaberta.
