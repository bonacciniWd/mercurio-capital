# Figma Make — Prompts de Prototipação
# Mercurio Capital

> Cole sempre o **Prompt Base** antes de qualquer prompt de tela específica.

---

## PROMPT BASE

```
Design a professional Brazilian real-estate credit platform called "Mercurio Capital".
Visual style: clean SaaS dashboard, light mode, sidebar navigation.
Brand colors: primary deep navy #0f172a, accent gold #d97706, success green #16a34a, danger red #dc2626.
Typography: Inter font family.
Components: shadcn/ui style — cards with subtle shadows, rounded-lg corners, clean tables, pill badges for status.
All monetary values in Brazilian Real (R$).
Language: Portuguese (Brazil).
```

---

## PÚBLICO (sem login)

### Login / Registro do Parceiro
```
Screen: Partner registration flow, step 1 of 3.
Layout: Centered card on light gray background, Mercurio Capital logo top-center.
Fields: full name, email, phone (with DDI +55), CNPJ, company name.
Below fields: file upload area for CNPJ card and company documents (drag-and-drop zone with dashed border).
CTA button "Enviar para análise" in gold/amber.
Small text below: "Já tem conta? Faça login"
Right side panel (60% width): hero illustration of a modern city with real-estate buildings, overlay text "Crédito Imobiliário para Parceiros Estratégicos".
```

### Consulta por Protocolo
```
Screen: Public protocol lookup page, no login required.
Layout: Centered page, white card 600px wide on light gray background. Mercurio Capital logo top-center.
Title: "Acompanhe sua Proposta" subtitle "Sem necessidade de cadastro"
Input field: "Número do Protocolo" with placeholder "MC-2024-XXXXXX"
Cloudflare Turnstile CAPTCHA widget below input.
CTA button "Consultar" in gold.
Result state (below the form, same card):
  Status badge "Análise de Crédito" in blue.
  Timeline component showing steps: Recebida ✓ · Pré-análise ✓ · Análise de Crédito ● · Comitê ○ · Contrato ○ · Recurso Liberado ○
  Pendências section: orange alert card "2 documentos solicitados" with list of document names and upload button per item.
Footer: small text "Dúvidas? Entre em contato com seu parceiro."
```

### Magic Link — Landing
```
Screen: Magic link token landing page.
Layout: Centered, minimal. Full-height page split 50/50.
Left side (dark navy): Mercurio Capital logo, tagline "Sua proposta está esperando por você", decorative real-estate illustration.
Right side (white): card with "Verificando seu acesso..." loading spinner animation.
Success state: green checkmark icon, "Identidade confirmada!", subtitle "Redirecionando para sua proposta...", progress bar animating.
Error state: red X icon, "Link expirado ou inválido", button "Solicitar novo link".
```

---

## PORTAL DO CLIENTE (/c)

### Home do Cliente
```
Screen: Client portal home page after magic link login.
Layout: Top navbar (no sidebar) — logo left, notification bell + avatar right. Light background.
Welcome banner: "Olá, João Silva 👋 — Acompanhe o andamento das suas propostas."
Cards row: "Propostas em andamento 2", "Documentos pendentes 3" (red badge), "Próxima etapa: Análise Jurídica".
Proposals list below: each proposal as a card with — protocol number, product type badge, requested value, status progress bar (linear, 7 steps), last update timestamp.
Floating notification: "Você tem 3 documentos para enviar" in amber banner at top.
```

### Proposta do Cliente — Documentos
```
Screen: Client document upload page.
Layout: Top navbar. Page title "Documentos Solicitados — Proposta MC-2024-0042".
Section tabs: "Pendentes (3)" | "Enviados (5)" | "Aprovados (2)".
Active tab: Pendentes.
Each document as a card: document name, description ("Comprovante de renda dos últimos 3 meses"), deadline date in red if urgent.
Upload area per card: drag-and-drop zone with dashed border, "ou clique para selecionar arquivo", accepted formats badge "PDF JPG PNG até 10MB".
Uploaded state: green checkmark, filename, file size, "Remover" link.
Bottom sticky bar: "3 documentos pendentes · 5 enviados" + "Enviar todos" gold button.
```

