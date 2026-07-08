# Desktop Release macOS - Signing e Notarizacao (Stable)

## Objetivo

Garantir que o release desktop macOS so publique artefatos assinados e notarizados.
Se qualquer credencial ou validacao critica de assinatura/notarizacao falhar (app ou dmg), o job macOS precisa falhar e o publish deve ser bloqueado.

## Politica final do gate macOS (hard-fail)

- Stable only: o pipeline de release continua exclusivo para tags `v*.*.*` e canal `stable`.
- Validacoes obrigatorias de app bundle (hard-fail).
- `codesign --verify --deep --strict --verbose=2 <app>.app`
- `spctl --assess --type execute --verbose=4 <app>.app`
- `xcrun stapler validate <app>.app`
- Validacoes obrigatorias de DMG em ordem deterministica (hard-fail).
- `codesign --force --sign "<Developer ID Application>" --timestamp <arquivo>.dmg`
- `codesign --verify --verbose=2 <arquivo>.dmg`
- `xcrun notarytool submit <arquivo>.dmg --wait`
- `xcrun stapler staple <arquivo>.dmg`
- `xcrun stapler validate <arquivo>.dmg`
- `spctl --assess --type open --context context:primary-signature --verbose=4 <arquivo>.dmg`
- Nao existe caminho de warning para falhas de DMG (incluindo `source=no usable signature` e `does not have a ticket`).
- Qualquer falha critica no job macOS impede o `publish-release`.

## Escopo

- Em escopo: geracao, armazenamento seguro e validacao de credenciais Apple no CI.
- Fora de escopo: assinatura Windows, mudanca de regra de negocio, release de nova versao nesta etapa.

## Secrets obrigatorios no CI

Configurar no repositorio (Settings -> Secrets and variables -> Actions):

- `APPLE_SIGNING_CERT_BASE64`: conteudo base64 em linha unica do `.p12` Developer ID Application.
- `APPLE_SIGNING_CERT_PASSWORD`: senha forte do `.p12`.
- `APPLE_ID`: Apple ID com acesso a notarizacao.
- `APPLE_APP_SPECIFIC_PASSWORD`: app-specific password do Apple ID.
- `APPLE_TEAM_ID`: Team ID oficial do time de publicacao do app `com.mercuriocapital.app`.

## Execucao paralela (45 a 90 min)

### Workstream A - Acesso Apple e permissoes

1. Confirmar conta ativa no Apple Developer Program.
2. Confirmar Apple ID com 2FA habilitado.
3. Confirmar permissao para emitir Developer ID Application e usar notarizacao.
4. Se houver mais de um Team, fixar o Team oficial de producao para `com.mercuriocapital.app`.

### Workstream B - Certificado de assinatura

1. No Mac de confianca, abrir Keychain Access e gerar CSR.
2. No Apple Developer Portal, criar certificado tipo Developer ID Application com a CSR.
3. Instalar o certificado no mesmo Mac que gerou a CSR.
4. Exportar certificado + private key para arquivo `.p12`.
5. Converter `.p12` para base64 em linha unica.

Comandos sugeridos:

```bash
openssl base64 -in mercurio-dev-id.p12 -out mercurio-dev-id.p12.b64 -A
```

### Workstream C - Credenciais de notarizacao

1. Definir `APPLE_ID` (email Apple ID).
2. Gerar `APPLE_APP_SPECIFIC_PASSWORD` em appleid.apple.com.
3. Capturar `APPLE_TEAM_ID` no Membership do Apple Developer ou Users and Access do App Store Connect.

### Workstream D - Onboarding no GitHub Actions

1. Cadastrar os 5 secrets obrigatorios no repositorio.
2. Validar que nenhum valor foi salvo em arquivo versionado.
3. Restringir permissao de manutencao de secrets para poucos owners.

#### Origem dos 3 secrets pendentes

- `APPLE_ID`: email Apple ID com acesso ao time `29U8L34KC9`.
- `APPLE_SIGNING_CERT_PASSWORD`: senha definida no momento do export do `.p12`.
	- Se esqueceu, reexportar o `.p12` com nova senha e atualizar tambem `APPLE_SIGNING_CERT_BASE64`.
- `APPLE_APP_SPECIFIC_PASSWORD`: gerar em appleid.apple.com (Sign-In and Security -> App-Specific Passwords).
	- A Apple nao mostra senha antiga; se necessario, revogar e gerar uma nova.

#### Cadastro seguro no GitHub Actions (zsh)

Use estes comandos no zsh para evitar erro de sintaxe no `read`:

```zsh
cd /Users/macbook/Desktop/MercurioCapital

read 'APPLE_ID?APPLE_ID (email): '
print -rn -- "$APPLE_ID" | gh secret set APPLE_ID
unset APPLE_ID

read -s 'APPLE_SIGNING_CERT_PASSWORD?APPLE_SIGNING_CERT_PASSWORD: '
echo
print -rn -- "$APPLE_SIGNING_CERT_PASSWORD" | gh secret set APPLE_SIGNING_CERT_PASSWORD
unset APPLE_SIGNING_CERT_PASSWORD

read -s 'APPLE_APP_SPECIFIC_PASSWORD?APPLE_APP_SPECIFIC_PASSWORD: '
echo
print -rn -- "$APPLE_APP_SPECIFIC_PASSWORD" | gh secret set APPLE_APP_SPECIFIC_PASSWORD
unset APPLE_APP_SPECIFIC_PASSWORD

gh secret list | grep -E "APPLE_SIGNING_CERT_BASE64|APPLE_SIGNING_CERT_PASSWORD|APPLE_ID|APPLE_APP_SPECIFIC_PASSWORD|APPLE_TEAM_ID"
```

