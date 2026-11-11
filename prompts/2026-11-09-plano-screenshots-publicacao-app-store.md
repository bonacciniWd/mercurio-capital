# Screenshots e publicação na App Store

## Objetivo

Gerar screenshots reais e consistentes do app Mercúrio Capital para App Store Connect e preparar o plano de publicação iOS usando a conta Apple já registrada na documentação local.

## Fontes consultadas

- `docs/operacao/runbooks.md`, seção 16.2: gates de release iOS, EAS production e TestFlight.
- `mobile/README.md`: fluxo EAS/Transporter, bundle identifier e histórico da versão 0.0.2.
- `mobile/app.json`: `com.mercuriocapital.app`, domínio associado e ícone atual.
- Apple, especificações oficiais de screenshots: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
- Apple, upload de screenshots e app previews: https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots/

## Escopo proposto

1. Preparar uma build de produção iOS assinada pelo perfil EAS `production`, sem submissão automática.
2. Instalar a build em dispositivo/simulador adequado e capturar as telas principais: onboarding, login, área inicial de cliente, detalhe da proposta, documentos, área inicial de parceiro, propostas, carteira, promoções e perfil.
3. Remover dados pessoais e usar dados de demonstração controlados; não capturar tokens, e-mails reais, IDs, mensagens ou dados financeiros reais.
4. Exportar PNG/JPEG sem transparência no tamanho exigido pelo App Store Connect. A Apple exige pelo menos um screenshot para iPhone com Dynamic Island; iPad só será incluído se o suporte a iPadOS permanecer habilitado.
5. Criar checklist de metadados, privacidade, categoria, classificação etária, URL de suporte, URL de política e notas de revisão.
6. Fazer upload do build para TestFlight via EAS Submit ou Transporter e validar processamento antes de qualquer envio para revisão.

## Fora do escopo nesta aprovação

- Submissão final para revisão da Apple.
- Alteração de bundle identifier, Team ID, credenciais, certificados ou secrets.
- Publicação Android.

## Critérios de aceite

- Screenshots legíveis, sem PII e correspondentes ao build testado.
- Build de produção com status `FINISHED` e versão/build registrados.
- Arquivos organizados por idioma e tamanho de dispositivo.
- Checklist Apple preenchido e pendências explicitadas antes do upload.

## Segurança

Não expor Apple ID, senha, tokens, certificados ou chaves privadas. O login Apple/Transporter deve ocorrer de forma interativa no ambiente autorizado ou por credencial já configurada no EAS.

## Validação

Typecheck, export, build EAS production, smoke test visual no dispositivo e verificação dos arquivos com dimensões/formatos aceitos pela Apple.
