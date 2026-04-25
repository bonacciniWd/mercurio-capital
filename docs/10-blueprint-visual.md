# 10 — Blueprint Visual Completo (Mermaid)

> Visão consolidada antes da geração do SQL. Cada diagrama foca em uma camada do sistema, do mais alto nível ao detalhe.

---

## 1. Visão macro — todos os atores e camadas

```mermaid
flowchart TB
  classDef public fill:#fef3c7,stroke:#d97706,color:#000
  classDef client fill:#dbeafe,stroke:#2563eb,color:#000
  classDef partner fill:#dcfce7,stroke:#16a34a,color:#000
  classDef admin fill:#fee2e2,stroke:#dc2626,color:#000
  classDef edge fill:#ede9fe,stroke:#7c3aed,color:#000
  classDef db fill:#f1f5f9,stroke:#475569,color:#000
  classDef ext fill:#fce7f3,stroke:#be185d,color:#000

  V((Visitante)):::public
  C((Cliente / Lead)):::client
  P((Parceiro)):::partner
  TM((Assistente)):::partner
  A((Admin Mercurio)):::admin

  subgraph FE[Frontend - React SPA]
    direction TB
    LP[Landing / Login / Registro]:::public
    PROTO[Consulta por Protocolo]:::public
    CLI[Portal Cliente /c/*]:::client
    PAR[Painel Parceiro /p/*]:::partner
    ADM[Painel Admin /admin/*]:::admin
  end

  subgraph EDGE[Supabase Edge Functions]
    direction TB
    EAUTH[magic-link issuer/consumer]:::edge
    EWPP[whatsapp evolution]:::edge
    EBUR[bureaus credito/juridico]:::edge
    EOCR[OCR pipeline]:::edge
    ECTR[contratos generator]:::edge
    EPUSH[push notifier]:::edge
    EREP[relatorios xlsx]:::edge
  end

  subgraph CORE[Supabase Core]
    direction TB
    AUTH[(Auth + JWT)]:::db
    DB[(PostgreSQL + RLS)]:::db
    RT[(Realtime)]:::db
    STO[(Storage Buckets)]:::db
  end

  subgraph EXT[Integracoes Externas]
    direction TB
    EVO[Evolution API WhatsApp]:::ext
    BAC[Bacen]:::ext
    SER[SPC/Serasa]:::ext
    JUS[Jusbrasil/Escavador]:::ext
    RIDIG[RI Digital]:::ext
    NAC[Nacional Consultas]:::ext
    SIGN[D4Sign/Clicksign]:::ext
    PAY[Stripe/Asaas]:::ext
    FCM[FCM Push]:::ext
  end

  V --> LP
  V --> PROTO
  C --> CLI
  P --> PAR
  TM --> PAR
  A --> ADM

  LP --> AUTH
  PROTO --> EAUTH
  CLI --> AUTH
  PAR --> AUTH
  ADM --> AUTH

  CLI --> DB
  PAR --> DB
  ADM --> DB
  CLI --> STO
  PAR --> STO
  ADM --> STO
  RT --> CLI
  RT --> PAR
  RT --> ADM

  CLI --> EAUTH
  PAR --> EAUTH
  PAR --> EBUR
  ADM --> EBUR
  PAR --> EOCR
  ADM --> ECTR
  ADM --> EREP
  PROTO --> EAUTH

  EAUTH --> DB
  EWPP --> DB
  EBUR --> DB
  EOCR --> DB
  ECTR --> DB
  EPUSH --> DB
  EREP --> DB

  EAUTH --> EVO
  EWPP --> EVO
  EBUR --> BAC
  EBUR --> SER
  EBUR --> JUS
  EBUR --> RIDIG
  EBUR --> NAC
  ECTR --> SIGN
  EPUSH --> EVO
  EPUSH --> FCM
  CLI -.assinatura.-> PAY
```

---

## 2. Sitemap completo (todas as rotas)

