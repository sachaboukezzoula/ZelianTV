'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function BackButton() {
  const router = useRouter()
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={() => router.back()}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      aria-label="Retour"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        height: 36, padding: '0 14px 0 11px', borderRadius: 9, cursor: 'pointer',
        fontSize: 13, color: hov ? '#fff' : 'rgba(243,241,238,.7)',
        background: hov ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.05)',
        border: '1px solid rgba(255,255,255,.1)',
        transition: 'all .15s ease',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      Retour
    </button>
  )
}
