import type { QueryClient } from '@tanstack/react-query'

/** Refresh dashboard, fund distribution and finance summaries after admin edits. */
export async function invalidateAdminDashboardQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['admin-dashboard-v2'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-dashboard-fundos'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-dashboard-finance'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-kanban-propostas'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-kanban-fundos'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-kanban-fundos-vencedores'] }),
  ])
}