```mermaid
flowchart TB
  classDef pub fill:#fef3c7,stroke:#d97706
  classDef cli fill:#dbeafe,stroke:#2563eb
  classDef par fill:#dcfce7,stroke:#16a34a
  classDef adm fill:#fee2e2,stroke:#dc2626

  ROOT(("/"))

  subgraph PUB[Publicas]
    direction TB
    R0["/"]:::pub
    R1["/login"]:::pub
    R2["/registro"]:::pub
    R2b["/registro/sucesso"]:::pub
    R3["/recuperar-senha"]:::pub
    R3b["/recuperar-senha/confirmar"]:::pub
    R4["/protocolo"]:::pub
    R4b["/protocolo/:numero"]:::pub
    R5["/magic/:token"]:::pub
    R6["/2fa"]:::pub
  end

  subgraph CLIENTE[Cliente /c]
    direction TB
    C0["/c"]:::cli
    C1["/c/propostas"]:::cli
    C2["/c/propostas/:id"]:::cli
    C3["/c/propostas/:id/documentos"]:::cli
    C4["/c/perfil"]:::cli
    C5["/c/notificacoes"]:::cli
    C6["/c/universidade"]:::cli
  end

  subgraph PARC[Parceiro /p]
    direction TB
    P0["/p"]:::par
    P1["/p/dashboard"]:::par
    P2["/p/simulacoes"]:::par
    P2b["/p/simulacoes/nova"]:::par
    P3["/p/propostas"]:::par
    P3b["/p/propostas/nova"]:::par
    P3c["/p/propostas/:id"]:::par
    P3d["...tabs: proponentes, imoveis, documentos, historico, kanban"]:::par
    P4["/p/equipe"]:::par
    P4b["/p/equipe/convidar"]:::par
    P5["/p/relatorios"]:::par
    P6["/p/universidade"]:::par
    P6b["/p/universidade/curso/:slug"]:::par
    P6c["/p/universidade/certificados"]:::par
    P7["/p/perfil"]:::par
    P8["/p/configuracoes"]:::par
  end

  subgraph ADM[Admin /admin]
    direction TB
    A0["/admin"]:::adm
    A1["/admin/dashboard"]:::adm
    A1b["/admin/dashboard/funil"]:::adm
    A1c["/admin/dashboard/gargalos"]:::adm
    A2["/admin/parceiros"]:::adm
    A2b["/admin/parceiros/aprovacoes"]:::adm
    A2c["/admin/parceiros/:id"]:::adm
    A3["/admin/clientes"]:::adm
    A3b["/admin/clientes/:id"]:::adm
    A4["/admin/propostas"]:::adm
    A4b["/admin/propostas/:id"]:::adm
    A4c["/admin/propostas/kanban"]:::adm
    A5["/admin/rede ReactFlow"]:::adm
    A6["/admin/documentos"]:::adm
    A6b["/admin/documentos/pendentes"]:::adm
    A7["/admin/financeiro"]:::adm
    A7b["/admin/financeiro/contratos"]:::adm
    A8["/admin/relatorios"]:::adm
    A9["/admin/universidade"]:::adm
    A9b["/admin/universidade/cursos"]:::adm
    A9c["/admin/universidade/cursos/:id"]:::adm
    A9d["/admin/universidade/assinaturas"]:::adm
    A10["/admin/fluxos"]:::adm
    A10b["/admin/fluxos/:id"]:::adm
    A11["/admin/campanhas"]:::adm
    A12["/admin/integracoes"]:::adm
    A13["/admin/configuracoes"]:::adm
    A14["/admin/auditoria"]:::adm
    A15["/admin/usuarios"]:::adm
  end

  ROOT --> PUB
  R1 --> CLIENTE
  R1 --> PARC
  R1 --> ADM
  R5 --> CLIENTE
  R5 --> PARC
```

---

## 3. RBAC — papéis, escopos e capacidades

