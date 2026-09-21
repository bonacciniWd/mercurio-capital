# Adendo de seguranca da release v0.2.0

## Objetivo

Eliminar os achados Critical/High corrigiveis identificados antes da publicacao da `v0.2.0`, mantendo arquitetura, funcionalidades, banco e canal de atualizacao inalterados.

## Autorizacao

O dono do produto autorizou atualizar as dependencias caso os erros fossem restritos a dependencias e, depois da validacao, publicar o deploy com prioridade para disponibilidade ate 18:00 de 2026-09-03.

## Codigo e documentos inspecionados

- `app/package.json`, `app/package-lock.json` e relatorios `npm audit` completo e de producao.
- `app/vite.config.ts` e `app/tsconfig.json`.
- `app/desktop/electron/main.cjs`, `preload.cjs` e `updater.cjs`.
- `app/electron-builder.json`.
- Plano e checklist da release `v0.2.0`.
- Metadados npm de engines e peer dependencies das versoes corrigidas.

## Diagnostico

- Os gates funcionais passaram antes da atualizacao: lint sem erros, typecheck, 75 testes e builds web/desktop.
- Os achados sao do grafo de dependencias; nao foi identificado erro funcional novo nas telas.
- Electron 32 e Electron Builder 25 exigem saltos major para versoes corrigidas.
- Vite 8 exige atualizacao coordenada de `@vitejs/plugin-react`; Vitest 5 e compativel com Vite 8 e Node 24.

## Alteracoes previstas

- `electron`: `44.1.1`.
- `electron-builder`: `26.15.3`.
- `vite`: `8.2.2`.
- `vitest`: `5.0.0`.
- `@vitejs/plugin-react`: `6.1.1`.
- `postcss`: `8.5.28`.
- `concurrently`: `10.0.5`.
- Fixar engine Node em `>=22.12.0`.
- Atualizar transitivas corrigidas pelo resolvedor npm sem adicionar novas bibliotecas de produto.

## Arquivos esperados

- `app/package.json`.
- `app/package-lock.json`.
- Ajustes pequenos de compatibilidade somente se lint, typecheck, testes ou builds demonstrarem necessidade.
- Checklist da release com o audit final.

## Criterios de aceite

- `npm audit` sem Critical/High; qualquer excecao exige nova decisao explicita.
- Lint, typecheck, 75 ou mais testes e builds web/desktop aprovados.
- Novo empacotamento dos tres sistemas; artefatos anteriores nao podem ser publicados.
- macOS novamente assinado/notarizado; feeds, hashes e blockmaps regenerados.
- Windows e Linux novamente validados.
- Nenhum GitHub Actions usado; GitHub Release e Vercel somente via terminal.

## Seguranca e rollback

- Nao executar `npm audit fix --force`.
- Manter a release como candidata local/draft ate todos os gates passarem.
- Preservar os artefatos anteriores para comparacao; selecionar para upload somente o staging novo.
- Se um salto major quebrar APIs ou testes, interromper a publicacao e registrar o erro concreto.

