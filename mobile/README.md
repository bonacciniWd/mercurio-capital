# Mercurio Capital — Mobile

App nativo (iOS + Android) construído com **Expo SDK 58** + **Expo Router 58** + **NativeWind v4**.

## Stack

- **Expo** SDK 58 (managed workflow)
- **Expo Router 58** (navegação file-based, igual Next.js)
- **NativeWind 4** (Tailwind classes em RN)
- **TypeScript** strict
- **lucide-react-native** (ícones)
- **expo-camera** (captura de documentos)

## Setup

```bash
cd mobile
npm install

# rodar
npm run ios       # simulador iOS
npm run android   # emulador Android
npm run start     # QR code (Expo Go)
```

## Variaveis de ambiente

Defina no `mobile/.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://bhagksfvszeogtjvjtpx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_APP_URL=https://mercuriocapitalsa.com.br
```

`EXPO_PUBLIC_APP_URL` e usada para montar links absolutos de convite no app parceiro.

### Pipeline (espelhamento obrigatorio)

No CI/CD (GitHub Actions/EAS Build), espelhe a mesma variavel:

- `EXPO_PUBLIC_APP_URL=https://mercuriocapitalsa.com.br`

Sem esse espelhamento, builds de pipeline podem gerar links com fallback local diferente do ambiente alvo.

### Build iOS 0.0.2 para TestFlight (fluxo operacional)

Fluxo usado para release iOS com EAS:

```bash
cd mobile
npm install
npm run typecheck
npx expo config --type public
npx eas build -p ios --profile production
# submit pode ser feito via EAS Submit ou Apple Transporter
```

Submissao realizada no ciclo `0.0.2`: **Apple Transporter**.

Observacoes:

- O profile `production` fica em `mobile/eas.json` para build (`distribution: store`, `autoIncrement: true`).
- O envio para TestFlight pode ser feito por `npx eas submit -p ios --profile production --latest` ou por Apple Transporter.
- O app usa `expo-build-properties` com `ios.deploymentTarget: "16.4"`, mínimo exigido pelo SDK 56+.
- O bundle identifier iOS permanece `com.mercuriocapital.app`.
- Se login/credencial Apple, EAS ou Transporter falhar, o processo para e a publicacao nao deve ser considerada concluida.

## Estrutura

```
mobile/
├── app/                       # Rotas (file-based)
│   ├── _layout.tsx           # Root stack
│   ├── index.tsx             # Redirecionamento por sessao e papel
│   ├── onboarding.tsx        # Boas-vindas, Parceiro e Cliente PF/PJ
│   ├── login.tsx             # Login
│   ├── magic/[token].tsx     # Magic link
│   ├── camera.tsx            # Captura (modal)
│   ├── propostas/nova.tsx    # Wizard 7 passos (modal)
│   ├── (parceiro)/           # Tab group parceiro
│   │   ├── _layout.tsx       # Tab bar (5 tabs)
│   │   ├── dashboard.tsx
│   │   ├── propostas.tsx
│   │   ├── propostas/[id].tsx
│   │   ├── carteira.tsx
│   │   ├── universidade.tsx
│   │   └── perfil.tsx
│   ├── (cliente)/            # Stack cliente
│   │   ├── _layout.tsx
│   │   ├── index.tsx         # Início: proposta e status atual
│   │   ├── documentos.tsx    # Acervo e solicitações da equipe
│   │   ├── propostas/[id].tsx
│   │   └── universidade.tsx
├── components/               # Componentes compartilhados
│   ├── Badge.tsx
│   └── KPICard.tsx
├── lib/utils.ts              # brl(), formatNumber()
├── assets/                   # Imagens (icon, splash, adaptive-icon)
├── tailwind.config.js        # Cores Mercurio (navy/gold/silver)
├── global.css                # Tailwind base
├── app.json                  # Config Expo
└── package.json
```

## Onboarding e sessão local

O app oferece apenas as áreas Cliente e Parceiro. Cliente entra por convite real da proposta, com validação pelo servidor, e as respostas PF/PJ são gravadas na proposta por RPC autenticada; divergências de identidade ficam para revisão sem alterar o cadastro principal. Parceiro faz cadastro real e aguarda aprovação. Se o cadastro exigir confirmação de e-mail, os dados complementares (sem senha) ficam protegidos no aparelho, expiram logicamente após sete dias e são enviados após o primeiro login com o mesmo e-mail. Rascunhos expirados são apagados no próximo acesso ao app. As RPCs e a chave `mobile_relock_segundos` dependem das migrations locais `20261108000001` e `20261108000002`; nenhuma tela deve ser considerada pronta em produção antes da publicação dessas migrations e de um build nativo.