```mermaid
flowchart TB
  classDef admin fill:#fee2e2,stroke:#dc2626
  classDef partner fill:#dcfce7,stroke:#16a34a
  classDef team fill:#bbf7d0,stroke:#15803d
  classDef client fill:#dbeafe,stroke:#2563eb
  classDef public fill:#fef3c7,stroke:#d97706

  ADM[Admin]:::admin
  PAR[Parceiro]:::partner
  TM[Assistente]:::team
  CLI[Cliente]:::client
  PUB[Publico]:::public

  ADM --- |aprova| PAR
  PAR --- |gerencia| TM
  PAR --- |origina| CLI

  subgraph CAPS_ADM[Capacidades Admin]
    CA1[Aprovar parceiros]
    CA2[Mudar todos os status]
    CA3[Gerar contratos]
    CA4[Configurar integracoes]
    CA5[Editar fluxos JSON]
    CA6[Auditoria global]
    CA7[Dashboards globais]
    CA8[Gerenciar Universidade]
    CA9[Campanhas]
    CA10[React Flow rede]
  end

  subgraph CAPS_PAR[Capacidades Parceiro]
    CP1[Criar simulacao/proposta]
    CP2[Mudar status ate Proposta ao Cliente]
    CP3[Solicitar docs]
    CP4[Convidar membros]
    CP5[Dashboard proprio]
    CP6[Consultar bureaus com cota]
    CP7[Exportar relatorios proprios]
  end

  subgraph CAPS_TM[Capacidades Assistente]
    CT1[Criar simulacao/proposta]
    CT2[Editar campos limitados]
    CT3[Solicitar docs]
    CT4[Sem mudar status]
  end

  subgraph CAPS_CLI[Capacidades Cliente]
    CC1[Ver suas propostas]
    CC2[Upload de docs solicitados]
    CC3[Receber notificacoes]
    CC4[Universidade se assinante]
  end

  subgraph CAPS_PUB[Capacidades Publico]
    CU1[Login/Registro]
    CU2[Consulta por protocolo limitada]
    CU3[Magic link consume]
  end

  ADM --> CAPS_ADM
  PAR --> CAPS_PAR
  TM --> CAPS_TM
  CLI --> CAPS_CLI
  PUB --> CAPS_PUB
```

---

## 4. Modelo entidade-relacionamento (completo)

```mermaid
erDiagram
  USUARIOS ||--o| PARTNERS : "perfil parceiro"
  USUARIOS ||--o| CLIENTES : "perfil cliente"
  USUARIOS ||--o{ EQUIPE_MEMBROS : participa
  USUARIOS ||--o{ SESSOES_2FA : possui
  USUARIOS ||--o{ PUSH_DEVICES : registra
  USUARIOS ||--o{ NOTIFICACOES : recebe
  USUARIOS ||--o{ INSCRICOES : "Universidade"
  USUARIOS ||--o{ ASSINATURAS_UNIVERSIDADE : assina
  USUARIOS ||--o{ AUDIT_LOG : gera

  PARTNERS ||--o{ PARTNER_DOCUMENTOS : envia
  PARTNERS ||--o{ EQUIPES : possui
  PARTNERS ||--o{ PROPOSTAS : origina
  PARTNERS ||--o{ COMISSOES : recebe

  EQUIPES ||--o{ EQUIPE_MEMBROS : tem
  EQUIPES ||--o{ PROPOSTAS : atende

  CLIENTES ||--o{ PROPONENTES : "figura como"
  CLIENTES ||--o{ PROPOSTAS : "tomador principal"

  PROPOSTAS ||--|| SIMULACOES : "originada de (opcional)"
  PROPOSTAS ||--o{ PROPONENTES : possui
  PROPOSTAS ||--o{ IMOVEIS : possui
  PROPOSTAS ||--o{ PROPOSTA_DOCUMENTOS : anexa
  PROPOSTAS ||--o{ PROPOSTA_PENDENCIAS : tem
  PROPOSTAS ||--o{ PROPOSTA_STATUS_HISTORICO : registra
  PROPOSTAS ||--o| CONTRATOS : gera
  PROPOSTAS ||--o{ COMISSOES : gera
  PROPOSTAS ||--o{ WHATSAPP_MENSAGENS : envia
  PROPOSTAS ||--o{ LIBERACOES_RECURSO : recebe

  PROPONENTES }o--o{ IMOVEIS : "imovel_proprietarios"
  PROPONENTES ||--o{ PROPOSTA_DOCUMENTOS : anexa

  IMOVEIS ||--o{ PROPOSTA_DOCUMENTOS : anexa

  CONTRATOS ||--o{ ASSINATURAS_CONTRATO : possui

  CURSOS ||--o{ MODULOS : tem
  MODULOS ||--o{ CAPITULOS : tem
  CAPITULOS ||--o{ AULAS : tem
  CURSOS ||--o{ INSCRICOES : recebe
  INSCRICOES ||--o{ AULA_PROGRESSO : registra
  INSCRICOES ||--o| CERTIFICADOS : emite

  FLUXOS_EVOLUTION ||--o{ FLUXO_EXECUCOES : executa
  CAMPANHAS ||--o{ WHATSAPP_MENSAGENS : dispara
  MAGIC_LINKS }o--o{ USUARIOS : "destinado a"
  LOGS_CONSULTAS }o--|| USUARIOS : "feita por"
```