### Universidade — Portal Cliente
```
Screen: Client university access page (subscriber only).
Layout: Top navbar. Hero banner: "Universidade Mercurio" with book/graduation icon on dark navy background.
If not subscriber: lock overlay on content with "Assinar por R$ 49,90/mês" card centered, listing benefits.
If subscriber: course grid below hero.
Course card: cover image, course title, category badge, progress bar "40% concluído", "Continuar" button.
Featured course highlighted with gold border.
```

---

## PAINEL DO PARCEIRO (/p)

### Dashboard do Parceiro
```
Screen: Partner main dashboard after login.
Layout: dark navy left sidebar (240px), white main content area.
Sidebar items with icons: Dashboard, Simulações, Propostas, Equipe, Carteira, Relatórios, Universidade, Perfil.
At the top of sidebar: user avatar + name + "Parceiro" badge in green.
Wallet balance card at top of sidebar in gold: "Saldo R$ 1.250,00" with "Recarregar" button.
Main content: 4 KPI cards in top row — "Propostas Ativas 12", "Em Análise 5", "Contratos Assinados 3", "Volume Total R$ 4.2M".
Below KPIs: funnel chart (Simulações → Pré-análise → Análise → Comitê → Contrato) using bar visualization.
Below chart: recent proposals table with columns: Cliente, Produto, Valor, Status (colored badge), Responsável, Data.
Status badges: "Pré-análise" (yellow), "Análise de Crédito" (blue), "Comitê" (purple), "Recurso Liberado" (green).
```

### Lista de Simulações
```
Screen: Simulations list page.
Layout: Nav sidebar + main content. Title "Simulações" + "Nova Simulação" gold button top-right.
Filter bar: search by client name/CPF, product dropdown (Home Equity / Construção / Financiamento), date range, status filter.
Table columns: Data, Cliente, Produto, Valor Solicitado, Valor Imóvel, LTV%, Prazo, Parcela Estimada, Status (badge), Ações.
Status badges: "Rascunho" (gray), "Convertida em Proposta" (green).
Each row: "Ver" icon button + "Converter em Proposta" button.
Empty state: illustration + "Nenhuma simulação ainda. Crie sua primeira."
```

### Wizard — Passo 1: Produto e Pessoa
```
Screen: Multi-step proposal creation wizard, step 1 of 7.
Layout: Full page with progress bar at top showing 7 steps, current step 1 highlighted in gold.
Step labels below progress bar: Produto · Cliente · Localização · Valores · Proponentes · Imóveis · Revisão.
Main card centered (800px wide):
  Title "Tipo de Produto e Cliente"
  3 large selectable cards in a row: "Home Equity" (house icon), "Crédito Construção" (crane icon), "Financiamento Imobiliário" (building icon). Selected state: gold border + checkmark.
  Below: 2 toggle buttons "Pessoa Física" and "Pessoa Jurídica".
  Bottom navigation: "Cancelar" (ghost) + "Próximo →" (gold filled).
```

### Wizard — Passo 2: Dados do Cliente
```
Screen: Proposal wizard step 2 of 7 — Client data.
Progress bar at top, step 2 highlighted.
Form fields in 2-column grid:
  Left: Nome completo*, CPF/CNPJ*, Data de nascimento*, Nacionalidade.
  Right: E-mail*, Telefone (DDI +55)*, WhatsApp (same as phone toggle), Estado civil (dropdown: Solteiro/Casado/Divorciado/Viúvo/União Estável).
Below: "Dados de renda" section — Profissão, Renda mensal bruta (R$), Vínculo empregatício (dropdown: CLT/Autônomo/Empresário/Aposentado).
If PJ: swap CPF for CNPJ + Razão Social + Nome do representante legal.
Bottom: "← Anterior" ghost + "Próximo →" gold.
```

### Wizard — Passo 3: Localização do Imóvel
```
Screen: Proposal wizard step 3 of 7 — Property location.
Progress bar step 3 active.
CEP field with "Buscar" button — on click auto-fills remaining fields.
Fields: CEP*, Estado*, Cidade*, Bairro*, Rua*, Número*, Complemento.
Map embed (Google Maps static) showing pin on searched CEP address.
Toggle: "O imóvel é o mesmo endereço do proponente?" — if yes, auto-fill from step 2 data.
```

