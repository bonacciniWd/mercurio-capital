# Plano — capas locais do carrossel da plataforma

## Objetivo

Trocar as seis imagens remotas atuais do carrossel `#plataforma` pelas capas já disponíveis em `app/src/assets/products`, usando a imagem que corresponde ao conteúdo de cada slide.

## Skills e documentos lidos

- `AGENTS.md` fornecido nesta conversa.
- `docs/README.md`.
- `docs/operacao/change-management.md`.
- Nenhuma skill específica é necessária para esta troca de assets locais.

## Código e assets inspecionados

- `app/src/pages/Landing.tsx`: array `platformSlides` e renderização da imagem em cada slide.
- `app/src/index.css`: estilos existentes do carrossel `#plataforma`; não há necessidade prevista de alterar CSS.
- Os seis arquivos em `app/src/assets/products/`, todos JPEG de 1376×768, conferidos visualmente:
  - `wizard.jpg`
  - `bureaus.jpg`
  - `contrato.jpg`
  - `dashboard.jpg`
  - `wallet.jpg`
  - `universidade.jpg`

## Decisões e suposições

- Mapear os slides na ordem atual: `Originação` → `wizard.jpg`; `Inteligência` → `bureaus.jpg`; `Formalização` → `contrato.jpg`; `Performance` → `dashboard.jpg`; `Gestão` → `wallet.jpg`; `Capacitação` → `universidade.jpg`.
- Usar imports locais com o alias `@/assets/products/...`, seguindo o padrão de assets já usado na landing e permitindo que o Vite inclua as imagens no build.
- Atualizar o texto alternativo de cada imagem para descrever sua cena real. Preservar títulos, descrições, navegação, autoplay, layout e estilos do carrossel.
- Escopo apenas visual da landing; sem alteração de CMS, modelo de dados, servidor ou regras de negócio.

## Arquivos esperados

- `app/src/pages/Landing.tsx`
- Este plano, com resultados das verificações após a aprovação e implementação.

## Requisitos e critérios de aceite

- Cada um dos seis slides usa o JPEG local correspondente ao assunto.
- Nenhum slide do carrossel depende das imagens remotas atuais.
- As capas carregam nos modos desktop e mobile e mantêm o recorte previsto pelo CSS existente.
- Texto, ordem, navegação, autoplay e comportamento responsivo permanecem inalterados.
- Não há rolagem horizontal em 390 px; navegação para os seis slides continua funcionando.

## Modelo de dados

Não aplicável. Não há persistência nem mudança de dados.

## Segurança e impacto operacional

- O build empacota assets já presentes no repositório; não serão adicionadas URLs externas ou dependências.
- Web: landing `/`; mobile nativo: não afetado; Supabase, RLS, Edge Functions e integrações: não afetados; Electron e empacotamento: sem mudança de fluxo, embora o asset esteja disponível no bundle web usado pelo app.
- Sem dados pessoais, credenciais, chamadas de rede adicionais ou migrações.
- Sem deploy ou release neste escopo.

## Testes

- `npm run lint`, `npm run typecheck` e `npm run build` em `app/`.
- No Chrome, conferir as seis imagens e a troca de slides em 390×844 e 1440×900; verificar se as imagens carregaram, se o foco e controles continuam operantes e se não há rolagem horizontal.
- `git diff --check`.

## Rollout e rollback

- Implementar localmente após aprovação deste plano.
- Rollback: restaurar as seis referências de imagem e os textos alternativos anteriores em `platformSlides`.
- Deploy Vercel e release desktop permanecem gates separados, conforme `docs/operacao/change-management.md`.

## Resultado da implementação e verificações

- Os seis slides agora importam os assets locais mapeados acima; os textos alternativos descrevem as cenas correspondentes.
- Chrome validado em 390×844 e 1440×900: naveguei pelos seis slides em cada viewport; todos carregaram com largura natural de 1376 px e não houve rolagem horizontal.
- `npm run lint`: passou sem erros, com 38 avisos existentes em outros arquivos. `npx eslint src/pages/Landing.tsx`: passou sem avisos.
- `npm run typecheck`: passou.
- `npm run build`: passou e incluiu os seis JPEGs locais no bundle. Vite emitiu o aviso já existente de bundle principal acima de 500 kB.
- `git diff --check`: passou.
- Sem deploy ou release.
