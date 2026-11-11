# Rollback — alertas de idade da etapa do Kanban

Execute apenas se a publicação da migration `20261103000001_kanban_stage_age_alerts.sql` precisar ser revertida. Este rollback remove apenas notificações criadas por esse recurso, sem tocar em outros avisos nem no histórico de status.

Execute o script versionado `rollback.sql` neste diretório.

Depois do rollback do banco, reverter também os arquivos de frontend/documentação deste recurso na mesma release. O rollback não remove nem altera `proposta_status_historico`.
