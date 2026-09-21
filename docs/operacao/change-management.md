# Gestao de mudancas — Mercurio Capital

<!-- RELEASE_CURRENT_VERSION: 0.2.2 -->

## Objetivo

Este documento define o fluxo obrigatorio para qualquer mudanca futura no Mercurio Capital. A versao de referencia e `v0.2.0`.

Nenhuma solicitacao autoriza por si so deploy, migration remota, criacao de tag, GitHub Release ou publicacao mobile. Essas acoes exigem aprovacao explicita e um go/no-go separado depois do mapeamento completo da mudanca.

## Fontes e precedencia

Em caso de conflito, usar esta ordem:

1. handoff mais recente e documentos em `docs/operacao/`;
2. `docs/12-finalizacao.md` e `docs/09-roadmap.md`;
3. `docs/blueprint/`;
4. `docs/design/`.

Contradicoes devem ser registradas no plano da mudanca; nao devem ser resolvidas por suposicao silenciosa.

## Fluxo obrigatorio

### 1. Intake e mapeamento

O dono do produto informa objetivo, perfis afetados, comportamento esperado, prioridade, restricoes, criterios de sucesso e referencia visual quando houver.

O mapeamento deve declarar impacto, inclusive como `nao afetado`, em:

- web (`app/`);
- mobile (`mobile/`);
- banco, migrations e RLS (`supabase/migrations/`);
- Edge Functions e integracoes (`supabase/functions/`);
- Electron, updater e empacotamento;
- seguranca, compliance e operacao;
- documentacao, deploy e release.

### 2. Plano antes do codigo

Criar `prompts/YYYY-MM-DD-<slug>.md` com:

- objetivo;
- skills e documentos lidos;
- codigo inspecionado;
- decisoes, contradicoes e suposicoes;
- arquivos esperados;
- requisitos e criterios de aceite;
- seguranca;
- testes manuais e automaticos;
- rollout e rollback.

O dono do produto deve aprovar o plano antes de qualquer alteracao funcional.

### 3. Modelo de dados

Quando houver persistencia, definir e aprovar antes da implementacao:

- entidades, campos obrigatorios e opcionais;
- relacionamentos e cardinalidade;
- invariantes e regras de negocio;
- RLS, RPCs, auditoria e retencao;
- compatibilidade com dados existentes;
- migration forward-safe e estrategia de rollback ou forward-fix.

Migrations publicadas nunca sao reescritas.

### 4. Implementacao

Implementar o menor diff reversivel dentro da stack existente. Nao adicionar framework ou biblioteca sem autorizacao.

Regras invariantes:

- RLS e autorizacao server-side sao a autoridade;
- guards do cliente nao substituem seguranca no backend;
- tokens privados, service role, IA e MCPs internos nunca ficam no navegador;
- processos pesados rodam offline em scripts ou jobs;
- integracoes tratam assinatura, timeout, retry, idempotencia e observabilidade;
- UI segue a referencia visual e os componentes existentes.

### 5. Verificacao e revisao

Executar as verificacoes proporcionais ao escopo e registrar evidencia real. O Revisor Mercurio Capital avalia o diff sem editar. Achados Critical ou High bloqueiam merge e release.

### 6. Merge

O merge exige:

- plano e modelo de dados aprovados, quando aplicavel;
- criterios de aceite atendidos;
- CI verde;
- revisao aprovada;
- documentacao sincronizada;
- rollout e rollback registrados.

### 7. Deploy e release

Deploy e release formam um gate separado. Antes de qualquer publicacao, concluir o mapeamento do [checklist de release](./release-checklist.md) e obter autorizacao explicita do dono do produto.

Criar tag `vX.Y.Z` somente depois do merge, CI verde, consistencia de versao validada e go/no-go aprovado. Mobile Expo/EAS e um canal independente da tag desktop.

## Responsabilidades dos agentes

| Agente | Responsabilidade | Nao pode decidir |
| --- | --- | --- |
| PM Mercurio Capital | Escopo, dependencias, criterios de aceite, riscos e rollout/rollback | Produto, arquitetura ou prioridade nao definidos pelo dono |
| UX/UI Mercurio Capital | Especificacao fiel da interface, estados, responsividade e acessibilidade | Redesenhar produto sem referencia/aprovacao |
| DEV Senior Fullstack | Diagnostico tecnico, implementacao aprovada, testes e documentacao | Iniciar codigo antes da aprovacao ou publicar release |
| Revisor Mercurio Capital | Revisao read-only, severidade, risco residual e verdict | Corrigir o proprio achado ou aprovar sem evidencia |

## SemVer

- `patch`: correcao compativel sem nova capacidade relevante;
- `minor`: funcionalidade nova compativel;
- `major`: quebra de contrato ou migracao incompativel, sempre com plano especifico.

A versao deve permanecer coerente entre `app/package.json`, `app/package-lock.json` e os marcadores `RELEASE_CURRENT_VERSION` da documentacao operacional. Em evento de tag, a tag tambem deve corresponder.