### Wizard — Passo 4: Valores e Prazo
```
Screen: Proposal wizard step 4 of 7 — Financial terms.
Two column layout.
Left column (inputs):
  Valor do crédito desejado (R$ currency input)
  Valor do imóvel (R$ currency input)
  Tipo de correção: toggle "Pós-fixado (IPCA)" / "Pré-fixado"
  Sistema de amortização: toggle "Price" / "SAC"
  Prazo: slider 12 to 240 months with numeric input
  Carência: dropdown 0 / 1 / 2 / 3 months
Right column (live simulation card, updates on input change):
  Card title "Simulação em tempo real"
  LTV: 41% (green if ≤ 60%, yellow if ≤ 70%, red if > 70%)
  Parcela estimada: R$ 4.230,00
  Taxa efetiva: IPCA + 1,39% a.m.
  Total a pagar: R$ 507.600,00
  Relação renda necessária: R$ 14.100,00 / mês
  Small bar chart showing amortization curve Price vs SAC comparison.
```

### Wizard — Passo 5: Proponentes
```
Screen: Proposal wizard step 5 — Proponents.
Shows primary proponent card (read-only, from step 2 data) with "Proponente Principal" badge.
"Estado civil: Casado" alert banner in amber: "Cônjuge deve ser incluído como co-proponente obrigatório."
"Adicionar cônjuge" card with + icon and outlined border.
Cônjuge form (expanded): Nome, CPF, Email, Telefone, Profissão, Renda mensal (R$).
Below: "+ Adicionar outro proponente" button (optional, collapsed by default).
Each proponent card shows: avatar placeholder, name, CPF masked, income, relationship badge (Principal/Cônjuge/Co-proponente), delete icon.
```

### Wizard — Passo 6: Imóveis
```
Screen: Proposal wizard step 6 — Properties.
Title "Imóveis Envolvidos" subtitle "Adicione o imóvel de garantia e outros se aplicável."
Property card form:
  Type: dropdown (Apartamento / Casa / Terreno / Comercial / Rural)
  CEP + auto-fill address fields
  Valor do imóvel (R$), Número de vagas
  Toggles: "Imóvel alugado?" / "Imóvel financiado?" / "Possui débitos?"
  If financiado: field "Saldo devedor (R$)"
  Proprietários: multi-select from proponents added in step 5
"Adicionar outro imóvel" outlined button below.
Each added property shows as a summary card with edit/remove actions.
```

### Wizard — Passo 7: Revisão Final
```
Screen: Proposal wizard step 7 — Final review.
Full summary in accordion sections, each expandable:
  ▼ Produto: Home Equity · PF · R$ 350.000 · 120 meses · Price · IPCA+1,39%
  ▼ Cliente: João Silva · CPF ***.***.***-12 · (11) 9xxxx-xxxx
  ▼ Localização: Rua das Flores, 123 · São Paulo/SP · 01310-100
  ▼ Valores: LTV 41% · Parcela R$ 4.230 · Renda mínima R$ 14.100
  ▼ Proponentes: João Silva (principal) · Maria Silva (cônjuge)
  ▼ Imóveis: Apartamento Jardins · R$ 850.000 · João Silva (proprietário)
Alert banner: "Após salvar, um link será enviado ao cliente via WhatsApp."
Bottom: "← Revisar" ghost + "Salvar Proposta e Enviar Link" gold button.
```

### Lista de Propostas
```
Screen: Partner proposals list page.
Layout: Sidebar + main. Title "Propostas" + "Nova Proposta" gold button.
KPI mini-cards row: Total 28 · Em andamento 18 · Aguardando cliente 4 · Finalizadas 6.
Filter bar: search, product filter, status filter, responsible team member filter, date range, export XLSX button.
Table columns: Protocolo, Cliente, Produto badge, Valor, Responsável (avatar+name), Status (colored badge), Última atualização, Ações.
Row click expands inline preview with last status history entry and quick actions.
Pagination at bottom.
```

