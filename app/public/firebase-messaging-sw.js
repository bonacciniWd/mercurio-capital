/* Service worker de push web (Frente A — issue #13).
   Arquivo estático (sem build): a config pública do Firebase chega via query
   string no registro, feito por src/lib/pushWeb.ts. Versão do CDN travada na
   mesma do pacote npm `firebase` (app/package.json). */
importScripts('https://www.gstatic.com/firebasejs/13.3.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/13.3.0/firebase-messaging-compat.js')

const cfg = Object.fromEntries(new URL(self.location.href).searchParams)

firebase.initializeApp({
  apiKey: cfg.apiKey,
  projectId: cfg.projectId,
  messagingSenderId: cfg.messagingSenderId,
  appId: cfg.appId,
})

const messaging = firebase.messaging()

// Payload é data-only (ver _shared/push-fcm.ts): com chave `notification` o SDK
// auto-exibiria e este handler exibiria de novo — push duplicado.
messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {}
  self.registration.showNotification(d.titulo || 'Mercúrio Capital', {
    body: d.mensagem || '',
    icon: '/mercurio-icon.png',
    data: { link: d.link },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification.data && event.notification.data.link
  if (!link) return
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          try { await client.navigate(link) } catch { /* navegação best-effort */ }
          return client.focus()
        }
      }
      return clients.openWindow(link)
    }),
  )
})
