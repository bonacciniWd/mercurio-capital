# Fase 1 — visualizacao de documentos por admins limitados e recuperacao administrativa

## Objetivo

1. Permitir que os admins limitados abaixo visualizem, com URL assinada de curta duracao, os arquivos enviados na aba Documentos do detalhe de uma proposta:
   - `victor.hugo@mercuriocapitalsa.com.br`;
   - `anderson.maciel@mercuriocapitalsa.com.br`;
   - `matheos.estrela@mercuriocapitalsa.com.br`.
2. Recuperar o acesso de `admin.recuperacao@mercuriocapital.dev` sem envio de e-mail.
3. Nao gerar release, tag, deploy Vercel ou publicacao desktop/mobile nesta fase.

## Skills e documentos lidos

Nao foi necessaria skill externa. Foram usadas as fontes locais autoritativas:

- instrucoes `AGENTS.md` fornecidas para o repositorio;
- `docs/operacao/change-management.md`;
- `docs/operacao/release-checklist.md`;
- agentes em `.github/agents/`;
- `docs/README.md`;
- `docs/09-roadmap.md`;
- `docs/12-finalizacao.md`;
- `docs/blueprint/01-architecture.md`;
- `docs/blueprint/02-roles-permissions.md`;
- `docs/blueprint/04-database-schema.md`;
- `docs/blueprint/06-modules-features.md`;
- `docs/blueprint/08-security-compliance.md`;
- `docs/handoffs/16-handoff-fase-fundos-docs.md`;
- `docs/operacao/runbooks.md`.

## Codigo e configuracoes inspecionados

- `app/src/pages/admin/PropostaDetalhe.tsx`;
- `app/src/components/PropostaDocsUploader.tsx`;
- `app/src/lib/adminScope.ts`;
- `app/src/router.tsx`;
- `supabase/migrations/20260513000003_originacao.sql`;
- `supabase/migrations/20260518000001_storage_proposta_docs.sql`;
- `supabase/migrations/20260718000001_admin_nivel.sql`;
- `supabase/migrations/20260722000004_documentos_checklist.sql`;
- `supabase/migrations/20260722000007_admin_juridico_hardening.sql`;
- smoke tests de admin nivel, juridico e documentos.

O Supabase CLI autenticado confirmou o projeto vinculado `bhagksfvszeogtjvjtpx` (`mercurio`). A consulta administrativa foi somente leitura e nao exibiu chaves.

## Diagnostico

### Admins limitados

Os tres usuarios existem no Auth, estao confirmados, ativos e possuem:

- `app_metadata.role = 'admin'`;
- `app_metadata.admin_nivel = 'limitado'`.

A RLS de `proposta_documentos` permite SELECT para qualquer admin por `app_is_admin()`. A policy SELECT de `storage.objects` para o bucket privado `proposta-docs` tambem permite qualquer admin. Portanto, nao e necessario ampliar acesso de banco nem criar permissao por e-mail.

A causa observada esta na UI: `AdminPropostaDetalhe` lista tipo, status e botoes Aprovar/Reabrir, mas nao cria URL assinada nem oferece botao Visualizar/Baixar. O comportamento incompleto afeta todos os admins nessa tela, embora tenha sido reportado pelos limitados.

### Conta de recuperacao

`admin.recuperacao@mercuriocapital.dev` existe no projeto correto, esta confirmada, nao esta banida, possui `role='admin'`, nao declara `admin_nivel` (logo o helper vigente resolve para `full`) e nao tem fatores 2FA. A recuperacao requer apenas definir uma nova senha por API administrativa, sem fluxo de e-mail.

## Modelo de dados

Nao ha mudanca de modelo de dados.

- Nenhuma tabela, coluna, relacionamento ou enum novo.
- Nenhuma migration prevista para a correcao principal.
- RLS existente sera preservada.
- Nenhuma permissao sera vinculada a e-mails especificos; o comportamento seguira o papel `admin` e o nivel ja persistido.

## Decisoes e suposicoes

- A visualizacao sera disponibilizada para admins que ja conseguem ler a proposta e a linha de documento.
- O arquivo continuara privado; o browser recebera somente URL assinada com TTL de 5 minutos.
- O botao sera exibido apenas quando `storage_path` existir.
- Falhas ao assinar/abrir terao estado de carregamento e mensagem de erro clara.
- Aprovar/Reabrir permanecera restrito conforme as regras atuais; juridico continua read-only para validacao.
- A conta de recuperacao permanecera `admin full` e confirmada.
- A senha temporaria nao sera escrita no repositorio, em logs de comando ou em documentacao.
- A conta devera cadastrar 2FA no primeiro acesso porque admins passam pelo `Require2FA`.

