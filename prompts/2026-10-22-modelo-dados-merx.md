# Modelo Serasa → MERX — proposta para aprovação

## Objetivo
Preparar análises versionadas por proposta, com evidências, classificação sugerida e revisão humana. Documento de modelagem; não implementa migrations nem confirma estado remoto.

## Documentos e código inspecionados
Gestão de mudanças; auditoria Serasa/MERX de 21/10; plano revisado Serasa/MERX; resultado do smoke sintético de 21/10; migration 20261021000001_serasa_relatorios_autorizacoes; migration 20260925000003_proposta_classificacao_operacional; normalizador supabase/functions/_shared/serasa-reports.ts. Nenhuma skill especializada aplicável.

## Base existente
Reutilizar propostas, clientes/proponentes, proposta_documentos, logs_consultas, consulta_autorizacoes, serasa_relatorios_config e lead_distribuicoes. Não duplicar cadastro de titular ou carteira.
Logs já têm ambiente, produto, versão do normalizador, autorização e idempotência. A autorização exige documento da proposta, aprovado no fluxo. Normalizador retorna source, product, version, score, negativeData, availableSections e consultedAt. Classificação/responsável já existem na proposta.

## Modelo proposto
IDs UUID, datas timestamptz. Campos obrigatórios abaixo, salvo indicação opcional.

### merx_analises
Uma proposta tem várias análises. Campos: id, proposta_id FK, ambiente, chave_idempotencia, solicitado_por FK usuarios, estado, versao_schema, versao_regras, criado_em. Opcionais: iniciada_em, concluida_em, classe_sugerida (enum existente), codigo_erro, modelo/provedor, versao_prompt, tokens e custo/moeda.
Estados: pendente, processando, aguardando_fontes, aguardando_revisao, concluida, falha, cancelada. Unique solicitado_por/chave_idempotencia; reuso com outro escopo é rejeitado. Versão de regras aponta para snapshot imutável validado. Reanálise cria execução nova. Classe sugerida não muda automaticamente a classificação efetiva.
Processamento em job server-side com reivindicação atômica, lease, prazo e tentativas limitadas. Retry de análise não dispara consulta paga automaticamente.

### merx_evidencias
Uma análise tem várias evidências. Campos: id, analise_id FK, tipo_fonte, versao_extrator, capturado_em, estado_disponibilidade, dados_normalizados JSONB validado por schema.
Fontes: consulta_id FK logs_consultas OU documento_id FK proposta_documentos, mutuamente exclusivas. Evidência cadastral usa a proposta da análise e snapshot mínimo dos campos usados. Checar mesma proposta/titular e ambiente no servidor; não duplicar CPF/CNPJ.
Opcionais: localizador (página/campo), data_fonte, valido_ate, motivo_indisponibilidade. Disponibilidade: disponivel, ausente, sem_calculo, vencida, falha. Validade depende de política aprovada; desconhecida impede uso que exija atualidade.
Somente consulta concluída alimenta evidência utilizável. Reconciliação pendente e mock não são evidência produtiva. Ausência de score não vira zero; ausência de bloco negativo não significa nada consta.

### merx_resultados_pilares
Campos: id, analise_id FK, pilar, estado (avaliado/insuficiente/revisao_necessaria), regras_aplicadas (IDs/versões), resultado_estruturado, justificativa. Unique analise_id/pilar. Catálogo de pilares e pesos segue matriz aprovada, sem novos limiares implícitos.
Separar renda declarada/comprovada/estimada, período/moeda/fonte; preservar distinções PF/PJ e modelos de score.

### merx_resultado_evidencias
Associação N:N: resultado_id FK, evidencia_id FK, chave composta. Ambos devem pertencer à mesma análise. Conclusões factuais precisam apontar evidências verificáveis.

### merx_revisoes
Uma análise tem várias revisões auditáveis: id, analise_id FK, revisor_id FK usuarios, decisao (confirmar/ajustar/solicitar_complemento), justificativa, criado_em; classe_confirmada obrigatória quando estabelecer classificação.
Aplicar decisão aceita em propostas em transação, com auditoria e controle de concorrência; revisão antiga não sobrescreve análise atual. Classificação de complexidade não equivale à aprovação de crédito. Distribuição continua no fluxo existente sem duplicação.

## Segurança e decisões pendentes
RLS em todas as entidades/associações. Escrita de evidências/resultados por executor confiável; leitura vinculada ao escopo real da proposta e finalidade. Validar admin limitado, responsável, supervisão e parceiros; cargo no organograma não concede acesso. Payload bruto não fica disponível por padrão para cliente/parceiro. Não copiar credenciais para tabelas MERX ou frontend.
Retenção/descarte, validade por fonte, limiares dos pilares e provedor/dados mínimos da IA dependem de aprovação própria. Preparar modelo sem enviar documentos/PII à IA. Não atribuir retrospectivamente evidências ou autorizações fictícias a logs antigos.

## Pendência encontrada
O smoke UAT registrado em 21/10 terminou HTTP 202 reconciliacao_pendente. Caminho feliz integrado e idempotência após sucesso continuam inconclusivos nesse registro. Verificar processamento no provedor antes de repetir a consulta. Preparar modelo com fixtures não equivale a homologar Serasa. Estado remoto e credenciais produtivas não foram revalidados nesta inspeção.

## Arquivos esperados e sequência após aprovação
1. Conferir schema efetivo, vínculos de titulares e políticas de acesso; reconciliar pendência UAT.
2. Migration aditiva em supabase/migrations para entidades, constraints, RLS e RPCs.
3. Adaptadores e testes em supabase/functions/_shared; smokes SQL; documentação.
4. Integrar classificador determinístico e revisão, depois extração/LLM sobre o mesmo contrato.
UI, mobile, Electron e distribuição automática exigem escopo próprio. Sem nova biblioteca.

## Aceite e testes
Reprodução por versão/evidência; rejeição de vínculos entre propostas/titulares/ambientes; bloqueio de classe AAA sem evidências obrigatórias; ausência de dados distinta de ausência de ocorrência; concorrência sem duplicação; revisões antigas bloqueadas; permissões e payload bruto testados por perfil.
Testes unitários de normalização/contratos; smokes SQL transacionais de FK/RLS/idempotência/lease/revogação; lint/typecheck/build quando houver código; teste manual de revisão/pendência/falha quando houver UI.
Nesta etapa: inspeção estática e documentação apenas, sem execução de testes funcionais ou alterações remotas.

## Aprovação, rollout e rollback
Modelo submetido à aprovação conforme AGENTS.md e gestão de mudanças. Implementação em ambiente isolado, migration aditiva, flags desligadas inicialmente. Rollback suspende execuções e preserva histórico. Deploy exige GO próprio. Aprovação deste modelo não resolve retenção, limiares ou escolha de IA ainda pendentes.
