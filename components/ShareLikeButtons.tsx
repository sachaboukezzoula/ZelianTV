'use client'

import { useState, useEffect } from 'react'
import { getLikedStatus, toggleLike } from '@/app/actions/likes'
import type { MediaType } from '@/lib/tmdb'

interface Props {
  title: string
  tmdbId: number
  mediaType: MediaType
  variant?: 'default' | 'mobile'
}

export function ShareLikeButtons({ title, tmdbId, mediaType, variant = 'default' }: Props) {
  const isMobile = variant === 'mobile'
  const [copied, setCopied] = useState(false)
  const [liked, setLiked] = useState(false)
  const [hovShare, setHovShare] = useState(false)
  const [hovLike, setHovLike] = useState(false)

  useEffect(() => {
    getLikedStatus(tmdbId, mediaType).then(setLiked).catch(() => {})
  }, [tmdbId, mediaType])

  async function handleLike() {
    const next = !liked
    setLiked(next) // optimiste
    const res = await toggleLike(tmdbId, mediaType)
    if ('error' in res) setLiked(!next) // revert si échec (ex. table absente)
    else setLiked(res.liked)
  }

  async function share() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, url })
        return
      }
    } catch { /* l'utilisateur a annulé le partage natif */ }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard indisponible */ }
  }

  const buttons = (
    <>
      <button
        onClick={share}
        onMouseEnter={() => setHovShare(true)}
        onMouseLeave={() => setHovShare(false)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          flex: isMobile ? 1 : undefined,
          height: isMobile ? 52 : 50, padding: '0 22px', borderRadius: 9, cursor: 'pointer',
          fontSize: 14, fontWeight: 500, color: '#f3f1ee',
          background: hovShare ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.08)',
          border: '1px solid rgba(255,255,255,.16)',
          transition: 'background .15s ease',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M11 5.5a2 2 0 10-1.9-2.6L6.4 4.5a2 2 0 100 3l2.7 1.6a2 2 0 10.5-1L7 6.5a2 2 0 000-1l2.6-1.6c.35.36.85.6 1.4.6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>
        {copied ? 'Lien copié ✓' : 'Partager'}
      </button>

      <button
        onClick={handleLike}
        onMouseEnter={() => setHovLike(true)}
        onMouseLeave={() => setHovLike(false)}
        title="J'aime"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          width: isMobile ? 54 : 50, height: isMobile ? 52 : 50, borderRadius: 9, cursor: 'pointer',
          color: liked || hovLike ? '#ff8080' : '#f3f1ee',
          background: liked || hovLike ? 'rgba(232,80,80,.16)' : 'rgba(255,255,255,.08)',
          border: `1px solid ${liked || hovLike ? 'rgba(232,80,80,.5)' : 'rgba(255,255,255,.16)'}`,
          transition: 'all .15s ease',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 16 16" fill={liked ? '#ff8080' : 'none'}><path d="M8 13.5S2.5 10 2.5 6.2A2.7 2.7 0 018 4.3a2.7 2.7 0 015.5 1.9C13.5 10 8 13.5 8 13.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
      </button>
    </>
  )
  return isMobile ? <div style={{ display: 'flex', gap: 11, width: '100%' }}>{buttons}</div> : buttons
}
