import { Redirect, useLocalSearchParams } from 'expo-router'

export default function MagicLink() {
  const { token } = useLocalSearchParams<{ token: string }>()
  return <Redirect href={{ pathname: '/onboarding', params: { token: typeof token === 'string' ? token : '' } }} />
}
