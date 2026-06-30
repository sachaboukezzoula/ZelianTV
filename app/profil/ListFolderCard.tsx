'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import Image from 'next/image'
import type { MediaListItem } from './DndMedia'

interface Props {
  listKey: string
  items: MediaListItem[]
  cover?: string | null
  isDragActive: boolean
  onOpen: () => void
}

export function ListFolderCard({ listKey, items, cover = null, isDragActive, onOpen }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: listKey, data: { listType: listKey } })
  const [hover, setHover] = useState(false)
  const highlight = isDragActive && isOver
  const posters = items.filter(i => i.poster_path).slice(0, 3)

  return (
    <button
      ref={setNodeRef}
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        width: '100%',
        height: 168,
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        padding: 0,
        textAlign: 'left',
        border: highlight ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,.08)',
        boxShadow: highlight ? '0 0 30px var(--accent-glow-md)' : '0 10px 26px rgba(0,0,0,.4)',
        transition: 'transform .18s ease, border-color .18s ease, box-shadow .18s ease',
        transform: hover && !isDragActive ? 'translateY(-3px)' : 'none',
        background: 'linear-gradient(150deg,#13131a,#0d0d12)',
      }}
    >
      {/* Fond : cover personnalisé, sinon bandes de posters */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        {cover ? (
          <div style={{ flex: 1, position: 'relative' }}>
            <Image src={cover} alt="" fill sizes="280px" className="object-cover" style={{ opacity: 0.7 }} />
          </div>
        ) : posters.length > 0 ? (
          posters.map((p, i) => (
            <div key={i} style={{ flex: 1, position: 'relative' }}>
              <Image src={`https://image.tmdb.org/t/p/w342${p.poster_path}`} alt="" fill sizes="120px" className="object-cover" style={{ opacity: 0.55 }} />
            </div>
          ))
        ) : (
          <div style={{ flex: 1, background: 'linear-gradient(150deg, var(--accent-glow-md), transparent 70%)' }} />
        )}
      </div>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,rgba(10,10,12,.94) 0%,rgba(10,10,12,.5) 55%,rgba(10,10,12,.62) 100%)' }} />

      {/* Icône dossier */}
      <div style={{ position: 'absolute', top: 14, left: 14, width: 34, height: 34, borderRadius: 9, background: 'rgba(10,10,12,.55)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M2 4.5A1.5 1.5 0 013.5 3h2.6l1.2 1.4h5.2A1.5 1.5 0 0114 5.9V11a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11z" stroke="var(--accent-2)" strokeWidth="1.3" strokeLinejoin="round" /></svg>
      </div>

      {/* Nom + compteur */}
      <div style={{ position: 'absolute', left: 18, right: 18, bottom: 16 }}>
        <div className="gal-display line-clamp-1" style={{ fontSize: 21, letterSpacing: '.03em', lineHeight: 1.05, textTransform: 'uppercase' }}>{listKey}</div>
        <div style={{ fontSize: 12, color: 'rgba(243,241,238,.55)', marginTop: 3 }}>{items.length} film{items.length > 1 ? 's' : ''}</div>
      </div>

      {/* Survol : « Ouvrir la liste » */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: hover && !isDragActive ? 1 : 0, transition: 'opacity .18s ease', background: 'rgba(8,8,10,.35)', pointerEvents: 'none' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 18px', borderRadius: 9, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.22)', backdropFilter: 'blur(6px)', fontSize: 13, fontWeight: 600 }}>
          Ouvrir la liste
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </div>
    </button>
  )
}