---

## 5. Domínios e suas tabelas (mapa visual)

```mermaid
mindmap
  root((Mercurio<br/>PostgreSQL))
    Identidade
      usuarios
      partners
      partner_documentos
      equipes
      equipe_membros
      clientes
      magic_links
      sessoes_2fa
    Originacao
      simulacoes
      propostas
      proponentes
      imoveis
      imovel_proprietarios
      proposta_documentos
      proposta_pendencias
      proposta_status_historico
    Operacoes
      contratos
      assinaturas_contrato
      liberacoes_recurso
      comissoes
    Universidade
      cursos
      modulos
      capitulos
      aulas
      inscricoes
      aula_progresso
      certificados
      assinaturas_universidade
    Integracoes
      logs_consultas
      consultas_bacen
      consultas_serasa
      consultas_juridicas
      ri_digital_matriculas
      whatsapp_mensagens
      fluxos_evolution
      fluxo_execucoes
    Plataforma
      notificacoes
      push_devices
      audit_log
      configuracoes_sistema
      feature_flags
      campanhas
      rate_limits
```

---

## 6. Jornada completa — registro do parceiro até liberacao do recurso

```mermaid
sequenceDiagram
  autonumber
  actor PA as Parceiro
  actor AD as Admin
  actor CL as Cliente
  participant FE as Frontend
  participant DB as Postgres
  participant EF as Edge Functions
  participant EVO as Evolution
  participant BUR as Bureaus
  participant SIG as D4Sign

  PA->>FE: registro + upload docs
  FE->>DB: insert partners (pending) + partner_documentos
  AD->>FE: revisa em /admin/parceiros/aprovacoes
  AD->>DB: update partners.status=approved
  DB-->>EF: trigger
  EF->>EVO: WhatsApp "aprovado"
  EVO-->>PA: notificacao

  PA->>FE: nova proposta (wizard)
  FE->>DB: insert propostas + proponentes + imoveis
  DB-->>EF: trigger criar magic_link
  EF->>DB: insert magic_links (hash)
  EF->>EVO: WhatsApp magic link
  EVO-->>CL: link
  CL->>FE: /magic/:token
  FE->>EF: consume
  EF->>DB: ativa cliente, marca used_at
  CL->>FE: /c/propostas/:id

  Note over DB,EF: Esteira de status
  AD->>DB: status=analise_credito
  DB-->>EF: trigger
  EF->>BUR: serasa/bacen
  BUR-->>EF: resposta
  EF->>DB: logs_consultas
  AD->>DB: status=analise_juridica
  EF->>BUR: jusbrasil
  AD->>DB: status=comite
  AD->>DB: status=proposta_cliente
  EF->>EVO: avisa cliente
  CL->>FE: aceita
  AD->>DB: status=emissao_contrato
  EF->>SIG: cria envelope
  CL->>SIG: assina
  SIG-->>EF: webhook signed
  EF->>DB: status=em_registro -> contrato_registrado
  AD->>DB: status=recurso_liberado
  EF->>EVO: parabeniza ambos
```

---

## 7. State machine — esteira da proposta

