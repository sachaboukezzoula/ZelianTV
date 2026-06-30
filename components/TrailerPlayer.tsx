'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Props {
  videoKey?: string
  title: string
  backdrop?: string | null
}

export function TrailerPlayer({ videoKey, title, backdrop }: Props) {
  const [playing, setPlaying] = useState(false)

  const frameStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: 'clamp(220px, 40vw, 452px)',
    borderRadius: 16,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,.08)',
    boxShadow: '0 20px 50px rgba(0,0,0,.4)',
  }

  if (!videoKey) {
    return (
      <div style={{ ...frameStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(125deg,#10131c,#1a2030)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'rgba(243,241,238,.4)' }}>
          <svg width="34" height="34" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" /><path d="M6.5 5.5l4 2.5-4 2.5z" fill="currentColor" /></svg>
          <span style={{ fontSize: 14 }}>Aucune bande-annonce disponible</span>
        </div>
      </div>
    )
  }

  if (playing) {
    return (
      <div style={frameStyle}>
        <iframe
          src={`https://www.youtube.com/embed/${videoKey}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
        />
      </div>
    )
  }

  return (
    <div onClick={() => setPlaying(true)} style={{ ...frameStyle, cursor: 'pointer' }}>
      {backdrop ? (
        <Image src={backdrop} alt={title} fill sizes="(min-width: 1180px) 1120px, 100vw" className="object-cover" style={{ opacity: 0.5 }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(125deg,#10131c,#1a2030)' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 42%, rgba(0,0,0,.15), rgba(0,0,0,.65))' }} />

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'gal-play-pulse 2.4s ease-out infinite', boxShadow: '0 10px 30px var(--accent-glow)' }}>
          <svg width="30" height="30" viewBox="0 0 16 16" fill="#0a0a0c"><path d="M5 3l9 5-9 5z" /></svg>
        </div>
        <div style={{ fontSize: 13, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.82)' }}>Lancer la bande-annonce</div>
      </div>

      <div style={{ position: 'absolute', left: 20, bottom: 18, fontSize: 13, color: 'rgba(255,255,255,.7)' }}>{title} — Bande-annonce</div>
    </div>
  )
}
