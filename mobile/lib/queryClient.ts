import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

let queryIdentity: string | null | undefined

/** Invalidate private memory before a different account can render it. Same-user token refresh keeps the cache. */
export function setQueryIdentity(userId: string | null): boolean {
  if (queryIdentity === userId) return false
  queryIdentity = userId
  queryClient.clear()
  return true
}

