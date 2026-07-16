# 05 — Mapa Visual da Aplicação

Diagramas em Mermaid (renderizam direto no GitHub/VS Code).

## 1. Sitemap por perfil

```mermaid
flowchart TB
  subgraph Public["🌐 Público"]
    P0[/"/ Landing"/]
    P1[/p/login/]
    P1a["/login (alias)"]
    P2[/registro/]
    P3[/recuperar-senha/]
    P4[/protocolo/]
    P5[/magic/:token/]
  end

  subgraph Client["👤 Cliente"]
    C0[/c Início/]
    C1[/c/propostas/]
    C2[/c/propostas/:id/]
    C3[/c/propostas/:id/documentos/]
    C4[/c/perfil/]
    C5[/c/notificacoes/]
    C6[/c/universidade/]
  end

  subgraph Partner["🤝 Parceiro / Assistente"]
    PA0[/p Início/]
    PA1[/p/dashboard/]
    PA2[/p/simulacoes/]
    PA3[/p/propostas/]
    PA4[/p/propostas/nova/]
    PA5[/p/propostas/:id/]
    PA6[/p/equipe/]
    PA7[/p/relatorios/]
    PA8[/p/universidade/]
    PA9[/p/configuracoes/]
  end

  subgraph Admin["🛡 Admin"]
    A0[/admin Dashboard/]
    A1[/admin/parceiros/]
    A2[/admin/clientes/]
    A3[/admin/propostas/]
    A4[/admin/rede ReactFlow/]
    A5[/admin/documentos/]
    A6[/admin/financeiro/]
    A7[/admin/universidade/]
    A8[/admin/fluxos/]
    A9[/admin/campanhas/]
    A10[/admin/integracoes/]
    A11[/admin/auditoria/]
  end

  P1a --> P1
  P1 --> C0
  P1 --> PA0
  P1 --> A0
  P5 --> C0
  P5 --> PA0
  PA3 --> PA5
  PA5 --> PA3
  A3 --> A4
```

`/p/simulacoes` é uma ferramenta local: parâmetros → cálculo Price/SAC → card exportável/`wa.me` → draft de sessão → `/p/propostas/nova`. Nenhum envio transacional ou linha de banco é criado antes da conclusão do wizard.

## 2. Jornada do parceiro (registro → originação)

```mermaid
sequenceDiagram
  autonumber
  actor PA as Parceiro
  participant FE as Frontend
  participant SB as Supabase Auth
  participant DB as Postgres
  participant ADM as Admin
  participant EF as Edge Functions
  participant EVO as Evolution API
  actor CL as Cliente

  PA->>FE: Preenche /registro
  FE->>SB: signUp(email, senha)
  SB-->>FE: user_id
  FE->>DB: insert partners(status=pending)
  PA->>FE: Upload documentos (autenticado)
  FE->>DB: insert partner_documentos
  ADM->>FE: /admin/parceiros/aprovacoes
  ADM->>DB: update partners.status=approved
  DB-->>EF: trigger notificacao
  EF->>EVO: WhatsApp "Cadastro aprovado"
  PA->>FE: Login → /p
  PA->>FE: Nova Proposta (PropostaWizard)
  FE->>DB: insert propostas + proponentes + imoveis
  DB-->>EF: trigger magic_link_cliente
  EF->>DB: insert magic_links (hash)
  EF->>EVO: WhatsApp magic link
  CL->>FE: /magic/:token
  FE->>EF: consume token
  EF->>SB: cria sessão cliente
  CL->>FE: /c/propostas/:id
```

## 3. Esteira da proposta (status flow)

```mermaid
stateDiagram-v2
  [*] --> Simulacao
  Simulacao --> PreAnalise: converter
  PreAnalise --> AnaliseJuridica
  AnaliseJuridica --> AnaliseCredito
  AnaliseCredito --> AnaliseImovel
  AnaliseImovel --> Comite
  Comite --> PropostaCliente
  PropostaCliente --> DiligenciaJuridica
  DiligenciaJuridica --> EmissaoContrato
  EmissaoContrato --> AguardandoAssinatura
  AguardandoAssinatura --> ProtocoloCartorio: assinado
  ProtocoloCartorio --> ExigenciasCartorio
  ExigenciasCartorio --> CustasCartorio
  CustasCartorio --> RegistroAF
  RegistroAF --> RecursoLiberado
  RecursoLiberado --> PagamentoComissao
  PagamentoComissao --> Completo
  Completo --> [*]
  PreAnalise --> Cancelado
  AnaliseCredito --> Cancelado
  AnaliseImovel --> Cancelado
  AnaliseJuridica --> Cancelado
  Comite --> Cancelado
  PropostaCliente --> Cancelado
  DiligenciaJuridica --> Cancelado
  Cancelado --> [*]
```

Contradição resolvida: o fluxo antigo terminava em `contrato_registrado`/`recurso_liberado`. Esses valores permanecem legados; o alvo inclui cartório, comissão e terminal positivo `completo`.

