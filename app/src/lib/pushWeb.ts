// Infra de push web (Frente A — issue #13). Registro/revogação silenciosa do
// token FCM: o prompt contextual de permissão é a issue #14. Push é canal
// complementar — nenhuma falha aqui pode quebrar login/logout/sessão.
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getMessaging, getToken, deleteToken, type Messaging } from 'firebase/messaging'
import { supabase } from '@/lib/supabase'

interface PushEnv {
  protocol: string
  serviceWorker: boolean
  pushManager: boolean
  notification: boolean
  electronUA: boolean
}

function detectEnv(): PushEnv {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { protocol: '', serviceWorker: false, pushManager: false, notification: false, electronUA: false }
  }
  return {
    protocol: window.location.protocol,
    serviceWorker: 'serviceWorker' in navigator,
    pushManager: 'PushManager' in window,
    notification: 'Notification' in window,
    // cobre o dev desktop (http://127.0.0.1 no Electron), que escapa do guard de protocolo
    electronUA: navigator.userAgent.includes('Electron'),
  }
}

// Degradê silencioso: Electron (file://, build desktop ou UA Electron) e
// navegadores sem suporte nunca veem nada de push.
export function pushWebSuportado(env: PushEnv = detectEnv(), mode: string = import.meta.env.MODE): boolean {
  if (env.protocol === 'file:' || mode === 'desktop' || env.electronUA) return false
  return env.serviceWorker && env.pushManager && env.notification
}

interface FirebaseWebConfig {
  apiKey: string
  projectId: string
  messagingSenderId: string
  appId: string
  vapidKey: string
}

// Leitura tardia (não no import) para testes poderem stubar env.
export function pushWebConfigurado(): boolean {
  return firebaseConfig() !== null
}

function firebaseConfig(): FirebaseWebConfig | null {
  const cfg = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined,
  }
  return Object.values(cfg).every(Boolean) ? (cfg as FirebaseWebConfig) : null
}

let app: FirebaseApp | null = null
let messaging: Messaging | null = null
let currentToken: string | null = null

async function registrarServiceWorker(cfg: FirebaseWebConfig): Promise<ServiceWorkerRegistration> {
  const params = new URLSearchParams({
    apiKey: cfg.apiKey,
    projectId: cfg.projectId,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId,
  })
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params}`)
}

// Silencioso: só registra token quando a permissão JÁ foi concedida antes.
// Idempotente — roda a cada login/refresh de sessão (cobre renovação de token).
export async function initPushWeb(): Promise<void> {
  const cfg = firebaseConfig()
  if (!cfg || !pushWebSuportado()) return
  if (Notification.permission !== 'granted') return
  try {
    const registration = await registrarServiceWorker(cfg)
    if (!app) app = initializeApp(cfg, 'push-web')
    if (!messaging) messaging = getMessaging(app)
    const token = await getToken(messaging, {
      vapidKey: cfg.vapidKey,
      serviceWorkerRegistration: registration,
    })
    if (!token) return
    currentToken = token
    await supabase.rpc('push_subscription_upsert', {
      p_token: token,
      p_user_agent: navigator.userAgent,
    })
  } catch {
    // push é complementar — falha aqui nunca quebra a sessão
  }
}

// Bloqueio local durável por usuário+navegador (issue #14, regra P-4): sem ele,
// o registro silencioso deste módulo desfaria o "desativar" a cada login.
const DEVICE_OFF_PREFIX = 'mercurio:push_device_off_v1:'

export function isPushDeviceOff(userId: string): boolean {
  try {
    return window.localStorage.getItem(DEVICE_OFF_PREFIX + userId) === '1'
  } catch {
    return false
  }
}

export function setPushDeviceOff(userId: string, off: boolean): void {
  try {
    if (off) window.localStorage.setItem(DEVICE_OFF_PREFIX + userId, '1')
    else window.localStorage.removeItem(DEVICE_OFF_PREFIX + userId)
  } catch {
    // localStorage indisponível — bloqueio não persiste (degradê aceitável)
  }
}

// ÚNICO ponto que pede permissão ao navegador — sempre a partir de gesto do usuário.
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!pushWebSuportado()) return 'denied'
  const permission = await Notification.requestPermission()
  if (permission === 'granted') await initPushWeb()
  return permission
}

// Revoga no servidor + descarta o token local. Chamar ANTES do signOut.
// Timeout de 4s: RPC sem prazo default não pode pendurar o logout.
export async function revokePushWeb(): Promise<void> {
  if (!pushWebSuportado()) return
  try {
    if (currentToken) {
      await Promise.race([
        supabase.rpc('push_subscription_revogar', { p_token: currentToken }),
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ])
    }
    if (messaging) await deleteToken(messaging)
  } catch {
    // idem — logout não pode falhar por causa de push
  } finally {
    currentToken = null
  }
}
