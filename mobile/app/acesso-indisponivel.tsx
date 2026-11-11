import { Image, Pressable, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/lib/auth'

export default function AcessoIndisponivel() {
  const { signOut } = useAuth()
  return <SafeAreaView className="flex-1 items-center justify-center bg-[#09090B] px-7">
    <Image source={require('../assets/logos/logo-dark.png')} style={{ width: 210, height: 65 }} resizeMode="contain" />
    <Text className="mt-10 text-center text-2xl font-bold text-white">Acesso indisponível no app</Text>
    <Text className="mt-3 text-center text-base leading-6 text-[#A3A3AA]">O aplicativo atende clientes e parceiros. Para acesso administrativo, use o portal web da Mercúrio Capital.</Text>
    <Pressable onPress={() => { void signOut() }} className="mt-9 min-h-14 w-full items-center justify-center rounded-xl bg-[#DC2626]">
      <Text className="text-base font-bold text-white">Sair desta conta</Text>
    </Pressable>
  </SafeAreaView>
}
