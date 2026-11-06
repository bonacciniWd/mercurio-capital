import { ReactNode } from 'react'
import { MerxPublicChat } from './MerxPublicChat'

export function MerxPublicHost({ children }: { children: ReactNode }) {
  return <>{children}<MerxPublicChat /></>
}
