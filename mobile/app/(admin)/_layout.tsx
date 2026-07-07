import { Stack } from 'expo-router'

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="kanban" />
      <Stack.Screen name="aprovacoes" />
      <Stack.Screen name="parceiros" />
      <Stack.Screen name="partner-equipes" />
      <Stack.Screen name="propostas" />
      <Stack.Screen name="propostas-nova" />
      <Stack.Screen name="proposta/[id]" />
      <Stack.Screen name="rede" />
      <Stack.Screen name="campanhas" />
      <Stack.Screen name="carteiras" />
      <Stack.Screen name="financeiro" />
      <Stack.Screen name="precos" />
      <Stack.Screen name="fluxos" />
      <Stack.Screen name="templates" />
      <Stack.Screen name="integracoes" />
      <Stack.Screen name="universidade" />
      <Stack.Screen name="auditoria" />
      <Stack.Screen name="relatorios" />
      <Stack.Screen name="feature-flags" />
      <Stack.Screen name="configuracoes" />
    </Stack>
  )
}
