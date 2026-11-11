import { Redirect } from 'expo-router'

export default function Cadastro() {
  return <Redirect href={{ pathname: '/onboarding', params: { profile: 'partner' } }} />
}
