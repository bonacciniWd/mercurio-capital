import { Redirect, useLocalSearchParams } from 'expo-router'

/** Matches the HTTPS proposal invite used by email and WhatsApp. */
export default function ClientePropostaInviteLink() {
  const { token } = useLocalSearchParams<{ token: string }>()
  return <Redirect href={{ pathname: '/onboarding', params: { token: typeof token === 'string' ? token : '' } }} />
}
