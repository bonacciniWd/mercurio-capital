# Cota diária de consultas Serasa iniciadas por Admin

## Regra

Em produção, cada usuário com papel `admin` pode iniciar até 20 novas consultas Serasa PF/PJ por dia civil de `America/Sao_Paulo`. PF e PJ compartilham a cota. O número fica em `configuracoes_sistema.valor` na chave `serasa_admin_limite_diario`; a migration instala `20` sem sobrescrever configuração existente. Valor ausente ou inválido bloqueia novas consultas Admin. O limite interno não altera o limite contratado com a Serasa.

O início da consulta é registrado em `logs_consultas` com `cobranca_modalidade = 'operacao_interna'`, `preco_centavos` como valor de tabela para auditoria e IDs de ledger nulos. Esse valor não representa necessariamente o custo real faturado pela Serasa. O parceiro vinculado à proposta não é cobrado. Toda tentativa que criou log conta na cota, inclusive `falha` e `reconciliacao_pendente`; rejeições antes do log e reutilizações da mesma chave idempotente não contam. Uma falha definitiva do provedor marca o log como `falha`, sem crédito à carteira. Resultado incerto permanece para reconciliação e não deve ser repetido com nova chave.

Consultas de parceiro continuam em `carteira_parceiro`, com débito e estorno nos casos aplicáveis. Admin continua obrigado a ter acesso à proposta, relatório habilitado e autorização válida do titular. A verificação de cota ocorre na RPC do banco, sob bloqueio transacional por Admin/data; a interface apenas mostra o erro HTTP 429.

## Operação

- Consultar o limite atual: `select valor from public.configuracoes_sistema where chave = 'serasa_admin_limite_diario';`
- Verificar consumo de um Admin sem expor CPF/CNPJ: filtrar `logs_consultas` por `iniciado_por`, `cobranca_modalidade = 'operacao_interna'`, `ambiente = 'producao'`, tipos `serasa_pf`/`serasa_pj` e intervalo do dia civil de São Paulo. A consulta deve ser executada por perfil autorizado.
- Alterar o limite somente com Admin full e após decisão operacional explícita, registrando quem alterou e o motivo. Um trigger impede que Admin limitado/jurídico edite esta chave, mesmo que a policy geral de configurações permita outras alterações. O valor deve ser inteiro positivo em JSON; a interface não controla a cota.
- Em incidentes, desabilitar novas consultas pela configuração da integração/relatório existente. Preservar logs, autorizações e movimentos financeiros; não criar débito retroativo para consultas internas.

## Publicação e validação

A migration `20261028000002_serasa_admin_cota_diaria.sql`, a Edge `consulta-executar` e o frontend devem ser publicados como conjunto compatível. Aplicar migration antes da Edge; verificar que a resposta 429 não chama o provedor. Depois publicar a interface. Testar com dados sintéticos ou ambiente de homologação; não disparar relatório real de produção apenas para testar limite. `supabase/smoke-tests/fase-50-serasa-admin-cota.sql` valida estrutura e ACLs, não substitui o teste transacional 20/21 nem o teste autenticado de ponta a ponta.
