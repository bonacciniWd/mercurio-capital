# Plano — PDF executivo para Relatórios Admin

## Objetivo

Substituir a impressão simples do relatório administrativo por um documento PDF de apresentação profissional, com identidade visual Mercúrio Capital, hierarquia editorial clara e paginação legível. Preservar os filtros e os agregados que a tela já fornece, sem expor dados pessoais de leads.

## Skill e documentação consultadas

- `pdf:pdf` (`/Users/macbook/.codex/plugins/cache/openai-primary-runtime/pdf/26.1011.11113/skills/pdf/SKILL.md`): gerar por impressão/renderização, revisar páginas em imagem e ajustar até eliminar clipping/overlap.
- `docs/README.md`: estrutura da documentação e stack React/Supabase.
- `docs/blueprint/06-modules-features.md`: fontes e regras registradas para Relatórios Admin.
- Skill local de PDF consultada; sem dependências novas aprovadas ou propostas.

## Código e referências visuais inspecionados

- `app/src/lib/adminRelatorios.ts`: atual gerador HTML de impressão, tabelas básicas e `window.print()`.
- `app/src/pages/admin/Relatorios.tsx`: modelo agregado, botões e dados que alimentam a exportação.
- `app/src/components/SimulacaoCreditoPdf.tsx` e `app/src/lib/simulacaoCreditoPdf.ts`: padrão de PDF existente, logo horizontal, aviso/hero, cores Mercúrio, seções, cronograma e `window.print()`.
- `app/src/assets/logos/logowide.png`: logo disponível e usada no PDF existente.
- `docs/escopo-melhoria-operacao-llm.pdf`: documento PDF presente em `docs`; é uma especificação de conteúdo e não um template visual do relatório.
- Não há `pdfinfo`, `pdftoppm`, `pypdf`, `pdfplumber` ou `reportlab` disponíveis no ambiente consultado. Quick Look (`qlmanage`) e Google Chrome estão presentes; validar estratégia de renderização visual sem adicionar biblioteca de aplicação.

## Decisões e suposições

- Seguir a identidade existente no PDF do simulador: logo oficial, vermelho institucional, azul marinho, cinzas claros, tipografia sem serifa e aviso de escopo/datas.
- Permanecer com PDF via diálogo nativo de impressão/“Salvar como PDF”; não introduzir biblioteca, Edge Function, endpoint ou dependência.
- Exportar apenas agregados já mostrados na tela; nunca nome, e-mail ou telefone de lead. Manter parceiro e seus totais conforme a tabela administrativa existente.
- Usar A4, margens consistentes, cabeçalhos de tabela repetidos, linhas com quebra previsível, totais e rodapé discreto. Seções podem continuar em páginas seguintes sem cortar títulos, KPIs ou linhas.
- Alinhar o arquivo ao relatório visível incluindo a série mensal e distribuição de produtos, além de resumo, leads, propostas por etapa, financeiro e parceiros.

## Arquivos esperados

- `app/src/lib/adminRelatorios.ts`: template HTML/CSS para impressão, logo, estilos de página, hierarquia/tabelas e escaping preservados.
- `app/src/pages/admin/Relatorios.tsx`: fornecer a logo e os mesmos dados agregados da tela; estados de exportação existentes mantidos.
- `app/src/lib/adminRelatorios.test.ts`: verificar identidade/logo, seções incluídas, escaping e estrutura do documento.
- Este plano: registrar execução, evidência de revisão e ressalvas.

## Requisitos e critérios de aceite

1. PDF tem logo Mercúrio, cabeçalho com título/período/data, KPIs executivos e seções visualmente distintas em identidade institucional.
2. Leads aparecem somente de forma agregada; propostas mantêm status/etapas legíveis; financeiro diferencia realizado de previsto.
3. Conteúdo exportado corresponde aos filtros aplicados e inclui os blocos da tela, sem omitir série/produto.
4. Valores e textos longos quebram sem sobreposição ou corte. Títulos, cabeçalhos das tabelas e avisos não ficam órfãos no fim de página.
5. PDF continua sendo aberto em impressão/SALVAR PDF pelo navegador; nenhuma dependência é adicionada.
6. HTML/CSS da impressão escapa texto dinâmico contra injeção e não altera o arquivo Excel.
7. Testes focados, typecheck, lint e build passam.
8. Renderizar amostra representativa, inspecionar páginas e ajustar defeitos visuais antes de encerrar. Teste com sessão autenticada pode permanecer com o usuário se o ambiente não tiver dados de sessão confiáveis.

