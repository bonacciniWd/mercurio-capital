# App Store Connect — Textos e campos da submissão

Tudo que a Apple pede para publicar o **Mercurio Capital** (`com.mercuriocapital.app`), já redigido. Campos que só o dono pode preencher estão marcados com `[PREENCHER]`. Pontos de decisão estão marcados com `⚖️ DECISÃO`.

> Idioma principal da loja: **Português (Brasil)**. Demais idiomas: não configurar no lançamento.

---

## 1. Informações do app (App Information)

| Campo | Valor |
| --- | --- |
| Nome | `Mercurio Capital` (16/30 caracteres) — ⚖️ DECISÃO: manter sem acento (igual ao bundle) ou usar `Mercúrio Capital` na loja |
| Subtítulo (máx. 30) | `Crédito com parceiros, na mão` (29 caracteres) |
| Categoria primária | **Finanças** |
| Categoria secundária | **Negócios** |
| Disponibilidade | ⚖️ DECISÃO: sugerido **somente Brasil** (produto em pt-BR, operação local) |
| Preço | Gratuito, sem compras no app |
| ID do pacote | `com.mercuriocapital.app` (já existente) |
| SKU | `mercurio-capital-ios` (interno, não aparece na loja) |

### URLs

| Campo | Valor |
| --- | --- |
| URL da política de privacidade (obrigatória) | `https://mercuriocapitalsa.com.br/politica-de-privacidade` ✅ (rota pública já existente — `app/src/router.tsx:133`) |
| URL de suporte (obrigatória) | `https://mercuriocapitalsa.com.br` — ⚖️ DECISÃO: idealmente criar página/seção de suporte ou contato; hoje o app diz "canal de atendimento ainda não configurado" |
| URL de marketing (opcional) | `https://mercuriocapitalsa.com.br` |

---

## 2. Texto promocional (máx. 170 caracteres — atualizável sem nova revisão)

```
Origine propostas de crédito, acompanhe comissões e gerencie sua equipe de parceiros. Clientes acompanham tudo pelo app, com segurança e transparência.
```

(158 caracteres)

---

## 3. Descrição (máx. 4.000 caracteres)

```
O Mercurio Capital é o aplicativo da plataforma de originação de crédito da Mercúrio Capital — Home Equity, Crédito para Construção e Financiamento.

PARA PARCEIROS
• Origine propostas de crédito com wizard guiado em poucos passos
• Monte simulações e prévias comerciais na hora
• Acompanhe o funil e o status de cada proposta em tempo real
• Veja suas comissões e o desempenho da sua carteira
• Gerencie sua equipe de assistentes com permissões dedicadas
• Acesse relatórios, cursos e certificações na Universidade

PARA CLIENTES
• Acompanhe sua proposta a qualquer momento, direto no app
• Envie documentos com segurança usando a câmera do aparelho
• Receba notificações sobre o andamento da sua operação
• Acesse tudo com magic link, sem complicação

SEGURANÇA
• Autenticação com verificação em duas etapas (2FA) e Face ID
• Seus dados protegidos por criptografia e controle de acesso rigoroso
• Política de privacidade pública e transparente

O Mercurio Capital conecta parceiros, equipes e clientes em uma operação de crédito mais rápida, transparente e profissional.

Baixe agora e eleve o nível da sua operação.
```

---

## 4. Palavras-chave (máx. 100 caracteres, separadas por vírgula, sem espaços desnecessários)

```
crédito,home equity,financiamento,construção,parceiro,proposta,simulação,comissão,imóvel,garantia
```

(98 caracteres)

---

## 5. Classificação indicativa (Age Rating)

Questionário da Apple — respostas sugeridas:

| Pergunta | Resposta |
| --- | --- |
| Conteúdo violento, sexual, drogas, álcool, jogo, horror etc. | **Nenhum** em todas |
| Acesso irrestrito à web | **Não** |
| Concursos/sorteios | **Não** |

Classificação esperada: **4+**.

---

## 6. App Review (Informações para a equipe de revisão)

### Contato

| Campo | Valor |
| --- | --- |
| Nome | `[PREENCHER]` |
| Sobrenome | `[PREENCHER]` |
| Telefone | `[PREENCHER — com DDI +55, o revisor pode ligar]` |
| E-mail | `[PREENCHER — caixa monitorada durante a revisão]` |

### ⚠️ Conta de demonstração (OBRIGATÓRIA — o app exige login)

Sem conta demo funcional, a Apple **reprova** a submissão. Preparar antes de submeter:

