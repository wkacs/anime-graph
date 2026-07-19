'use client'
import { useEffect, useState } from 'react'

function b64ToUint8(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export default function PushToggle() {
  const [state, setState] = useState<'unsupported' | 'off' | 'on' | 'busy'>('busy')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setState('unsupported'); return }
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? 'on' : 'off'))
      .catch(() => setState('unsupported'))
  }, [])

  async function toggle() {
    const prev = state
    setState('busy')
    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: existing.endpoint }) })
        await existing.unsubscribe()
        setState('off')
        return
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToUint8(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as BufferSource,
      })
      const json = sub.toJSON()
      const res = await fetch('/api/push', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
      })
      if (!res.ok) throw new Error('mentés sikertelen')
      setState('on')
    } catch {
      setState(prev === 'busy' ? 'off' : prev)
    }
  }

  if (state === 'unsupported') return <p className="text-xs text-text-3">Ez a böngésző nem támogatja a web pusht.</p>
  return (
    <button onClick={toggle} disabled={state === 'busy'} className="btn-ghost border border-white/10 px-4 py-2 text-sm">
      {state === 'on' ? '🔔 Push bekapcsolva — kikapcsol' : state === 'busy' ? '…' : '🔕 Push-értesítés bekapcsolása'}
    </button>
  )
}
