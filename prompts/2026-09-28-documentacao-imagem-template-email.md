# Plano — Imagem de cabeçalho em templates de e-mail

## Objetivo
Documentar a validação e o fallback para imagens remotas usadas nos templates de e-mail da Mercurio Capital, incluindo a URL do cabeçalho informada pela operação.

## Documentos/código consultados
- `docs/README.md`
- `docs/operacao/runbooks.md`
- `docs/operacao/security-checklist.md`
- `app/src/pages/admin/Templates.tsx`
- `supabase/functions/email-dispatcher/index.ts`
- `supabase/migrations/20260520000020_fluxos_campanhas_fase12.sql`
- `supabase/migrations/20260718000002_admin_nivel_hardening.sql`

## Evidência atual
Em 28/09/2026, `https://www.mercuriocapitalsa.com.br/assets/call-to-DyM9aWlp.png` respondeu HTTP 200, HTTPS, `Content-Type: image/png`, sem autenticação e aproximadamente 1 MB.

## Decisões
- Não afirmar que a imagem é recusada pelo servidor sem observar o erro do provedor ou do cliente de e-mail.
- Usar URL absoluta HTTPS, `img` simples e estilos inline.
- Recomendar otimização do arquivo e fallback textual/logo caso o cliente bloqueie imagens remotas.
- Validar pelo preview do painel, enqueue de teste, `email_outbox` e entrega real.

## Critérios de aceite
- Runbook explica a diferença entre falha de origem, provedor de envio e bloqueio do cliente.
- Inclui exemplo seguro de HTML e passos de diagnóstico.
- Não inclui tokens, credenciais ou dados de destinatários.
- Orienta fallback que mantém o conteúdo utilizável sem imagem.
