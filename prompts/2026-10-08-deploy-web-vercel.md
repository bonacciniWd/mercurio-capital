# Publicação web — 2026-10-08

## Objetivo e autorização

Publicar na Vercel a árvore web aprovada, incluindo simuladores, planos de amortização, painel de leads e correção da edição dos imóveis/LTV. O dono autorizou explicitamente a publicação web sem release Electron e, separadamente, a migration `20261007000002` e a função `public-simulacao-lead`.

Esta autorização atual substitui a restrição de publicação registrada no preflight anterior da correção LTV. Não inclui tags, instaladores, atualizador Electron, release mobile ou envio de mensagens de teste.

## Documentos e código inspecionados

Documentação operacional de mudanças, simulador público, planos de amortização, redesign de leads e edição de imóveis/LTV; configurações Vercel/Vite/package.json; migration autorizada, função pública e motor server-side de amortização; smoke SQL fase 40. Nenhuma skill específica aplicável.

## Decisões e arquivos esperados

Manter a stack e versão atuais. Congelar a origem web em diretório temporário, usar as variáveis de produção sem exibi-las e publicar apenas o site. O build final ocorre na Vercel, pois variáveis marcadas como sensíveis são ocultadas no pull local. Construir com `--prod --skip-domain`, verificar o artefato e então promover. Atualizar os registros operacionais após confirmação. Sem alteração funcional nova nem novo modelo de dados: ativar somente o modelo já aprovado de planos/resultados e configuração interna de mensagens.

## Segurança e aceite

Somente uma migration pendente foi confirmada pelo dry-run. Captura permanece exclusiva do servidor/service role; configuração de mensagens exige administrador completo e RLS; parceiro e anon não recebem acesso aos leads. Não expor credenciais, incluir arquivos .env nos artefatos nem criar leads reais ou enviar e-mails no smoke.

Auditoria de dependências de runtime: zero High/Critical. A auditoria completa registra 2 Critical e 9 High na cadeia de desenvolvimento/build/desktop; sua atualização e o gate dos instaladores continuam pendentes. Esta publicação estática web tem GO específico do dono e não conclui a checklist Electron.

## Verificações

Executados: lint sem erros (38 avisos existentes), typecheck, 103 testes em 28 arquivos, diff check. Executar build com ambiente de produção; verificar schema, privilégios e RLS remotamente; verificar função publicada sem captura real; testar rotas e arquivos estáticos após publicação e interfaces no navegador, sem salvar propostas reais.

## Rollout e rollback

1. Guardar fonte anterior da função e referência do deploy web anterior.
2. Aplicar somente `20261007000002`; verificar schema e segurança.
3. Publicar somente `public-simulacao-lead`; verificar versão ativa.
4. Construir e publicar web na Vercel; verificar aliases e rotas.

Rollback web: deploy anterior `mercurio-digital-maum0mnng-bonacciniwds-projects.vercel.app` (`dpl_8GpwSrEPbqaXLxWqQB9mib6Sm2Pc`). Backend aditivo pode permanecer com frontend anterior; caso necessário, republicar a fonte anterior da função. Não apagar colunas ou dados em rollback.

## Resultado

- Migration `20261007000002` aplicada; `public-simulacao-lead` ativa na versão 3, preservando `verify_jwt=false`.
- Smoke fase 40 passou: colunas, view, configuração, RPC, privilégios e política de admin completo. A primeira consulta via `information_schema` sem assumir a role postgres não via as colunas; a execução com a role de manutenção confirmou todos os itens.
- Smoke transacional da RPC v2 passou: planos e comparativo, resumo nas mensagens da fila e idempotência. `ROLLBACK` confirmado, sem lead ou outbox persistido e sem envio. O cenário inicial com totais zerados foi rejeitado corretamente; o cenário com os totais calculados pelo motor passou.
- Função HTTP: GET retorna 405, POST vazio retorna 400, sem captura.
- Build local passou, mas recebeu placeholders das variáveis sensíveis. O primeiro deploy `dpl_3gkPjibCyyJXdbG29sZM7WLuYRXN` falhou no navegador com URL Supabase inválida e foi imediatamente revertido ao deploy anterior. Não foi considerado validação bem-sucedida.
- Build final executado na Vercel com ambiente real de produção. Artefato conferido com URL do projeto correto e chave pública publishable, sem literal de chave privada ou placeholder oculto.
- Deploy final READY: `dpl_HprnEB7yyi6wBAn8upRfuRqEh338`, `https://mercurio-digital-q5wzrihm9-bonacciniwds-projects.vercel.app`, promovido ao domínio principal após conferência do artefato.
- Origem congelada: manifesto SHA256 `4d977ab019aa76bff4a3dd707012873213cb338507d2fe9623ed199bebb40d8b`, informado ao CLI por `--meta` (a resposta de inspect não expõe os metadados). Comparação dos arquivos enviados contra o manifesto não encontrou diferenças. Checkout de referência `5225be7` com mudanças aprovadas locais. Snapshot e backup anterior da função em `/tmp/mercurio-web-release.FMsx4E`, sem garantia de retenção permanente desse diretório temporário; credenciais temporárias do banco e ambiente baixado foram removidos após verificação.
- Rotas principais e assets responderam 200. Navegador em produção: toggle, campos Price/SAC, prazo inválido, consentimento, quatro etapas até prévia e inclusão de plano extra com recálculo confirmados; nenhum clique de captura final.
- Navegador autenticado local: valor inicial de R$ 600.000,00, edição para R$ 500.000,00 com LTV de 62%, cancelamento restaurando valor/LTV anterior. Não foi salvo dado real; persistência da edição e novo envio efetivo de e-mail não foram testados nesta publicação.
- Lint sem erros (38 avisos existentes), typecheck, 103 testes em 28 arquivos, build e diff check passaram. PDF impresso real e validação de instaladores permanecem fora deste smoke.
- Sem tag, release ou publicação de instaladores Electron/mobile.
