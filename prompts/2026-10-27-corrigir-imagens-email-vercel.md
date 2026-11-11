# Plano — corrigir imagens dos e-mails na Vercel

## Objetivo

Restaurar a entrega pública das imagens institucionais usadas nos cabeçalhos dos e-mails, sem alterar o conteúdo nem o fluxo de envio dos e-mails. Evitar que uma URL de arquivo inexistente retorne silenciosamente o HTML da aplicação.

## Documentos e referências lidos

- `AGENTS.md` fornecido na conversa.
- `docs/README.md` e `docs/operacao/release-checklist.md`.
- `prompts/2026-10-20-imagens-templates-email.md`.
- Documentação oficial Vercel sobre rewrites e precedência do filesystem: https://vercel.com/docs/project-configuration/vercel-json.

## Código e configuração inspecionados

- `app/vercel.json` e configuração de build Vite em `app/vite.config.ts`.
- `app/public/01.png`, `app/public/02.png`, `app/public/03.png` (presentes localmente, não rastreados pelo Git).
- Templates transacionais e migration `supabase/migrations/20261020000002_email_template_brand_images.sql`.
- Respostas HTTP atuais para os três URLs públicos e para o caminho legado de imagem.
- Estado Git: assets PNG não rastreados; demais alterações preexistentes ficam fora do escopo.

## Decisões e suposições

- Manter o mapeamento vigente: `01.png` convites, `02.png` e-mails gerais, `03.png` resultados de simulação/proposta.
- A causa principal é a ausência dos PNGs na árvore enviada à Vercel; o rewrite SPA transforma a ausência em resposta `200 text/html`.
- Versionar os três assets existentes, sem recomprimir ou substituir a arte.
- Restringir o fallback SPA a rotas sem extensão, para URLs de arquivos ausentes retornarem 404 em vez de HTML.
- Não alterar banco, templates, Edge Functions, envio de e-mails, secrets, nem fazer deploy nesta etapa.

## Arquivos esperados

- `app/public/01.png`, `app/public/02.png`, `app/public/03.png` incluídos na árvore do projeto.
- `app/vercel.json` com fallback SPA limitado a rotas sem extensão.
- Este plano atualizado com as evidências locais.

## Requisitos e critérios de aceite

- Build Vite contém os três PNGs em `dist/` e preserva os bytes dos arquivos de origem.
- O preview local responde aos três caminhos com `200` e `Content-Type: image/png`.
- Um caminho com extensão inexistente retorna 404, não `index.html`.
- Rotas SPA conhecidas continuam carregando diretamente e após refresh.
- Nenhum envio de e-mail é realizado; URLs e templates atuais permanecem iguais.
- Não publicar em produção; a publicação é etapa separada.

## Segurança

- Sem segredos ou dados pessoais envolvidos.
- Não alterar banco ou serviços autenticados.
- Manter arquivos estáticos no diretório público e validar tipo MIME para evitar resposta HTML disfarçada de imagem.

## Verificações

- `npm run build` em `app/`.
- Conferir presença e hashes dos três arquivos em `app/dist/`.
- Executar `vite preview` local e fazer requests HTTP para imagens e arquivo inexistente.
- Testar uma rota SPA existente no preview.
- `git diff --check`.

## Execução local — 2026-10-27

- `npm run build`: aprovado; TypeScript e Vite concluíram. Vite avisou sobre chunks grandes já existentes.
- `npm run lint`: aprovado sem erros; 33 avisos em arquivos não alterados nesta correção.
- `npm run typecheck`: aprovado.
- Os três PNGs estão em `dist/` com hashes idênticos aos arquivos em `public/`.
- Preview Vite: `/01.png`, `/02.png` e `/03.png` responderam `200 image/png`; rota SPA `/propostas` respondeu `200 text/html`.
- `git diff --check` e parse JSON de `app/vercel.json`: aprovados.
- `vercel build` não executou porque faltam as configurações locais do projeto Vercel; não rodei `vercel pull`, pois isso poderia copiar variáveis de ambiente privadas. Não houve publicação.
- O fallback Vite do preview local responde `index.html` para arquivos ausentes; por isso o comportamento 404 da regra Vercel permanece para validação em Preview Vercel antes da produção.
