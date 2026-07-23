import { useEffect } from 'react'
import { router } from 'expo-router'
import { useAuth } from '@/lib/auth'
import { canCreateProposta } from '@/lib/adminScope'
import { PropostaWizardScreen } from '@/app/propostas/nova'

export default function AdminPropostasNova() {
  const { session } = useAuth()
  const podeCriar = canCreateProposta(session)

  // Bloqueia bypass por deep link direto: jurídica não cria proposta.
  useEffect(() => {
    if (!podeCriar) {
      router.replace('/(admin)/propostas' as any)
    }
  }, [podeCriar])

  if (!podeCriar) {
    return null
  }

  return <PropostaWizardScreen forcedMode="admin" />
}
