-- Status operacional para propostas que aguardam uma ação externa ou prazo.
-- Mantém a proposta no histórico sem contaminar as métricas de ativas.
alter type public.proposta_status add value if not exists 'standby';