## 4. ER simplificado (núcleo)

```mermaid
erDiagram
  USUARIOS ||--o| PARTNERS : "1 perfil"
  USUARIOS ||--o| CLIENTES : "1 perfil"
  PARTNERS ||--o{ EQUIPES : possui
  EQUIPES ||--o{ EQUIPE_MEMBROS : tem
  USUARIOS ||--o{ EQUIPE_MEMBROS : participa
  PARTNERS ||--o{ PROPOSTAS : origina
  EQUIPES ||--o{ PROPOSTAS : atende
  CLIENTES ||--o{ PROPOSTAS : tomador
  PROPOSTAS ||--o{ PROPONENTES : possui
  PROPOSTAS ||--o{ IMOVEIS : possui
  PROPONENTES }o--o{ IMOVEIS : "imovel_proprietarios"
  PROPOSTAS ||--o{ PROPOSTA_DOCUMENTOS : anexa
  PROPOSTAS ||--o{ PROPOSTA_PENDENCIAS : tem
  PROPOSTAS ||--o{ PROPOSTA_STATUS_HISTORICO : registra
  PROPOSTAS ||--o| CONTRATOS : gera
  CONTRATOS ||--o{ ASSINATURAS_CONTRATO : possui
  PROPOSTAS ||--o{ COMISSOES : gera
  USUARIOS ||--o{ INSCRICOES : "Universidade"
  CURSOS ||--o{ MODULOS : tem
  MODULOS ||--o{ CAPITULOS : tem
  CAPITULOS ||--o{ AULAS : tem
  CURSOS ||--o{ INSCRICOES : recebe
  INSCRICOES ||--o| CERTIFICADOS : emite
```

## 5. Fluxo: consulta pública por protocolo

```mermaid
flowchart LR
  V[Visitante] -->|insere protocolo + CAPTCHA| FE[/protocolo/]
  FE -->|invoke| EF1[edge: protocolo/consulta]
  EF1 -->|valida rate-limit + CAPTCHA| RL[(rate_limits)]
  EF1 -->|select status público| DB[(propostas)]
  EF1 --> FE2[/protocolo/:numero/]
  FE2 -->|se houver pendência de upload| EF2[edge: protocolo/upload-url]
  EF2 -->|signed URL curta| Stor[(bucket protocolo-uploads)]
  V -->|envia arquivo| Stor
  Stor -->|trigger| EF3[edge: ocr-pipeline]
  EF3 --> DB
  DB -->|notifica| EF4[edge: push-notifier]
  EF4 --> EVO[(Evolution API)]
```

## 6. Wizard de criação de proposta (UX)

```mermaid
flowchart LR
  S1[1. Produto & Pessoa] --> S2[2. Dados do cliente]
  S2 --> S3[3. Localização do imóvel]
  S3 --> S4[4. Valores e prazo]
  S4 --> S5[5. Proponentes adicionais]
  S5 --> S6[6. Cadastro de imóveis]
  S6 --> S7[7. Revisão & envio]
  S7 --> S8{{Magic link cliente}}
  S7 -.salvar rascunho.-> S1
```

## 7. Universidade (LMS)

```mermaid
flowchart TB
  Cat[Catálogo] --> Curso[Curso]
  Curso --> Mod[Módulo]
  Mod --> Cap[Capítulo]
  Cap --> Aula[Aula]
  Aula -->|video.ended| Prog[(aula_progresso)]
  Prog --> Insc[(inscricoes.progresso_pct)]
  Insc -->|>= criterio| Cert[Certificado]
  Cert --> PDF[(storage: certificados)]
```

## 8. React Flow — Rede de Originação (admin)

```mermaid
flowchart LR
  A[Admin Mercurio] --> P1[Parceiro A]
  A --> P2[Parceiro B]
  P1 --> E1[Equipe Alpha]
  P1 --> E2[Equipe Beta]
  E1 --> M1[Membro 1]
  E1 --> M2[Membro 2]
  M1 --> L1[Lead 101]
  M2 --> L2[Lead 102]
  P2 --> L3[Lead 201]
  L1 --> Pr1[(Proposta 101)]
  L2 --> Pr2[(Proposta 102)]
  L3 --> Pr3[(Proposta 201)]
```

## 9. Push & WhatsApp (notificação de status)

```mermaid
sequenceDiagram
  participant DB as Postgres
  participant TR as Trigger
  participant EF as Edge: push-notifier
  participant EVO as Evolution
  participant FCM as Push Provider
  actor U as Usuário

  DB->>TR: update propostas.status
  TR->>EF: enqueue evento
  EF->>DB: select template + destinatários
  EF->>EVO: WhatsApp template
  EF->>FCM: push web/app
  EVO-->>U: mensagem
  FCM-->>U: notificação
  EF->>DB: insert notificacoes + whatsapp_mensagens
```