### Detalhe da Proposta (tabs)
```
Screen: Proposal detail page with tab navigation.
Layout: Sidebar + main content. Top of main: proposal title "Proposta #2024-0042 — João Silva", status badge "Análise de Crédito" in blue, assigned partner name.
Tab bar: Resumo | Proponentes | Imóveis | Documentos | Histórico | Kanban.
Active tab: Resumo.
Resumo tab content: 2-column grid of info cards.
Left column: "Dados do Produto" card (Home Equity, PF, R$ 350.000 solicitado, 120 meses, Price, IPCA+1.39%), "Dados do Cliente" card (name, CPF partially hidden, email, phone).
Right column: "Imóvel Garantia" card (address, R$ 850.000 valor, residential), "Simulação Financeira" card with small table (parcela R$ 4.230, LTV 41%, relação renda 28%).
Bottom: action buttons "Solicitar Documentos" + "Avançar Status" (gold).
```

### Carteira do Parceiro
```
Screen: Partner wallet page.
Layout: Same sidebar. Main content title "Minha Carteira".
Top row: large balance card (full width, dark navy background, white text) — "Saldo Disponível R$ 1.250,00", subtitle "Atualizado agora", two buttons "Recarregar Saldo" (gold) and "Ver Extrato" (outline).
Below: 2 cards side by side.
Left card "Recarregar" with value selector: pill buttons R$50 · R$100 · R$250 · R$500 · Outro. Selected R$100 highlighted gold. Below: "Pagar com Stripe" button + card logos (Visa, Mastercard, Pix).
Right card "Consultas Disponíveis" showing price table: Serasa PF R$4,90 · Serasa PJ R$7,90 · Bacen CPF R$2,50 · Jusbrasil R$5,00 · RI Digital R$9,90. Each row has "Consultar" button.
Below: transaction history table "Extrato" — columns: Data, Tipo (badge: Recarga/Débito/Estorno), Descrição, Valor (+/-), Saldo Após.
```

### Equipe
```
Screen: Partner team management page.
Layout: Sidebar + main. Title "Minha Equipe".
Top: "Convidar Assistente" gold button top-right.
Team grid (card per member): Avatar, Name, Email, Role badge "Assistente", Team name badge, Proposals count "12 propostas", Status toggle Active/Inactive, "Ver propostas" link.
Invite modal (overlay): Name, Email, select Team dropdown, send button. Shows pending invites list with "Reenviar convite" option.
Teams section below: accordion per team showing member list and total proposals.
```

### Relatórios
```
Screen: Partner reports page.
Layout: Sidebar + main. Title "Relatórios".
Filter bar: date range picker, product, team, responsible, status.
4 chart cards:
  1. Funnel bar chart (Simulações → Pré-análise → Análise → Comitê → Contrato)
  2. Line chart "Volume mensal de propostas" (last 12 months)
  3. Donut chart "Propostas por produto" (Home Equity / Construção / Financiamento)
  4. Bar chart "Performance por colaborador" (proposals per team member)
Below: summary table — by status, count, total value, average ticket.
"Exportar Excel" and "Exportar PDF" buttons.
```

### Configurações do Parceiro
```
Screen: Partner settings page.
Layout: Sidebar + main. Title "Configurações".
Left vertical sub-menu: Perfil da Empresa · Notificações · Integrações · Segurança.
Active: Perfil da Empresa.
Form: Company logo upload (circle avatar with edit button), Razão Social, CNPJ (read-only), Website, WhatsApp comercial, Endereço comercial.
Notification preferences section: toggle rows for — Nova proposta atualizada (WhatsApp/Email/Push), Documento aprovado, Saldo de carteira baixo (< R$ 50), Convite de membro aceito.
Save button gold at bottom.
```

---

## UNIVERSIDADE MERCURIO (/p/universidade)

### Lista de Cursos
```
Screen: University courses catalog page.
Layout: Sidebar + main. Hero banner dark navy "Universidade Mercurio" with tagline "Capacitação para parceiros de excelência."
Filter tabs: Todos · Em andamento · Concluídos · Certificados.
Course grid (3 columns):
  Course card: cover image, category badge (Crédito Imobiliário/Compliance/Vendas), title, instructor name, duration "4h 30min", lessons count "18 aulas", progress bar if enrolled, difficulty badge (Iniciante/Intermediário/Avançado).
  Lock icon overlay on premium courses if no subscription.
My certificates section at bottom: certificate card with course name, completion date, validation code, "Baixar PDF" button.
```

