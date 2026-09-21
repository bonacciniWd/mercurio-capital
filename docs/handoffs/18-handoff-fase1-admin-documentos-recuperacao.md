# Handoff — Fase 1: documentos de proposta e conta de recuperação

## Escopo

- Corrigir o fluxo administrativo de documentos para permitir visualização segura antes da aprovação.
- Recuperar `admin.recuperacao@mercuriocapital.dev` sem envio de e-mail.
- Não realizar deploy, tag ou release.

## Diagnóstico

Os admins afetados já possuem `role='admin'` e `admin_nivel='limitado'`. As policies de SELECT em `proposta_documentos` e `storage.objects` já autorizam qualquer admin. O problema estava na ausência de uma ação de visualização na UI.

## Implementação local

- `app/src/pages/admin/PropostaDetalhe.tsx`: botão Visualizar, loading por documento e feedback de erro.
- `app/src/lib/propostaDocumento.ts`: assinatura no bucket canônico `proposta-docs`, TTL de 5 minutos, validação do path e abertura com `noopener,noreferrer`.
- `app/src/test/propostaDocumento.test.ts`: cobertura da assinatura, paths inválidos, erro e abertura segura.
- `.gitignore`: proteção para `.local-secrets/`.

## Segurança e permissões

- Nenhuma exceção por e-mail foi criada.
- Nenhuma policy, migration ou modelo de dados foi alterado.
- Admin limitado mantém as mutações operacionais vigentes.
- Admin jurídico pode visualizar, mas continua sem Aprovar/Reabrir.
- O bucket permanece privado.

## Estado operacional

- Operação de recuperação autorizada somente para o projeto `bhagksfvszeogtjvjtpx`.
- A senha temporária deve ficar em arquivo local ignorado pelo Git e com permissão `0600`.
- Deploy e release permanecem pendentes de mapeamento e GO separados.