```mermaid
stateDiagram-v2
  direction LR
  [*] --> Simulacao
  Simulacao --> PreAnalise: converter (partner)
  PreAnalise --> AnaliseCredito: admin
  AnaliseCredito --> AnaliseImovel: admin
  AnaliseImovel --> AnaliseJuridica: admin
  AnaliseJuridica --> Comite: admin
  Comite --> PropostaCliente: admin
  PropostaCliente --> ResolucaoPendencias: pendencias
  ResolucaoPendencias --> EmissaoContrato: admin
  PropostaCliente --> EmissaoContrato: aprovada
  EmissaoContrato --> AguardandoAssinatura: admin
  AguardandoAssinatura --> EmRegistro: webhook D4Sign
  EmRegistro --> ContratoRegistrado: admin
  ContratoRegistrado --> RecursoLiberado: admin
  RecursoLiberado --> [*]

  state Cancelado
  Simulacao --> Cancelado
  PreAnalise --> Cancelado
  AnaliseCredito --> Cancelado
  AnaliseImovel --> Cancelado
  AnaliseJuridica --> Cancelado
  Comite --> Cancelado
  PropostaCliente --> Cancelado
  ResolucaoPendencias --> Cancelado
  Cancelado --> [*]
```

---

## 8. Wizard de criacao de proposta (UX detalhada)

```mermaid
flowchart TB
  S1[1. Produto e Pessoa<br/>Home Equity / Construcao / Financ.<br/>PF ou PJ]
  S2[2. Dados do cliente<br/>nome, CPF/CNPJ, email,<br/>tel DDI, nascimento,<br/>estado civil]
  S3[3. Localizacao do imovel<br/>CEP, estado, cidade,<br/>bairro, rua, numero]
  S4[4. Valores e prazo<br/>credito desejado,<br/>valor imovel,<br/>correcao pos/pre,<br/>amortizacao Price/SAC,<br/>prazo 12-240,<br/>carencia 0-3]
  S5{5. Estado civil casado?}
  S5a[5a. Cadastrar conjuge]
  S5b[5b. Outros proponentes opcionais]
  S6[6. Imoveis<br/>tipo, endereco,<br/>valor, vagas,<br/>alugado/financiado,<br/>debitos,<br/>proprietarios]
  S7[7. Revisao final]
  S8[(salvar proposta)]
  S9[(gerar protocolo)]
  S10[(gerar magic link)]
  S11[(WhatsApp + email)]

  S1 --> S2 --> S3 --> S4 --> S5
  S5 -- sim --> S5a --> S5b
  S5 -- nao --> S5b
  S5b --> S6 --> S7 --> S8 --> S9 --> S10 --> S11
  S7 -. salvar rascunho .-> S1
```

---

## 9. Detalhe da proposta (tabs e dados)

```mermaid
flowchart LR
  subgraph TABS[/p/propostas/:id]
    T1[Resumo]
    T2[Proponentes]
    T3[Imoveis]
    T4[Documentos]
    T5[Historico]
    T6[Kanban]
  end

  T1 --> R1[Tag PF/PJ]
  T1 --> R2[Cliente, valor solicitado, valor imoveis]
  T1 --> R3[Prazo, juros 1.39%+IPCA, carencia]
  T1 --> R4[Tabela Price calculada]
  T1 --> R5[Produto: Home Equity / Construcao / Financiamento]
  T1 --> R6[Dados vendedor se Financiamento]

  T2 --> P1[Lista proponentes]
  T2 --> P2[Adicionar conjuge/socio]
  T2 --> P3[Vincular como proprietario]

  T3 --> I1[Lista imoveis]
  T3 --> I2[Adicionar imovel + busca CEP]
  T3 --> I3[Caracteristicas + vagas + valor BRL]
  T3 --> I4[Alugado/Financiado/Debitos]
  T3 --> I5[Toggle endereco do proponente]

  T4 --> D1[PF / PJ / Imovel]
  T4 --> D2[Upload + validacao]
  T4 --> D3[Solicitar ao cliente]
  T4 --> D4[OCR opcional]

  T5 --> H1[proposta_status_historico]
  T5 --> H2[whatsapp_mensagens]
  T5 --> H3[audit_log filtrado]

  T6 --> K1[Cartao por status]
  T6 --> K2[Drag-drop respeitando RBAC]
```

---

## 10. Storage — buckets, conteudo e politicas

