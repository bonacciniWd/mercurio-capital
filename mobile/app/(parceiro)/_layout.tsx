import { Tabs } from 'expo-router'
import { LayoutDashboard, FileText, Wallet, GraduationCap, User } from 'lucide-react-native'

export default function ParceiroLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#D4AF37',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { backgroundColor: '#0A2B4E', borderTopColor: '#1E4A7A', height: 84, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Início', tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }} />
      <Tabs.Screen name="propostas" options={{ title: 'Propostas', tabBarIcon: ({ color, size }) => <FileText color={color} size={size} /> }} />
      <Tabs.Screen name="carteira" options={{ title: 'Carteira', tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} /> }} />
      <Tabs.Screen name="universidade" options={{ title: 'Univ.', tabBarIcon: ({ color, size }) => <GraduationCap color={color} size={size} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
      <Tabs.Screen name="propostas/[id]" options={{ href: null }} />
    </Tabs>
  )
}
