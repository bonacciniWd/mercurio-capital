# Plano — restaurar imagens públicas dos e-mails

## Objetivo

Restaurar a entrega pública das três imagens de marca usadas nos templates de e-mail, preservando os HTMLs e o mapeamento já armazenado no banco.

## Documentos e instruções lidos

- `AGENTS.md` fornecido na conversa.
- `docs/README.md` e `docs/operacao/release-checklist.md`.
- `docs/operacao/simulador-publico.md` e a seção de imagens de e-mail em `docs/operacao/runbooks.md`.
- `prompts/2026-10-20-imagens-templates-email.md` e `prompts/2026-10-27-corrigir-imagens-email-vercel.md`.

## Código, configuração e estado inspecionados

- `app/public/01.png`, `02.png` e `03.png` existem localmente.
- `app/vercel.json` configura a aplicação Vite e o fallback SPA.
- Os templates de Auth e transacionais usam URLs absolutas no domínio Mercúrio.
- Migration `20261020000002_email_template_brand_images.sql` mantém os caminhos `/01.png`, `/02.png` e `/03.png` em `templates_mensagem`.
- Consulta remota read-only confirmou o mesmo mapeamento nos sete templates transacionais.
- Em produção, os três caminhos respondem `200 text/html`, `content-disposition: inline; filename="index.html"` e corpo de 1288 bytes. São respostas do app, não imagens.
- Preview Vercel do frontend completo falhou porque `app/src/lib/whatsappFlow.ts` reexporta `supabase/functions/_shared/whatsapp-flow.ts`, fora da raiz `app` que a Vercel envia ao build. O build local passa por ter acesso ao repositório inteiro.

## Diagnóstico e decisão

Os templates e as URLs no banco estão corretos. Os assets não estão presentes no deploy Vercel atualmente ativo, embora existam em `app/public/`. O fallback SPA mascara a ausência devolvendo HTML com status 200. Restaurar os PNGs no frontend publicado e garantir que caminhos com extensão ausentes não sejam tratados como rotas SPA. Não fazer upload adicional para Storage nem alterar banco/Auth, templates, envio de e-mails ou Edge Functions.

## Arquivos esperados

- Incluir `app/public/01.png`, `02.png` e `03.png` no snapshot web de publicação.
- Incluir `app/vercel.json` revisado, mantendo o fallback SPA apenas para rotas sem extensão.
- Tornar a implementação de `whatsappFlow` autocontida dentro da raiz web, preservando as regras existentes e documentando que ela deve permanecer alinhada com a lógica compartilhada da Edge Function.
- Atualizar este plano com evidências do build e dos testes pós-deploy.

## Critérios de aceite

- Build da aplicação contém os três arquivos PNG, sem alteração dos bytes originais.
- Build Vercel consegue compilar o frontend completo sem importar caminhos fora da raiz `app`.
- Preview Vercel responde `200 image/png` para os três URLs e responde 404 para um arquivo inexistente com extensão.
- Uma rota SPA existente continua carregando diretamente.
- Depois da promoção, o domínio público responde `200 image/png` nos três caminhos.
- Os URLs retornados por `templates_mensagem` permanecem os mesmos; nenhum e-mail é enviado.
- Nenhum build ou release dos aplicativos Linux, macOS ou Windows é executado.

## Segurança e escopo

- Os arquivos são imagens institucionais públicas, sem dados pessoais.
- Não exibir, copiar ou publicar arquivos `.env`, tokens, `app/tmp`, dumps, planilhas/PDFs internos, screenshots operacionais ou dados de clientes.
- Não aplicar migrations nem gravar no banco: a consulta de confirmação foi read-only.
- Publicar apenas o frontend web aprovado; revisar o snapshot isolado e o resultado do build antes da promoção.

## Verificações

- `npm run lint`, `npm run typecheck`, suíte de testes e `npm run build` em `app/`.
- Build remoto de preview Vercel concluído.
- Comparar hashes dos PNGs de origem com os arquivos de `dist/`.
- Testar no preview Vercel os três PNGs, arquivo inexistente com extensão e rota SPA.
- Após promoção, repetir as mesmas requisições no domínio público.
- `git diff --check`.

## Aprovação

Implementação e publicação deste ajuste aguardam a aprovação deste plano, conforme o workflow obrigatório do `AGENTS.md` fornecido na conversa.

## Execução aprovada — 2026-11-06

- O dono aprovou o plano.
- Build local, typecheck e lint passaram; lint reportou 33 avisos existentes.
- A suíte completa passou em execução serial: 55 arquivos e 241 testes. A execução paralela anterior teve dois timeouts por contenção; os dois casos passaram isolados e a execução serial completa passou.
- O build Vercel inicial revelou a importação de `whatsappFlow` fora da raiz web. A implementação pura foi copiada para `app/src/lib/whatsappFlow.ts`, com comentário para manter alinhamento; 10 testes do fluxo, typecheck, lint e build passaram após o ajuste.
- Preview Vercel `dpl_5mX5ma3qtzipChvQGhnnFSQnyFsw` ficou READY. Validado: `/01.png`, `/02.png`, `/03.png` = `200 image/png`; arquivo PNG inexistente = 404; `/admin/propostas` = `200 text/html`.
- Produção promovida como `dpl_BAQ53rLMd48QXesYvNFWZc1HSmDk` e alias `www.mercuriocapitalsa.com.br` atualizado. Verificação final repetiu os três `200 image/png`, 404 para arquivo inexistente e 200 para rota SPA.
- Sem alteração ou upload no Storage/banco; migration e URLs dos templates permaneceram iguais. Nenhum e-mail foi enviado e nenhum build desktop foi executado.
- Os 65 arquivos da aplicação web foram revisados e enviados a `origin/main` no commit `46e0be5`; nenhum arquivo `.env`, `app/tmp`, material operacional interno ou build desktop entrou no commit. Nenhuma tag foi criada.
