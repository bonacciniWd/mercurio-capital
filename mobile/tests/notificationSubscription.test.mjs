import test from 'node:test'
import assert from 'node:assert/strict'
import { subscribeToNotifications } from '../lib/notificationSubscription.ts'

function fakeRealtime() {
  const channels = new Map()
  const removed = []
  const source = {
    channel(topic) {
      if (channels.has(topic)) return channels.get(topic)
      const listeners = []
      const channel = {
        topic, joined: false,
        on(type, filter, callback) {
          if (this.joined) throw new Error('cannot add postgres_changes callbacks after subscribe()')
          listeners.push({ type, filter, callback })
          return this
        },
        subscribe(callback) { this.joined = true; callback('SUBSCRIBED'); return this },
        emit(event) { listeners.filter((listener) => listener.filter.event === event).forEach((listener) => listener.callback()) },
      }
      channels.set(topic, channel)
      return channel
    },
    // Simulate network removal still pending when React mounts another consumer.
    removeChannel(channel) { removed.push(channel); return new Promise(() => {}) },
  }
  return { source, channels, removed }
}

test('sino do Início e atalho do Perfil compartilham canal sem adicionar callbacks após subscribe', () => {
  const { source, channels, removed } = fakeRealtime()
  let home = 0; let profile = 0
  const releaseHome = subscribeToNotifications(source, 'synthetic-user', () => home++)
  const releaseProfile = subscribeToNotifications(source, 'synthetic-user', () => profile++)
  assert.equal(channels.size, 1)
  const channel = [...channels.values()][0]
  home = 0; profile = 0
  channel.emit('INSERT')
  assert.equal(home, 1); assert.equal(profile, 1)
  releaseHome()
  assert.equal(removed.length, 0)
  channel.emit('UPDATE')
  assert.equal(home, 1); assert.equal(profile, 2)
  releaseProfile(); releaseProfile()
  assert.equal(removed.length, 1)
})

test('remontagem/Fast Refresh não reutiliza canal cuja remoção assíncrona ainda está pendente', () => {
  const { source, channels, removed } = fakeRealtime()
  let calls = 0
  const release = subscribeToNotifications(source, 'synthetic-user', () => calls++)
  const oldChannel = [...channels.values()][0]
  release()
  const releaseNew = subscribeToNotifications(source, 'synthetic-user', () => calls++)
  assert.equal(channels.size, 2)
  const currentChannel = [...channels.values()][1]
  assert.notEqual(oldChannel.topic, currentChannel.topic)
  calls = 0
  oldChannel.emit('INSERT')
  assert.equal(calls, 0)
  currentChannel.emit('INSERT')
  assert.equal(calls, 1)
  releaseNew()
  assert.equal(removed.length, 2)
})

test('contas diferentes têm canais e ciclos de vida independentes', () => {
  const { source, channels, removed } = fakeRealtime()
  let first = 0; let second = 0
  const releaseFirst = subscribeToNotifications(source, 'user-a', () => first++)
  const releaseSecond = subscribeToNotifications(source, 'user-b', () => second++)
  assert.equal(channels.size, 2)
  const [channelA, channelB] = [...channels.values()]
  releaseFirst()
  first = 0; second = 0
  channelA.emit('UPDATE'); channelB.emit('UPDATE')
  assert.equal(first, 0); assert.equal(second, 1)
  assert.equal(removed.length, 1)
  releaseSecond()
})
