# Mercurio Capital — Mobile

App nativo (iOS + Android) construído com **Expo SDK 54** + **Expo Router** + **NativeWind v4**.

## Stack

- **Expo** SDK 54 (managed workflow)
- **Expo Router 4** (navegação file-based, igual Next.js)
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
- O app usa `expo-build-properties` com `ios.deploymentTarget: "16.0"` para compatibilidade com pods nativos no EAS Build.
- O bundle identifier iOS permanece `com.mercuriocapital.app`.
- Se login/credencial Apple, EAS ou Transporter falhar, o processo para e a publicacao nao deve ser considerada concluida.

## Estrutura

```
mobile/
├── app/                       # Rotas (file-based)
│   ├── _layout.tsx           # Root stack
│   ├── index.tsx             # Splash
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
│   │   ├── index.tsx         # Timeline
│   │   └── documentos.tsx
│   └── (admin)/              # Stack admin
│       ├── _layout.tsx
│       └── dashboard.tsx
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

## Telas implementadas (mock data)

- ✅ **Splash personalizada** com logo M + Mercurio Capital
- ✅ **Login** + biometria + magic link
- ✅ **Magic link** (verificação)
- ✅ **Parceiro**: Dashboard / Propostas (lista) / Detalhe / Carteira / Universidade / Perfil
- ✅ **Wizard nova proposta** (7 passos como modal)
- ✅ **Cliente**: Home (timeline) / Documentos
- ✅ **Câmera** (placeholder com viewfinder)
- ✅ **Admin**: Dashboard
- ✅ **Milestones**: progresso de meta no dashboard parceiro + perfil

## Próximos passos

1. Adicionar imagens reais em `assets/` (icon.png 1024×1024, splash.png, adaptive-icon.png)
2. Executar release iOS no TestFlight com build EAS e envio por EAS Submit ou Apple Transporter
3. Conectar com API Supabase (Sprint M2 do roadmap)
4. Implementar `expo-camera` real na tela `camera.tsx`
5. Integrar push notifications (Expo Notifications + FCM/APNs)