### Workstream E - Validacao final pre-release

1. Validar p12 localmente (integridade + senha).
2. Validar autenticacao Apple com `notarytool --validate`.
3. Subir tag de teste e validar as etapas do workflow:
   - `Validate mac signing secrets`
   - `Build desktop artifacts (mac signed + notarized)`
   - `Verify mac signature and notarization`

### Checklist N para N+1 (pos-build mac)

Executar no macOS runner/local de verificacao com os artefatos gerados em `app/desktop/artifacts`:

```bash
codesign --verify --deep --strict --verbose=2 "app/desktop/artifacts/mac/Mercurio Capital.app"
spctl --assess --type execute --verbose=4 "app/desktop/artifacts/mac/Mercurio Capital.app"
xcrun stapler validate "app/desktop/artifacts/mac/Mercurio Capital.app"

DMG_SIGN_ID="$(security find-identity -v -p codesigning | awk -F '"' '/Developer ID Application/ {print $2; exit}')"

codesign --force --sign "$DMG_SIGN_ID" --timestamp "app/desktop/artifacts/Mercurio Capital-<versao>-arm64.dmg"
codesign --verify --verbose=2 "app/desktop/artifacts/Mercurio Capital-<versao>-arm64.dmg"
xcrun notarytool submit "app/desktop/artifacts/Mercurio Capital-<versao>-arm64.dmg" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait
xcrun stapler staple "app/desktop/artifacts/Mercurio Capital-<versao>-arm64.dmg"
xcrun stapler validate "app/desktop/artifacts/Mercurio Capital-<versao>-arm64.dmg"
spctl --assess --type open --context context:primary-signature --verbose=4 "app/desktop/artifacts/Mercurio Capital-<versao>-arm64.dmg"

codesign --force --sign "$DMG_SIGN_ID" --timestamp "app/desktop/artifacts/Mercurio Capital-<versao>.dmg"
codesign --verify --verbose=2 "app/desktop/artifacts/Mercurio Capital-<versao>.dmg"
xcrun notarytool submit "app/desktop/artifacts/Mercurio Capital-<versao>.dmg" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait
xcrun stapler staple "app/desktop/artifacts/Mercurio Capital-<versao>.dmg"
xcrun stapler validate "app/desktop/artifacts/Mercurio Capital-<versao>.dmg"
spctl --assess --type open --context context:primary-signature --verbose=4 "app/desktop/artifacts/Mercurio Capital-<versao>.dmg"
```

## Validacao tecnica local (antes da tag)

Exporte os valores no shell local (sem versionar):

```bash
export APPLE_SIGNING_CERT_BASE64='<valor>'
export APPLE_SIGNING_CERT_PASSWORD='<valor>'
export APPLE_ID='<valor>'
export APPLE_APP_SPECIFIC_PASSWORD='<valor>'
export APPLE_TEAM_ID='<valor>'
```

Validacao do p12:

```bash
tmp_p12="$(mktemp /tmp/apple-signing.XXXXXX.p12)"
printf '%s' "$APPLE_SIGNING_CERT_BASE64" | base64 -D > "$tmp_p12"
if ! openssl pkcs12 -in "$tmp_p12" -passin env:APPLE_SIGNING_CERT_PASSWORD -nokeys -clcerts -info -noout; then
  openssl pkcs12 -legacy -in "$tmp_p12" -passin env:APPLE_SIGNING_CERT_PASSWORD -nokeys -clcerts -info -noout
fi
rm -f "$tmp_p12"
```

Validacao de autenticacao notarytool:

```bash
xcrun notarytool store-credentials "mc-preflight" \
	--apple-id "$APPLE_ID" \
	--password "$APPLE_APP_SPECIFIC_PASSWORD" \
	--team-id "$APPLE_TEAM_ID" \
	--validate
```

Se preferir sem export persistente no shell:

```zsh
read 'APPLE_ID?APPLE_ID (email): '
read -s 'APPLE_APP_SPECIFIC_PASSWORD?APPLE_APP_SPECIFIC_PASSWORD: '
echo
xcrun notarytool store-credentials "mc-preflight" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "29U8L34KC9" \
  --validate
unset APPLE_ID APPLE_APP_SPECIFIC_PASSWORD
```

## Aceite

- [ ] `APPLE_SIGNING_CERT_BASE64` decodifica para p12 valido.
- [ ] `APPLE_SIGNING_CERT_PASSWORD` abre o p12 sem erro.
- [ ] `APPLE_ID` autentica com `APPLE_APP_SPECIFIC_PASSWORD`.
- [ ] `APPLE_TEAM_ID` corresponde ao Team oficial de publicacao.
- [ ] Workflow mac passa em assinatura e notarizacao.
- [ ] App bundles passam em `codesign`, `spctl execute` e `stapler validate`.
- [ ] DMGs passam em `codesign`, `notarytool submit --wait`, `stapler staple`, `stapler validate` e `spctl open` sem bypass.
- [ ] Falha de credencial ou validacao critica no macOS bloqueia publicacao.
- [ ] Nenhuma credencial aparece em logs ou no repositorio.

## Evidencias obrigatorias

- Link do run da action verde.
- Logs das etapas de validacao/assinatura/notarizacao sem leak de segredos.
- Artefatos mac publicados (`.dmg` x64 e arm64 + metadados).

## Riscos e mitigacoes

- Certificado sem private key: gerar CSR e exportar p12 no mesmo Mac.
- Certificado de tipo errado: validar explicitamente `Developer ID Application`.
- Team incorreto em conta com varios teams: fixar `APPLE_TEAM_ID` de producao.
- App-specific password revogada: gerar nova e atualizar secret imediatamente.