```mermaid
flowchart TB
  classDef priv fill:#fee2e2,stroke:#dc2626
  classDef pub fill:#dcfce7,stroke:#16a34a

  subgraph BUCKETS[Supabase Storage]
    B1[partner-docs]:::priv
    B2[proposta-docs]:::priv
    B3[contratos]:::priv
    B4[cursos-videos]:::priv
    B5[certificados]:::priv
    B6[protocolo-uploads]:::priv
    B7[cursos-capas]:::pub
    B8[avatares]:::pub
  end

  ADM[Admin] -->|read/write| B1
  ADM --> B2
  ADM --> B3
  ADM --> B5
  ADM --> B6

  PAR[Parceiro dono] -->|read/write proprio| B1
  PAR --> B2

  CLI[Cliente vinculado] -->|read/write proprio| B2

  PROTO[Visitante via protocolo] -.signed URL.-> B6

  INSC[Inscrito] -.signed URL.-> B4
  CERT[Dono certificado] -.signed URL.-> B5

  ANY[Qualquer] --> B7
  ANY --> B8
```

---

## 11. Edge Functions — catalogo e gatilhos

```mermaid
flowchart LR
  subgraph TRIG[Gatilhos]
    G1[trigger Postgres status_changed]
    G2[trigger Postgres pendencia_aberta]
    G3[trigger Postgres partner_aprovado]
    G4[invoke do front]
    G5[webhook externo]
    G6[cron]
  end

  subgraph EFS[Edge Functions]
    F1[magic-link/issue]
    F2[magic-link/consume]
    F3[evolution/send]
    F4[evolution/webhook]
    F5[bacen/cpf]
    F6[serasa/consultar]
    F7[juridico/consultar]
    F8[ri-digital/matricula]
    F9[cep/lookup]
    F10[ocr/processar]
    F11[protocolo/consulta]
    F12[protocolo/upload-url]
    F13[notifications/push]
    F14[relatorios/exportar]
    F15[contratos/gerar]
    F16[contratos/assinatura/webhook]
    F17[fluxos/executar]
    F18[lgpd/export]
    F19[lgpd/anonimizar]
  end

  G1 --> F3
  G1 --> F13
  G1 --> F17
  G2 --> F3
  G3 --> F3
  G4 --> F1
  G4 --> F5
  G4 --> F6
  G4 --> F9
  G4 --> F10
  G4 --> F11
  G4 --> F12
  G4 --> F14
  G4 --> F15
  G4 --> F18
  G5 --> F4
  G5 --> F16
  G6 --> F7
  G6 --> F13
```

---

## 12. Magic link — ciclo de vida

```mermaid
stateDiagram-v2
  [*] --> Emitido: issue (token + hash + expires)
  Emitido --> Enviado: WhatsApp/email
  Enviado --> Consumido: /magic/:token
  Enviado --> Expirado: now > expires_at
  Enviado --> Bloqueado: tentativas > 5
  Consumido --> [*]
  Expirado --> [*]
  Bloqueado --> [*]
```

---

## 13. Consulta publica por protocolo (zero PII)

```mermaid
sequenceDiagram
  actor V as Visitante
  participant FE as Frontend
  participant CAP as Turnstile
  participant EF as Edge: protocolo
  participant DB as Postgres
  participant ST as Storage protocolo-uploads

  V->>FE: protocolo + CAPTCHA
  FE->>CAP: token
  CAP-->>FE: ok
  FE->>EF: POST consulta
  EF->>EF: rate-limit por IP
  EF->>DB: select status, etapa, pendencias
  EF-->>FE: payload SEM PII
  alt pendencia aceita upload publico
    FE->>EF: POST upload-url
    EF->>ST: signed URL 5 min
    EF-->>FE: url
    V->>ST: PUT arquivo
    ST-->>EF: trigger
    EF->>DB: insert proposta_documentos origem=protocolo
  end
```

---

## 14. RLS — modelo de aplicacao

```mermaid
flowchart LR
  REQ[Request com JWT] --> CLAIMS{Extrai claims<br/>role, partner_id,<br/>equipe_id, approved}
  CLAIMS -->|admin| OK1[Acesso total]
  CLAIMS -->|partner approved| F1{Filtro:<br/>partner_id = jwt.partner_id}
  CLAIMS -->|team_member| F2{Filtro:<br/>equipe_id = jwt.equipe_id<br/>+ permissoes overrides}
  CLAIMS -->|client| F3{Filtro:<br/>cliente_user_id = jwt.uid<br/>OU proponentes.cliente.user = jwt.uid}
  CLAIMS -->|public| DENY1[deny exceto whitelist]
  CLAIMS -->|partner pending| DENY2[acesso so a /p/onboarding]
  F1 --> ROW[(linha visivel)]
  F2 --> ROW
  F3 --> ROW
  OK1 --> ROW
```