| Campo | Valor |
| --- | --- |
| E-mail | `[PREENCHER — ex: review@mercuriocapitalsa.com.br]` |
| Senha | `[PREENCHER]` |

Requisitos da conta demo (checklist pré-submissão):

- [ ] Perfil **parceiro aprovado** (acesso completo às telas principais)
- [ ] **2FA desativado** nesta conta (o revisor não terá o autenticador) — ou instrução clara de bypass
- [ ] Dados fictícios populados: propostas em estágios variados, comissões, equipe, simulações
- [ ] Nenhum dado real de cliente, parceiro ou consulta Serasa
- [ ] Confirmar que o login funciona na **build enviada** (a mesma do TestFlight)

### Notas para o revisor (Review Notes) — rascunho

```
EN: Mercurio Capital is a credit-origination platform for partners (brokers) and their
clients in Brazil. Please sign in with the demo partner account provided — it is
pre-loaded with fictional proposals, commissions and team data.

The app requests camera access to let users capture documents for credit proposals
(can be tested in the Documents section). Face ID is optional and only unlocks an
existing local session. Client-area access uses magic links sent by our operation
team; the demo account covers the partner area, which is the core of the app.

No real credit-bureau queries or financial transactions are performed in the app.
All data shown with the demo account is fictional.

PT: App de originação de crédito para parceiros e clientes. Use a conta demo de
parceiro fornecida — os dados são fictícios. A câmera é usada para captura de
documentos; o Face ID é opcional. Nenhuma consulta real a birôs de crédito é
feita no app.
```

---

## 7. App Privacy (rótulo de privacidade — "nutrition label")

Rascunho com base no que o app coleta de fato (validar com o responsável antes de submeter):

| Tipo de dado | Coleta? | Vinculado ao usuário? | Finalidade |
| --- | --- | --- | --- |
| Contato — e-mail, nome | ✅ | Sim | Funcionalidade do app (login, perfil) |
| Identificadores — ID de usuário | ✅ | Sim | Funcionalidade do app |
| Conteúdo do usuário — fotos/documentos pela câmera | ✅ | Sim | Funcionalidade do app (envio de documentos da proposta) |
| Informações financeiras — dados de propostas/simulações | ✅ | Sim | Funcionalidade do app |
| Dados de diagnóstico/uso | ⚖️ DECISÃO — verificar se há analytics no mobile |
| Rastreamento entre apps (ATT) | **Não** | — | — |

> ⚠️ Este rótulo é declaração legal. Cruzar com `docs/operacao/politica-privacidade-publica.md` antes de submeter.

---

## 8. Conformidade de exportação (criptografia)

`ITSAppUsesNonExemptEncryption = false` já está no `mobile/app.json`. Responder no fluxo de submissão:

> "O app usa apenas criptografia padrão do sistema (HTTPS/ATS, Keychain/SecureStore). Isento de documentação adicional."

Sem ação extra necessária.

---

## 9. Informações da versão (0.0.2 — build 13)

### O que há de novo (máx. 4.000 caracteres)

```
Bem-vindo ao Mercurio Capital!

Primeira versão do nosso app para iOS:

• Dashboard do parceiro com indicadores da operação
• Originação de propostas com wizard guiado
• Simulações de crédito na palma da mão
• Comissões, carteira e relatórios
• Área do cliente com acompanhamento de proposta e envio de documentos
• Universidade com cursos e certificações
• Segurança com 2FA e Face ID
```

> ⚖️ DECISÃO: a versão pública exibida na loja hoje é `0.0.2`. Para o lançamento público, considerar promover para `1.0.0` (bump em `mobile/app.json` + novo build EAS, com go/no-go separado conforme AGENTS.md §12).

### Screenshots

Ver [README.md](./README.md) — obrigatórios 6,9" e iPad 13" (o app declara suporte a iPad).

---

## 10. Resumo do que falta antes de submeter

1. [ ] Capturar screenshots (mín. 3 por dispositivo obrigatório) → pasta `screenshots/`
2. [ ] Criar e popular a **conta demo** + validar login nela na build 13
3. [ ] Preencher contato do revisor (seção 6)
4. [ ] ⚖️ Decidir: nome com/sem acento, disponibilidade (Brasil?), versão pública (0.0.2 vs 1.0.0)
5. [ ] Validar rótulo App Privacy contra a política de privacidade
6. [ ] Definir URL de suporte definitiva
7. [ ] Submeter = **ação de release → exige go/no-go explícito do dono** (AGENTS.md §12)