Sessões persistidas usam `expo-secure-store` e exigem desbloqueio do aparelho na abertura. Ao voltar do segundo plano, o período de tolerância vem de `configuracoes_sistema.mobile_relock_segundos` (padrão 60 segundos), sem substituir o logout por inatividade. No iOS, Face ID requer build de desenvolvimento/TestFlight; o Expo Go não testa esse recurso. O teste físico precisa cobrir sessão antiga em AsyncStorage, cancelamento do prompt, fallback do código do aparelho e sessão expirada.

## Telas e integrações

- ✅ **Onboarding** de Parceiro e Cliente PF/PJ com logo Mercúrio Capital
- ✅ **Login real** e desbloqueio local de sessão persistida
- ✅ **Magic link do cliente** encaminhado ao convite autenticado
- **Parceiro**: telas conectadas ao Supabase; navegação, Perfil, Configurações e acesso ao gerenciamento 2FA ajustados localmente no Lote 1 de 09/11/2026. A paridade dos demais módulos está no [levantamento atual](../docs/operacao/2026-11-09-levantamento-area-parceiro-mobile.md).
- ✅ **Wizard nova proposta** (7 passos como modal)
- ✅ **Cliente**: início e detalhe exibem o status atual; Documentos separa acervo e solicitações; Universidade usa catálogo/assinatura existentes
- ✅ **Câmera** (placeholder com viewfinder)
- Área Admin removida do app; o acesso administrativo permanece no portal web
- ✅ **Milestones**: progresso de meta no dashboard parceiro + perfil

## Próximos passos

1. Adicionar imagens reais em `assets/` (icon.png 1024×1024, splash.png, adaptive-icon.png)
2. Executar release iOS no TestFlight com build EAS e envio por EAS Submit ou Apple Transporter
3. Concluir os módulos Parceiro por lotes conforme [plano funcional e visual](../prompts/2026-11-09-area-parceiro-mobile-funcional-visual.md)
4. Implementar `expo-camera` real na tela `camera.tsx`
5. Integrar push notifications (Expo Notifications + FCM/APNs)

### Acervo documental do cliente

O fluxo novo usa a migration local `20261108000003_cliente_acervo_documental.sql`: arquivos ficam em bucket privado, versões são preservadas e um documento pode ser vinculado a outra proposta do mesmo titular sem duplicar o objeto. Reenvio requer uma solicitação identificada. A migração não faz backfill automático; execute e revise `admin_cliente_acervo_dry_run()` antes de atribuir arquivos antigos. A policy de leitura verifica titularidade, participação na proposta ou Admin. Uploads legados permanecem disponíveis para versões mobile já instaladas; a publicação do banco deve preceder a distribuição da versão mobile compatível.

### Parceiro — Lote 1 local (09/11/2026)

No Expo Router 58, `href: null` impede foco na rota. As telas secundárias agora ficam declaradas, enquanto a barra customizada desenha somente as abas principais. Barra e ações flutuantes não cobrem as telas secundárias. Rotas de gestão e ações de recarga respeitam `partner`/`team_member` sem substituir autorização do servidor.

Perfil, Configurações e Login usam a base escura/vermelha da área Cliente. O Login mantém todos os destinos e o fluxo de autenticação atuais, com contraste revisado, foco entre campos e rolagem ao abrir o teclado. O atalho Notificações abre a caixa real; as instâncias do Perfil e Dashboard compartilham uma assinatura Realtime por usuário, evitando registrar callbacks após o canal assinar. Segurança abre o gerenciamento TOTP e preserva o desbloqueio local como recurso separado. O bloqueio biométrico cobre a tela ativa sem desmontar o estado de configuração quando a pessoa alterna para o autenticador. O cadastro de fator exige uma ação explícita e o cancelamento remove somente o fator pendente criado nessa tela. O contrato de parceria demonstrativo deixou de ser exibido/exportado; a fonte oficial ainda precisa ser definida. O cache privado é limpo ao trocar de usuário/sair, incluindo requisições de query em andamento.

Testes focados, usando Node 24 e dependências existentes:

```bash
node --test --experimental-strip-types tests/*.test.mjs
```

Typecheck mobile, ESLint focado, 9 testes focados e export dos bundles iOS/Android passaram. O perfil EAS `development` e `expo-dev-client` estão configurados; o build iOS interno EAS `e1aa2713-a3be-45b9-a4b9-bec9b51aa860` foi concluído para SDK 58, versão `0.0.2`, build `4`, com distribuição interna. O iPhone de homologação foi registrado no Apple Developer Portal e incluído no provisioning profile. Instalação e validação visual/login, incluindo autenticador e MFA, continuam pendentes no aparelho. Consulte o plano vinculado para o link de instalação e o histórico do build.