---

## 15. Universidade Mercurio — hierarquia e progresso

```mermaid
flowchart TB
  C[Curso<br/>gratuito ou requer_assinatura] --> M[Modulo]
  M --> CA[Capitulo]
  CA --> AU[Aula video/texto/quiz]

  U[Usuario] --> INS[Inscricao]
  INS --> AP[aula_progresso por aula]
  AP --> CALC[recalcula progresso_pct]
  CALC -->|>= criterio| EM[Emissao certificado]
  EM --> PDF[PDF assinado em storage]
  EM --> COD[codigo_validacao publico]
```

---

## 16. Fluxos Evolution (JSON) e execucao

```mermaid
flowchart LR
  ADM[Admin editor] --> JSON[(fluxos_evolution<br/>definicao_json)]
  EVT[Evento trigger] --> ENG[Engine executar]
  JSON --> ENG
  ENG --> COND{condicional}
  COND -->|sim| TPL[envia template Evolution]
  COND -->|nao| SKIP[ignora]
  TPL --> EVO[Evolution API]
  EVO --> WPP[(whatsapp_mensagens)]
  ENG --> EXEC[(fluxo_execucoes)]
  EXEC --> AUD[(audit_log)]
```

---

## 17. Notificacoes (multi-canal)

```mermaid
flowchart TB
  EVT[Evento de dominio] --> DESP[Despachante]
  DESP --> CANAL{canais habilitados}
  CANAL --> WPP[WhatsApp via Evolution]
  CANAL --> EMAIL[E-mail SMTP]
  CANAL --> PUSH[FCM Push web/app]
  CANAL --> INAPP[(notificacoes tabela)]
  INAPP --> RT[Realtime para front]
  RT --> UI[Bandeja in-app]
  WPP --> USR((Usuario))
  EMAIL --> USR
  PUSH --> USR
  UI --> USR
```

---

## 18. React Flow — rede de originacao (admin)

```mermaid
flowchart LR
  AD[Admin Mercurio] --> P1[Parceiro A]
  AD --> P2[Parceiro B]
  AD --> P3[Parceiro C pending]
  P1 --> EQA[Equipe Alpha]
  P1 --> EQB[Equipe Beta]
  P2 --> EQC[Equipe Gama]
  EQA --> M1[Membro 1]
  EQA --> M2[Membro 2]
  EQB --> M3[Membro 3]
  EQC --> M4[Membro 4]
  M1 --> L1[Lead 101]
  M2 --> L2[Lead 102]
  M3 --> L3[Lead 103]
  M4 --> L4[Lead 201]
  L1 --> PR1[(Proposta 101 - Comite)]
  L2 --> PR2[(Proposta 102 - Aguard. Assin.)]
  L3 --> PR3[(Proposta 103 - Pre-analise)]
  L4 --> PR4[(Proposta 201 - Recurso Liberado)]
```

---

## 19. Dashboards — composicao de KPIs

```mermaid
flowchart TB
  subgraph PARTNER_DASH[Dashboard Parceiro]
    D1[Taxa de conversao]
    D2[Ticket medio]
    D3[Contratos assinados]
    D4[Funil simulacoes -> contratos]
    D5[Gargalos por etapa]
    D6[Resumo por status: em analise / concluidas / canceladas]
    D7[Filtros: produto, equipe, responsavel, data]
  end

  subgraph ADMIN_DASH[Dashboard Admin]
    A1[Volume global por produto]
    A2[Funil global]
    A3[Gargalos macro]
    A4[Financeiro: contratos, comissoes]
    A5[Por fundo / status]
    A6[Por originador]
    A7[Documentos pendentes]
    A8[Performance por colaborador]
  end

  DB[(Postgres views materializadas)] --> PARTNER_DASH
  DB --> ADMIN_DASH
```

---

## 20. Carteira do parceiro \u2014 modelo l\u00f3gico