### Player de Aula
```
Screen: Course lesson player page.
Layout: Full-width, minimal header with back button.
Main content: Vimeo-style video player (16:9, dark background, controls at bottom) taking 65% of width.
Right panel (35%):
  Course title + current lesson title
  Lesson list accordion by module — each lesson as a row with play icon, duration, completion checkmark.
  Current lesson highlighted in gold.
Below video: tabs "Conteúdo" | "Recursos" | "Notas".
Conteúdo: rich text lesson description.
Recursos: downloadable files list.
Notas: textarea for personal notes, auto-saved.
Progress toast: "Aula concluída! Próxima: Análise de Risco" with "Continuar →" button.
```

---

## PAINEL ADMIN (/admin)

### Dashboard Admin
```
Screen: Admin main dashboard.
Layout: Dark red-accent sidebar + white main content.
Sidebar items with icons: Dashboard · Parceiros · Clientes · Propostas · Rede · Documentos · Financeiro · Relatórios · Universidade · Fluxos · Campanhas · Integrações · Configurações · Auditoria.
Top KPI row (6 cards): Parceiros ativos 47 · Propostas abertas 312 · Volume em análise R$ 87M · Contratos este mês 23 · Documentos pendentes 41 · Saldo carteiras R$ 18.500.
Main chart: stacked area chart "Volume de propostas por produto" last 12 months.
Side panel: "Gargalos por etapa" horizontal bar chart showing count stuck per pipeline stage.
Bottom row: 2 cards — "Aprovações pendentes" list (top 5 partners awaiting approval) + "Documentos pendentes" list (top 5 proposals with overdue documents).
```

### Admin — Aprovações de Parceiros
```
Screen: Admin panel for partner approvals.
Layout: Admin sidebar (dark red accent) + main content.
Main title: "Aprovações de Parceiros" with counter badge "8 pendentes".
Filter bar: search input + status filter dropdown (Pendente / Aprovado / Suspenso) + date range.
Table with columns: Parceiro, CNPJ, Responsável, Data Cadastro, Documentos (icon count), Status, Ações.
Each row has "Ver Documentos" and "Aprovar / Recusar" action buttons.
One row expanded showing document preview panel on the right side — thumbnails of uploaded files with checkboxes.
```

### Admin — Rede React Flow
```
Screen: Admin origination network visualization page.
Layout: Full-screen, sidebar collapsed to icon-only. Top toolbar with zoom controls, filter by partner/status, legend.
Main canvas: node-graph visualization.
Node types: Admin (central dark navy hexagon) → Partner nodes (green circles with company name + proposals count) → Team nodes (smaller circles) → Member nodes (smallest, avatar) → Proposal nodes (document icon, colored by status).
Connection lines: thick for active, dashed for pending approval.
Node click: opens detail panel on right side — partner name, CNPJ, proposals stats, last activity.
Filter chips: "Apenas aprovados" toggle, "Com propostas ativas" toggle, status color legend.
```

### Admin — Kanban de Propostas
```
Screen: Admin proposals kanban board.
Layout: Sidebar + full-width horizontal scroll kanban.
Top filters: search, partner filter, product filter, date range.
Columns (one per status, scrollable horizontally):
  Simulação · Pré-análise · Análise de Crédito · Análise de Imóvel · Análise Jurídica · Comitê · Proposta ao Cliente · Emissão de Contrato · Aguardando Assinatura · Em Registro · Contrato Registrado · Recurso Liberado · Cancelado.
Each column header: status name + count badge + total value.
Proposal card: protocol, client name, value, partner name, days in stage (red if > SLA), product badge.
Drag-and-drop between columns with RBAC restrictions shown as locked columns for non-admin.
```

### Admin — Financeiro / Carteiras
```
Screen: Admin wallets management page.
Layout: Sidebar + main. Title "Carteiras dos Parceiros".
Summary cards row: Total em carteiras R$ 18.500 · Recargas hoje R$ 2.300 · Débitos hoje R$ 890 · Parceiros com saldo baixo 4 (red badge).
Table: Partner name, CNPJ, Balance (R$), Daily limit, Status (Active/Blocked), Last topup date, Last debit date, Actions.
Actions per row: "Ver extrato" · "Ajuste manual" (admin only, opens modal with credit/debit reason field) · "Bloquear carteira".
Low balance alert: rows with balance < R$ 20 highlighted with amber background.
Blocked wallets: red background, "Desbloquear" button.
```

