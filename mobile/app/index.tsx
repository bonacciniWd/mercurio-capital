import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '@/lib/auth'

export default function Index() {
  const { session, loading } = useAuth()
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090B' }}><ActivityIndicator color="#DC2626" /></View>
  if (!session) return <Redirect href="/onboarding" />
  if (session.role === 'client') return <Redirect href="/(cliente)" />
  if (session.role === 'partner' || session.role === 'team_member') return <Redirect href="/(parceiro)/dashboard" />
  return <Redirect href="/acesso-indisponivel" />
}