## Segurança e privacidade

- Não buscar nem imprimir dados adicionais além dos agregados atuais.
- Escapar todas as strings dinâmicas e manter números como valores, sem fórmulas.
- Carregar logo como asset local importado no bundle, sem URL externa.
- Nenhuma migration, escrita Supabase, deploy, commit ou inclusão de dependência neste escopo.

## Testes previstos

- Automatizados: teste unitário do HTML de impressão, presença de logo/seções, escaping, typecheck, lint, build e suite focada.
- Visuais: gerar amostra PDF representativa (sem PII real), renderizar e revisar página inicial, página de tabelas e última página/rodapé; revisar exportação no navegador em uma sessão autenticada antes de publicar.

## Aprovação

Plano aprovado pelo usuário em 05/11/2026. Implementação concluída.

## Implementação e validação

- O PDF usa a imagem local `logowide.png`, cabeçalho institucional, cartões executivos e tabelas com cabeçalhos repetidos, cores Mercúrio e rodapé com paginação.
- Valores monetários do PDF usam `Intl.NumberFormat('pt-BR')`, exibindo `R$` e separadores brasileiros. Contagens e percentuais permanecem fora da formatação monetária. A exportação Excel mantém seus valores numéricos originais.
- A exportação inclui evolução mensal e distribuição por produto, além das seções anteriores.
- Revisão visual feita com amostra sintética renderizada pelo Chrome e rasterizada via PDFKit: uma página, logo carregada, valores legíveis e sem títulos órfãos ou conteúdo cortado. Artefato temporário de QA em `/tmp/mercurio-admin-relatorio-preview-final.pdf`.
- Verificações executadas: teste focado do relatório (10 testes), typecheck, lint direcionado dos arquivos alterados e build de produção. Todos passaram. O lint completo também passou sem erros e registrou 33 avisos já distribuídos pelo repositório; o build mantém o aviso de chunk JavaScript acima de 500 kB.
- Publicado na Vercel Production em 05/11/2026 a partir de uma worktree isolada no HEAD `cfdfc02eedcddd2e3787c55597d0e73447470150`, levando somente os três arquivos de código deste escopo. Nenhuma migration ou escrita no Supabase foi feita; não houve commit nem push para GitHub.
- Deployment: `dpl_AwUbwzhvBuMF5MgkiPbg22ksojHf` (`https://mercurio-digital-idb8n0lo4-bonacciniwds-projects.vercel.app`). Os aliases `mercuriocapitalsa.com.br` e `www.mercuriocapitalsa.com.br` foram apontados para esse deployment.
- Validação pública: `www` respondeu HTTP 200, a raiz respondeu HTTP 308 para `www`, o HTML serviu o bundle novo, o chunk de Relatórios contém os blocos de resumo, evolução mensal, distribuição por produto e formatação PDF em R$, e o logo importado respondeu HTTP 200 como PNG. Typecheck, teste focado (10/10), lint direcionado, lint completo e build foram executados na worktree limpa e passaram; lint completo reportou 33 avisos preexistentes e o build manteve aviso de chunk acima de 500 kB.
- A validação autenticada de dados reais e o clique em “Salvar prévia em PDF” no navegador continuam pendentes, pois não foi usada uma sessão Admin autenticada nesta execução. O PDF sintético foi renderizado e revisado antes do deploy.
- `npm audit` no snapshot identificou vulnerabilidades de dependências, incluindo finding crítico transitivo de DOMPurify via PostHog; nenhuma dependência foi alterada neste deploy. Tratar separadamente, após avaliar impacto e atualizar com escopo controlado.