```mermaid
erDiagram
  PARTNERS ||--|| PARTNER_WALLETS : "1:1"
  PARTNER_WALLETS ||--o{ WALLET_LEDGER : "append-only"
  PARTNER_WALLETS ||--o{ WALLET_TOPUPS : recebe
  WALLET_TOPUPS ||--|| STRIPE_PAYMENT_INTENTS : "1:1"
  WALLET_LEDGER }o--|| WALLET_TOPUPS : "tipo=recarga"
  WALLET_LEDGER }o--|| LOGS_CONSULTAS : "tipo=debito_consulta/estorno"
  PRECOS_CONSULTA ||--o{ LOGS_CONSULTAS : tarifa
```

## 21. Recarga e d\u00e9bito \u2014 fluxos detalhados

```mermaid
sequenceDiagram
  autonumber
  actor PA as Parceiro
  participant FE as Frontend
  participant EF as Edge: wallet/topup
  participant ST as Stripe
  participant WH as Edge: stripe/webhook
  participant DB as Postgres

  rect rgb(220,252,231)
  Note over PA,DB: Recarga
  PA->>FE: escolhe valor (ex R$ 100)
  FE->>EF: POST {valor}
  EF->>ST: createPaymentIntent
  ST-->>EF: pi_xxx + client_secret
  EF->>DB: insert wallet_topups (status=requires_payment_method)
  EF->>DB: insert stripe_payment_intents
  EF-->>FE: client_secret
  PA->>ST: paga via Elements
  ST-->>WH: evt payment_intent.succeeded
  WH->>DB: insert stripe_webhooks_inbox (idempotente)
  WH->>DB: select wallet_credit('recarga', valor, ...)
  WH->>DB: update wallet_topups.status=succeeded + ledger_id
  WH-->>PA: push + email "saldo atualizado"
  end
```

```mermaid
sequenceDiagram
  autonumber
  actor PA as Parceiro
  participant FE as Frontend
  participant EF as Edge: bureaus/serasa
  participant DB as Postgres
  participant EXT as Serasa

  PA->>FE: clica "Consultar Serasa"
  FE->>EF: POST {cpf, proposta_id}
  EF->>DB: SELECT preco_centavos FROM precos_consulta WHERE tipo='serasa_pf' AND vigente_ate IS NULL
  EF->>DB: BEGIN; SET TRANSACTION SERIALIZABLE
  EF->>DB: SELECT wallet_debit(partner_id,'debito_consulta',preco,...)
  alt saldo_insuficiente
    DB-->>EF: exception
    EF-->>FE: 402 {erro, preco, saldo}
    FE-->>PA: "Saldo insuficiente. Recarregar"
  else saldo ok
    DB-->>EF: ledger_entry
    EF->>EXT: requisicao
    alt sucesso
      EXT-->>EF: payload
      EF->>DB: insert logs_consultas (ledger_id)
      EF->>DB: COMMIT
      EF-->>FE: resultado
    else erro externo
      EXT-->>EF: 5xx
      EF->>DB: SELECT wallet_credit('estorno',preco,correlation_id)
      EF->>DB: COMMIT
      EF-->>FE: 502 com aviso de estorno
    end
  end
```

## 22. State machine \u2014 entrada do ledger

```mermaid
stateDiagram-v2
  [*] --> recarga: payment_intent.succeeded
  [*] --> debito_consulta: wallet_debit ok
  [*] --> ajuste_credito: admin manual
  [*] --> ajuste_debito: admin manual
  debito_consulta --> estorno: erro externo (mesmo correlation_id)
  recarga --> [*]
  estorno --> [*]
  ajuste_credito --> [*]
  ajuste_debito --> [*]
```

## 23. Resumo dos artefatos a serem gerados (pr\u00f3ximos passos)

```mermaid
flowchart LR
  M[Mapas Mermaid OK] --> SQL[Migrations SQL<br/>schema + enums + tabelas]
  SQL --> RLS[Policies RLS<br/>por papel e tabela]
  RLS --> TRG[Triggers + funcoes<br/>status, audit, totais]
  TRG --> EF[Edge Functions skeletons<br/>magic-link, evolution, bureaus]
  EF --> SEEDS[Seeds<br/>configuracoes, fluxos, curso inicial]
  SEEDS --> FE[Front bootstrap<br/>routes, layouts, guards]
  FE --> ITER[Iteracao por modulo<br/>M1 -> M12]
```
