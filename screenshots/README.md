# Screenshots — App Store (iOS)

Material de captura para a página do app **Mercurio Capital** na App Store Connect.

Os textos de submissão (nome, descrição, palavras-chave, conta demo, App Privacy etc.) estão em [app-store-connect.md](./app-store-connect.md).

## Tamanhos exigidos pela Apple

| Pasta | Dispositivo | Resolução (retrato) | Obrigatório? |
| --- | --- | --- | --- |
| `ios/6.9/` | iPhone 16/17 Pro Max (6,9") | **1320 × 2868 px** | ✅ Sim |
| `ios/6.5/` | iPhone 11 Pro Max / XS Max (6,5") | 1284 × 2778 px | Opcional — se vazio, a Apple redimensiona o 6,9" |
| `ipad/13/` | iPad Pro 13" (M4/M5) | **2048 × 2732 px** | ✅ Sim — o app tem `supportsTablet: true` no `mobile/app.json` |

Regras técnicas: PNG ou JPEG, **sem canal alfa**, orientação retrato, até 10 screenshots por dispositivo/localização. Localização principal: **Português (Brasil)**.

## Como capturar (recomendado: Simulador iOS)

O simulador gera a imagem na resolução exata exigida — melhor que foto do aparelho físico:

```bash
cd mobile
npm run ios   # escolha o simulador "iPhone 17 Pro Max" (ou 16 Pro Max)
# depois repita com "iPad Pro 13-inch (M4)" para as telas de iPad
```

1. Abra o simulador no device certo.
2. Navegue até a tela, com dados de demonstração realistas (nunca dados reais de clientes).
3. `Cmd + S` no simulador → salva o PNG na resolução nativa.
4. Mova para a pasta correspondente com o nome da convenção abaixo.

> ⚠️ Use dados fictícios/seed de demonstração. Screenshots com dados reais de clientes violam privacidade e podem reprovar na revisão.

## Convenção de nome

```
<ordem>-<tela>.png     → 01-dashboard.png, 02-propostas.png, ...
```

A ordem numérica define a ordem na App Store (o 1º é o mais importante — aparece nos resultados de busca).

## Shot list sugerida (10 slots)

| # | Tela (rota no app) | Legenda sugerida (overlay) | Por quê |
| --- | --- | --- | --- |
| 01 | `(parceiro)/dashboard` | "Sua operação de crédito em um painel" | Primeira impressão — KPIs e funil |
| 02 | `(parceiro)/propostas` | "Acompanhe cada proposta em tempo real" | Core do produto |
| 03 | `(parceiro)/simulacoes` | "Simule cenários em segundos" | Feature de venda |
| 04 | `(parceiro)/comissoes` | "Comissões transparentes, sempre" | Dor do parceiro |
| 05 | `(parceiro)/carteira` | "Toda a sua carteira na palma da mão" | Valor contínuo |
| 06 | `(cliente)/propostas` | "Cliente acompanha a proposta pelo app" | Mostra o lado cliente |
| 07 | `(cliente)/documentos` | "Envio de documentos com a câmera" | Justifica permissão de câmera |
| 08 | `(parceiro)/universidade` | "Cursos e certificações para sua equipe" | Diferencial |
| 09 | `(parceiro)/relatorios` | "Relatórios para decidir com dados" | Profundidade |
| 10 | `(parceiro)/perfil` | "Segurança com 2FA e Face ID" | Confiança |

Mínimo viável para submeter: **3 screenshots** no 6,9" e no iPad 13" (sugestão: 01, 02 e 03). Os demais slots podem ser completados depois sem nova revisão de binário.

## Observações

- Legendas/overlay são opcionais; se usadas, montar em ferramenta de design mantendo a identidade visual (vermelho `#DC2626` / fundo escuro `#0F0F0F`, conforme `mobile/app.json` e componentes).
- Se o app rodar em iPad apenas em modo compatibilidade (layout de iPhone ampliado), as screenshots de iPad ainda são obrigatórias — capturar no simulador de iPad mesmo assim.
- App Preview (vídeo de 15–30s) é opcional e pode ser adicionado depois.