## Arquivos esperados

- `app/src/pages/admin/PropostaDetalhe.tsx` — acao segura de visualizacao via `createSignedUrl` e estados de feedback;
- teste novo ou existente em `app/src/test/` para o comportamento de documentos administrativos, isolando a chamada ao Storage;
- `docs/09-roadmap.md`, `docs/12-finalizacao.md` ou handoff especifico da fase — registro da correcao depois de validada;
- opcional: smoke SQL somente se a verificacao remota revelar drift de policies, o que nao foi observado no codigo.

Para recuperacao da conta, nenhuma alteracao versionada e necessaria: sera uma operacao administrativa pontual no projeto `bhagksfvszeogtjvjtpx`.

## Requisitos e criterios de aceite

- Os tres admins limitados abrem a aba Documentos de uma proposta acessivel.
- Cada documento real apresenta acao Visualizar.
- A acao gera URL assinada do bucket registrado, com TTL maximo de 5 minutos.
- PDF/imagem abre em nova aba sem tornar o bucket publico.
- Documento placeholder sem `storage_path` nao apresenta acao.
- Falha de Storage nao aprova nem altera o documento e apresenta erro ao usuario.
- Aprovar/Reabrir continua funcional para admins operacionais.
- Admin juridico pode visualizar, mas nao ganha permissao de aprovacao.
- Partner, team_member e client nao recebem ampliacao de escopo.
- `admin.recuperacao@mercuriocapital.dev` autentica com nova senha sem e-mail e e direcionado a configurar 2FA.
- Nenhum segredo aparece no Git, logs ou documentacao.
- Nenhuma release e criada.

## Consideracoes de seguranca

- Usar o bucket gravado no registro somente apos validar uma allowlist (`proposta-docs`) ou usar diretamente o bucket canonico; nao aceitar bucket arbitrario do usuario.
- URL assinada expira em ate 300 segundos.
- Usar `noopener,noreferrer` ao abrir nova aba.
- Nao exibir `storage_path` como URL publica.
- Preservar RLS e o helper `app_is_admin()`; nao criar excecoes por e-mail.
- Fazer a troca de senha via endpoint administrativo com service role mantida apenas na memoria do processo.
- Nao imprimir service role nem senha temporaria no terminal.

## Testes automaticos

Em `app/`:

```bash
npm run validate:release
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

Adicionar cobertura para:

- clique em Visualizar chama `createSignedUrl` com bucket/path e TTL esperados;
- URL valida abre com protecao de opener;
- erro de assinatura aparece na UI;
- placeholder nao oferece Visualizar;
- juridico nao recebe Aprovar/Reabrir.

## Testes manuais

1. Admin limitado: abrir proposta com PDF e imagem, visualizar ambos e manter aprovacao funcional.
2. Admin juridico: visualizar documento e confirmar ausencia de mutacoes operacionais.
3. Documento ausente/placeholder: confirmar estado correto.
4. Simular erro do Storage e confirmar feedback sem mudanca de status.
5. Conta de recuperacao: login com senha temporaria e fluxo obrigatorio de cadastro 2FA.

## Operacao de recuperacao proposta

Depois da aprovacao deste plano:

1. gerar senha temporaria forte localmente, sem eco no terminal;
2. atualizar apenas o usuario `63b6eb8c-7926-4ab8-b9b7-1f124342b362` no projeto `bhagksfvszeogtjvjtpx` pela Admin API;
3. preservar `role='admin'`, `admin_nivel` efetivo `full`, e-mail confirmado e estado nao banido;
4. validar a resposta administrativa sem realizar login automatizado, para nao expor a senha;
5. entregar a senha ao dono por um mecanismo local fora do Git e exigir troca posterior/2FA.

## Rollout e rollback

- Codigo: merge/deploy ficam fora desta autorizacao; serao mapeados em ciclo posterior.
- UI: rollback por reversao do diff antes de qualquer release.
- Conta: se a senha for comprometida, gerar outra imediatamente pela mesma operacao administrativa; nao usar e-mail.
- Nenhuma alteracao de banco esta prevista.

## Aprovacao

Aprovado pelo dono do produto em 2026-09-02. Autorizada a geracao de senha temporaria forte em arquivo local ignorado pelo Git. Deploy, tag e release continuam fora do escopo.