### Admin — Financeiro / Preços de Consulta
```
Screen: Admin bureau query pricing management.
Layout: Sidebar + main. Title "Preços de Consulta".
Table: Tipo de Consulta, Preço atual (R$), Vigente desde, Vigente até (— if current), Status badge (Vigente/Histórico), Ações.
Rows: Serasa PF · Serasa PJ · Bacen CPF · Bacen CNPJ · Jusbrasil CNPJ · Escavador CNPJ · RI Digital Matrícula · Nacional Consultas Bens · Nacional Consultas Certidão.
"Novo preço" button per row: opens side drawer with new price field + effective date + confirmation warning "Isso afetará todos os parceiros imediatamente."
Historical prices accordion below main table.
```

### Admin — Fluxos Evolution
```
Screen: Admin automation flows editor page.
Layout: Sidebar + main split view.
Left panel (300px): flows list — each flow as a card: name, trigger event, status toggle Active/Inactive, last execution count.
"Novo Fluxo" button at top.
Right panel: flow detail.
  Flow name editable input at top.
  Trigger selector: dropdown (proposta_status_changed / partner_aprovado / pendencia_aberta / manual / cron).
  Condition builder: if/then card rows — field selector, operator, value. "+ Adicionar condição" button.
  Action card: template selector dropdown + preview of WhatsApp message template with variables highlighted {{nome_cliente}}, {{protocolo}}, {{status}}.
  Test button: "Testar com proposta MC-2024-0042" input + Run button.
  Execution log below: timestamp, trigger, result (Success/Error), recipient.
```

### Admin — Campanhas
```
Screen: Admin campaigns management page.
Layout: Sidebar + main. Title "Campanhas de Comunicação".
"Nova Campanha" gold button top-right.
Campaigns table: Nome, Canal (WhatsApp/Email/Push badge), Público-alvo, Disparos, Taxa de abertura, Status (Rascunho/Agendada/Enviada), Data, Ações.
New campaign modal (drawer from right):
  Campaign name, select channel (WhatsApp / Email / Push — multi-select with icons).
  Audience filter: role (Partners/Clients), status filter, product filter.
  Audience preview: "42 destinatários selecionados".
  Message composer: rich text for email, character counter for WhatsApp (1024 max), emoji picker.
  Schedule: "Enviar agora" / "Agendar para" datetime picker.
  Preview button + Send/Schedule button.
```

### Admin — Auditoria
```
Screen: Admin audit log page.
Layout: Sidebar + main. Title "Log de Auditoria".
Filter bar: date range, user filter, action type filter (INSERT/UPDATE/DELETE), table filter.
Timeline-style log: each entry as a row.
  Timestamp · User avatar + name · Action badge (INSERT green / UPDATE blue / DELETE red) · Table name · Record ID · Description "Proposta MC-2024-0042 avançou para Análise de Crédito".
  Expand row: shows before/after JSON diff with syntax highlighting (changed fields highlighted).
Export button "Exportar CSV".
Stats at top: today 124 eventos · this week 891 · most active user avatar + name.
```

### Admin — Integrações
```
Screen: Admin integrations configuration page.
Layout: Sidebar + main. Title "Integrações Externas".
Integration cards grid (2 columns):
  Each card: service logo, name, description, status badge (Conectado ✓ / Desconectado ✗ / Erro ⚠), last sync timestamp, "Configurar" button.
  Services: Evolution API (WhatsApp) · Serasa · Bacen · Jusbrasil · Escavador · RI Digital · Nacional Consultas · Clicksign · Stripe · FCM Push.
Clicksign card expanded: API key field (masked), Webhook URL (copy button), test button "Enviar contrato de teste".
Stripe card: Publishable key, Secret key (masked), Webhook secret, mode toggle Test/Production, recent webhook events log.
Evolution card: instance name, QR code to scan, connection status indicator (green dot pulsing if connected).
```
