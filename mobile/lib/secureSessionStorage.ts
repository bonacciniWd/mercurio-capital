import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

// Supabase stores a JSON session that may exceed the iOS Keychain item limit.
// Split it into small encrypted items and commit the count last.
const CHUNK_SIZE = 900
const MAX_CHUNKS = 24
const metaKey = (key: string) => `${key}.meta`
const chunkKey = (key: string, bank: 0 | 1, index: number) => `${key}.${bank}.${index}`
type Meta = { bank: 0 | 1; count: number }
let pendingWrite: Promise<void> = Promise.resolve()

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const result = pendingWrite.then(work, work)
  pendingWrite = result.then(() => undefined, () => undefined)
  return result
}

function parseMeta(value: string | null): Meta | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Meta
    if ((parsed.bank === 0 || parsed.bank === 1)
      && Number.isInteger(parsed.count) && parsed.count >= 1 && parsed.count <= MAX_CHUNKS) return parsed
  } catch { /* Corrupt metadata fails closed. */ }
  return null
}

async function readSecure(key: string): Promise<string | null> {
  const meta = parseMeta(await SecureStore.getItemAsync(metaKey(key)))
  if (!meta) return null
  const chunks = await Promise.all(
    Array.from({ length: meta.count }, (_, index) => SecureStore.getItemAsync(chunkKey(key, meta.bank, index))),
  )
  if (chunks.some((part) => part === null)) return null
  return chunks.join('')
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    await pendingWrite
    const secured = await readSecure(key)
    if (secured !== null) return secured
    if (await SecureStore.getItemAsync(metaKey(key))) return null

    // Migrate existing installations once; do not log the session contents.
    const legacy = await AsyncStorage.getItem(key)
    if (!legacy) return null
    await secureSessionStorage.setItem(key, legacy)
    return legacy
  },
  async setItem(key: string, value: string): Promise<void> {
    return serialize(async () => {
      const count = Math.ceil(value.length / CHUNK_SIZE)
      if (count < 1 || count > MAX_CHUNKS) throw new Error('Sessão local excede o tamanho permitido.')
      const previous = parseMeta(await SecureStore.getItemAsync(metaKey(key)))
      const bank: 0 | 1 = previous?.bank === 0 ? 1 : 0
      for (let index = 0; index < count; index += 1) {
        await SecureStore.setItemAsync(chunkKey(key, bank, index), value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE))
      }
      await SecureStore.setItemAsync(metaKey(key), JSON.stringify({ bank, count }))
      if (previous) for (let index = 0; index < previous.count; index += 1) {
        await SecureStore.deleteItemAsync(chunkKey(key, previous.bank, index))
      }
      await AsyncStorage.removeItem(key)
    })
  },
  async removeItem(key: string): Promise<void> {
    return serialize(async () => {
      await SecureStore.deleteItemAsync(metaKey(key))
      await Promise.all([0, 1].flatMap((bank) =>
        Array.from({ length: MAX_CHUNKS }, (_, index) => SecureStore.deleteItemAsync(chunkKey(key, bank as 0 | 1, index))),
      ))
      await AsyncStorage.removeItem(key)
    })
  },
}
